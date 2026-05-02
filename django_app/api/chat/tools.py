from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from projects.models import (
    BreakpointTemperature,
    Colony,
    Observation,
    Project,
    ThermalLimit,
    ThermalTolerance,
)


ED_CONFIG = {
    'ed5': {
        'model': BreakpointTemperature,
        'absolute': 'abs_breakpoint_temperature',
        'relative': 'rel_breakpoint_temperature',
        'label': 'ED5',
    },
    'ed50': {
        'model': ThermalTolerance,
        'absolute': 'abs_thermal_tolerance',
        'relative': 'rel_thermal_tolerance',
        'label': 'ED50',
    },
    'ed95': {
        'model': ThermalLimit,
        'absolute': 'abs_thermal_limit',
        'relative': 'rel_thermal_limit',
        'label': 'ED95',
    },
}


def _clamp_limit(value, default=5):
    try:
        return max(1, min(int(value), 10))
    except (TypeError, ValueError):
        return default


def _project_url(project_id):
    return f'/project/{project_id}'


def _map_url(colony, zoom=12):
    return f'/map?colony={colony.id}&lng={colony.longitude}&lat={colony.latitude}&zoom={zoom}'


def _projects_for_colony(colony):
    projects = (
        Project.objects
        .filter(biosamples__colony=colony)
        .distinct()
        .order_by('name')[:5]
    )
    return [
        {
            'id': project.id,
            'name': project.name,
            'url': _project_url(project.id),
        }
        for project in projects
    ]


def _links_for_colony(colony, projects=None):
    links = [
        {
            'label': f'Open {colony.name} on the map',
            'href': _map_url(colony),
            'type': 'map',
        }
    ]
    for project in projects or _projects_for_colony(colony):
        links.append({
            'label': f'Project: {project["name"]}',
            'href': project['url'],
            'type': 'project',
        })
    return links


def _colony_payload(colony):
    projects = _projects_for_colony(colony)
    return {
        'id': colony.id,
        'name': colony.name,
        'species': colony.species,
        'country': colony.country,
        'latitude': colony.latitude,
        'longitude': colony.longitude,
        'projects': projects,
        'mapUrl': _map_url(colony),
        'links': _links_for_colony(colony, projects),
    }


def find_ed_extreme(metric='ed50', direction='lowest', relative=False, limit=5):
    metric = str(metric or 'ed50').lower()
    direction = str(direction or 'lowest').lower()
    config = ED_CONFIG.get(metric, ED_CONFIG['ed50'])
    field = config['relative' if relative else 'absolute']
    order = field if direction == 'lowest' else f'-{field}'

    rows = (
        config['model'].objects
        .exclude(**{f'{field}__isnull': True})
        .select_related('colony')
        .order_by(order, 'colony__name')[:_clamp_limit(limit)]
    )

    results = []
    links = []
    for row in rows:
        colony = row.colony
        projects = _projects_for_colony(colony)
        colony_links = _links_for_colony(colony, projects)
        results.append({
            'metric': config['label'],
            'valueType': 'relative' if relative else 'absolute',
            'value': getattr(row, field),
            'condition': row.condition,
            'timepoint': row.timepoint,
            'sstClimMmm': row._sst_clim_mmm,
            'colony': {
                'id': colony.id,
                'name': colony.name,
                'species': colony.species,
                'country': colony.country,
                'latitude': colony.latitude,
                'longitude': colony.longitude,
            },
            'projects': projects,
            'projectUrl': projects[0]['url'] if projects else None,
            'mapUrl': _map_url(colony),
            'links': colony_links,
        })
        links.extend(colony_links)

    return {
        'metric': config['label'],
        'direction': direction,
        'valueType': 'relative' if relative else 'absolute',
        'results': results,
        'links': links,
    }


def search_projects(query, limit=5):
    query = (query or '').strip()
    limit = _clamp_limit(limit)
    projects = (
        Project.objects
        .select_related('owner')
        .prefetch_related('publications')
        .filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(owner__username__icontains=query) |
            Q(publications__title__icontains=query) |
            Q(publications__authors__icontains=query) |
            Q(biosamples__colony__species__icontains=query) |
            Q(biosamples__colony__country__icontains=query)
        )
        .distinct()
        .annotate(colony_count=Count('biosamples__colony', distinct=True))
        .order_by('name')[:limit]
    )

    results = []
    links = []
    for project in projects:
        project_link = {
            'label': f'Project: {project.name}',
            'href': _project_url(project.id),
            'type': 'project',
        }
        links.append(project_link)
        results.append({
            'id': project.id,
            'name': project.name,
            'description': project.description[:500],
            'registrationDate': project.registration_date.isoformat() if project.registration_date else None,
            'owner': project.owner.username if project.owner else None,
            'colonyCount': project.colony_count,
            'projectUrl': project_link['href'],
            'links': [project_link],
        })

    return {'query': query, 'results': results, 'links': links}


def search_colonies(query='', species='', country='', limit=5):
    limit = _clamp_limit(limit)
    filters = Q()
    if query:
        filters &= (
            Q(name__icontains=query) |
            Q(species__icontains=query) |
            Q(country__icontains=query) |
            Q(biosamples__projects__name__icontains=query)
        )
    if species:
        filters &= Q(species__icontains=species)
    if country:
        filters &= Q(country__icontains=country)
    if not filters:
        filters = Q(id__isnull=False)

    colonies = Colony.objects.filter(filters).distinct().order_by('name')[:limit]
    results = [_colony_payload(colony) for colony in colonies]
    links = [link for item in results for link in item['links']]
    return {'results': results, 'links': links}


def get_project_summary(project_id):
    project = get_object_or_404(
        Project.objects.select_related('owner').prefetch_related('publications'),
        id=project_id,
    )
    colonies = (
        Colony.objects
        .filter(biosamples__projects=project)
        .distinct()
        .order_by('name')[:10]
    )
    observations_count = Observation.objects.filter(experiment__project=project).count()
    project_link = {
        'label': f'Project: {project.name}',
        'href': _project_url(project.id),
        'type': 'project',
    }
    colony_payloads = [_colony_payload(colony) for colony in colonies]
    links = [project_link] + [link for item in colony_payloads for link in item['links']]
    return {
        'id': project.id,
        'name': project.name,
        'description': project.description[:800],
        'registrationDate': project.registration_date.isoformat() if project.registration_date else None,
        'owner': project.owner.username if project.owner else None,
        'projectUrl': project_link['href'],
        'publications': [
            {
                'title': publication.title,
                'year': publication.year,
                'doi': publication.doi,
            }
            for publication in project.publications.all()[:5]
        ],
        'observationsCount': observations_count,
        'colonies': colony_payloads,
        'links': links,
    }


def get_database_overview():
    top_countries = list(
        Colony.objects.values('country').annotate(count=Count('id')).order_by('-count')[:5]
    )
    top_species = list(
        Colony.objects.values('species').annotate(count=Count('id')).order_by('-count')[:5]
    )
    return {
        'projects': Project.objects.count(),
        'colonies': Colony.objects.count(),
        'observations': Observation.objects.count(),
        'species': Colony.objects.values('species').distinct().count(),
        'countries': Colony.objects.values('country').distinct().count(),
        'topCountries': top_countries,
        'topSpecies': top_species,
        'links': [],
    }


TOOL_FUNCTIONS = {
    'find_ed_extreme': find_ed_extreme,
    'search_projects': search_projects,
    'search_colonies': search_colonies,
    'get_project_summary': get_project_summary,
    'get_database_overview': get_database_overview,
}
