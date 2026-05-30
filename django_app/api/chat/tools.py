from django.db.models import Avg, Count, Max, Min, Q
from django.shortcuts import get_object_or_404

from api.chat.bleaching_data import (
    aggregate_bleaching_observations,
    collect_bleaching_near_colonies,
    filter_observations_by_countries,
    global_bleaching_overview,
    load_bleaching_features,
    resolve_bleaching_country_names,
    SEVERITY_LABELS,
)
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


def _map_url(colony, zoom=12, bleaching_year=None):
    url = f'/map?colony={colony.id}&lng={colony.longitude}&lat={colony.latitude}&zoom={zoom}'
    if bleaching_year is not None:
        url += f'&bleachingYear={int(bleaching_year)}'
    return url


def _project_map_url(project, colonies, bleaching_year=None):
    points = [c for c in colonies if c.latitude is not None and c.longitude is not None]
    if not points:
        return _project_url(project.id)
    lng = sum(c.longitude for c in points) / len(points)
    lat = sum(c.latitude for c in points) / len(points)
    from urllib.parse import quote

    url = f'/map?lng={lng:.6f}&lat={lat:.6f}&zoom=10&project={quote(project.name)}'
    if bleaching_year is not None:
        url += f'&bleachingYear={int(bleaching_year)}'
    return url


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
    geolocated = [c for c in colonies if c.latitude is not None and c.longitude is not None]
    bleaching_block = _bleaching_payload_for_project(project, colonies, geolocated, list(links))
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
        'bleachingSurveysNearProject': bleaching_block,
        'links': bleaching_block.get('links', links),
    }


def get_bleaching_overview():
    """Global bleaching survey coverage and counts by year."""
    if not load_bleaching_features():
        return {
            'error': 'Bleaching observation dataset is not available on this server.',
            'links': [],
        }
    summary = global_bleaching_overview()
    return {
        **summary,
        'links': [{
            'label': 'Open global map (bleaching layer)',
            'href': '/map?bleachingYear={}'.format(
                summary['byYear'][-1]['year'] if summary.get('byYear') else 2005
            ),
            'type': 'map',
        }],
    }


def _bleaching_payload_for_project(project, colonies, geolocated, links):
    """Shared bleaching survey block for project tools."""
    project_countries = sorted({c.country for c in colonies if c.country})
    project_link = {
        'label': f'Project: {project.name}',
        'href': _project_url(project.id),
        'type': 'project',
    }

    if not load_bleaching_features():
        return {
            'available': False,
            'error': 'Bleaching observation dataset is not available on this server.',
            'projectCountries': project_countries,
            'resolvedBleachingCountries': resolve_bleaching_country_names(project_countries),
            'links': links,
        }

    collected = collect_bleaching_near_colonies(
        geolocated,
        project_countries=project_countries,
        padding_deg=0.75,
    )
    observations = collected['combined']
    bleaching = aggregate_bleaching_observations(observations)
    bleaching_bbox = aggregate_bleaching_observations(collected['byBoundingBox'])
    bleaching_countries = aggregate_bleaching_observations(collected['byCountries'])

    peak_year = None
    if bleaching.get('byYear'):
        peak_year = max(bleaching['byYear'], key=lambda row: row['count'])['year']
        links.append({
            'label': f'Open map — bleaching {peak_year} (project region)',
            'href': _project_map_url(project, geolocated, peak_year),
            'type': 'map',
        })

    bleaching_country_set = {
        row['country'] for row in bleaching.get('countriesInBleachingData', [])
        if row.get('country') and row['country'] != 'Unknown'
    }
    resolved = collected['resolvedCountries']
    overlap_countries = sorted(
        set(resolved) & bleaching_country_set
        | {c for c in project_countries if c in bleaching_country_set}
    )

    sample_sites = []
    severe = [o for o in observations if o.get('severity') == 3]
    sample_pool = severe if severe else observations
    for obs in sorted(sample_pool, key=lambda o: o['year'], reverse=True)[:8]:
        sample_sites.append({
            'year': obs['year'],
            'severity': SEVERITY_LABELS.get(obs['severity'], 'Unknown'),
            'site': obs.get('site') or None,
            'country': obs.get('country') or None,
        })

    return {
        'available': True,
        'dataSource': 'BleachingDataBase.csv (independent survey records, not linked to project colonies in ORM)',
        'searchMethod': (
            'Combined spatial filter (bounding box around geolocated colonies) and country/region filter '
            '(colony country labels mapped to BleachingDataBase COUNTRY names, e.g. Persian Arabian Gulf → Bahrain, UAE, Oman, Iran, Kuwait, Saudi Arabia, Qatar).'
        ),
        'projectCountries': project_countries,
        'resolvedBleachingCountries': resolved,
        'regionBounds': collected['boundingBox'],
        'recordsInBoundingBox': collected['boundingBoxCount'],
        'recordsByCountryFilter': collected['countryFilterCount'],
        'bleachingNearProject': bleaching,
        'bleachingByBoundingBoxOnly': bleaching_bbox,
        'bleachingByCountryFilterOnly': bleaching_countries,
        'peakBleachingYearByRecordCount': peak_year,
        'countryOverlap': {
            'projectCountries': project_countries,
            'bleachingSurveyCountries': sorted(bleaching_country_set),
            'sharedCountries': overlap_countries,
        },
        'sampleBleachingRecords': sample_sites,
        'links': links,
    }


def get_project_bleaching_analysis(project_id):
    """
    Bleaching survey records near a project's colonies, with project thermal context.
    """
    project = get_object_or_404(Project.objects.select_related('owner'), id=project_id)
    colonies = list(
        Colony.objects
        .filter(biosamples__projects=project)
        .distinct()
        .order_by('name')
    )
    geolocated = [c for c in colonies if c.latitude is not None and c.longitude is not None]

    links = [{
        'label': f'Project: {project.name}',
        'href': _project_url(project.id),
        'type': 'project',
    }]

    bleaching_block = _bleaching_payload_for_project(project, colonies, geolocated, links)

    ed50_stats = (
        ThermalTolerance.objects
        .filter(colony__in=colonies)
        .exclude(abs_thermal_tolerance__isnull=True)
        .aggregate(
            count=Count('id'),
            minEd50=Min('abs_thermal_tolerance'),
            maxEd50=Max('abs_thermal_tolerance'),
            meanEd50=Avg('abs_thermal_tolerance'),
        )
    )

    project_species = sorted({c.species for c in colonies if c.species})

    return {
        'projectId': project.id,
        'projectName': project.name,
        'description': (project.description or '')[:500],
        'projectUrl': links[0]['href'],
        'colonyCount': len(colonies),
        'geolocatedColonyCount': len(geolocated),
        'projectSpecies': project_species[:15],
        'experimentObservationsCount': Observation.objects.filter(experiment__project=project).count(),
        'thermalToleranceEd50': {
            'recordCount': ed50_stats['count'],
            'minCelsius': ed50_stats['minEd50'],
            'maxCelsius': ed50_stats['maxEd50'],
            'meanCelsius': round(ed50_stats['meanEd50'], 3) if ed50_stats['meanEd50'] is not None else None,
        },
        **bleaching_block,
        'interpretationNotes': (
            'Bleaching rows are independent ReefBase/BleachingDataBase survey points near the project region, '
            'not CBASS colony measurements. Use bleachingNearProject.byYear for trends; compare with thermalToleranceEd50 qualitatively.'
        ),
        'links': bleaching_block.get('links', links),
    }


def get_project_bleaching_by_name(project_name):
    """Resolve project by name (partial match) and return bleaching analysis."""
    query = (project_name or '').strip()
    if not query:
        return {'error': 'project_name is required', 'links': []}
    project = (
        Project.objects
        .filter(name__icontains=query)
        .order_by('name')
        .first()
    )
    if not project:
        return {'error': f'No project matching "{query}".', 'links': []}
    return get_project_bleaching_analysis(project.id)


def search_bleaching_by_country(country, limit=10):
    """Bleaching survey summary for a country name (exact match, case-insensitive)."""
    country = (country or '').strip()
    if not country:
        return {'error': 'country is required', 'links': []}
    if not load_bleaching_features():
        return {'error': 'Bleaching observation dataset is not available.', 'links': []}

    observations = filter_observations_by_countries([country])
    summary = aggregate_bleaching_observations(observations)
    links = [{
        'label': f'Open map — {country}',
        'href': '/map',
        'type': 'map',
    }]
    peak_year = None
    if summary.get('byYear'):
        peak_year = max(summary['byYear'], key=lambda row: row['count'])['year']
        links[0]['href'] = f'/map?bleachingYear={peak_year}'

    return {
        'country': country,
        'filterNote': 'Country match is case-insensitive and allows partial names (e.g. Australia, UAE).',
        **summary,
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
    'get_bleaching_overview': get_bleaching_overview,
    'get_project_bleaching_analysis': get_project_bleaching_analysis,
    'get_project_bleaching_by_name': get_project_bleaching_by_name,
    'search_bleaching_by_country': search_bleaching_by_country,
}
