"""
Import backup.json into the current database.

Backup may contain the old model 'projects.projected50attachment' (ED50 Attachment)
with fields: boxplot_image, temperature_curve_image, model_curve_image,
aggregated_statistics, individual_eds, calculation_params, description, created_by, etc.
These are mapped to the current 'projects.attachment' model:
  boxplot_image -> boxplot (path only; file may be missing)
  temperature_curve_image -> temp_curve
  model_curve_image -> model_curve
  aggregated_statistics -> statistics
  description -> description
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from users.models import CustomUser
from projects.models import (
    Publication,
    Project,
    Experiment,
    Colony,
    BioSample,
    Observation,
    ThermalTolerance,
    BreakpointTemperature,
    ThermalLimit,
    Attachment,
    CartGroup,
    CartItem,
)


def group_by_model(data):
    groups = {}
    for obj in data:
        m = obj['model']
        if m not in groups:
            groups[m] = []
        groups[m].append(obj)
    return groups


class Command(BaseCommand):
    help = (
        'Import backup.json into DB. Maps projects.projected50attachment (ED50 Attachment) '
        'to projects.attachment. Put backup.json in django_app/ or pass --file with path visible in container.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='backup.json',
            help='Path to backup JSON file (default: backup.json)',
        )
        parser.add_argument(
            '--flush-projects',
            action='store_true',
            help='Delete all projects app data before importing (recommended for clean import)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only show what would be imported, do not write to DB',
        )

    def handle(self, *args, **options):
        path = Path(options['file'])
        if not path.is_absolute():
            # Try cwd first, then project root (parent of django_app)
            cwd_path = Path.cwd() / path
            root_path = Path(__file__).resolve().parents[4] / path
            path = cwd_path if cwd_path.exists() else root_path
        if not path.exists():
            self.stderr.write(self.style.ERROR(f'File not found: {path}'))
            return

        self.stdout.write(f'Loading {path}...')
        with open(path) as f:
            data = json.load(f)

        groups = group_by_model(data)

        # Models we support
        def get(model_name, default=None):
            return groups.get(model_name, default or [])

        publications = get('projects.publication')
        projects = get('projects.project')
        experiments = get('projects.experiment')
        colonies = get('projects.colony')
        biosamples = get('projects.biosample')
        observations = get('projects.observation')
        thermal_tolerances = get('projects.thermaltolerance')
        breakpoint_temperatures = get('projects.breakpointtemperature')
        thermal_limits = get('projects.thermallimit')
        ed50_attachments = get('projects.projected50attachment')
        users_backup = get('users.customuser')

        self.stdout.write(
            f'Backup: {len(users_backup)} users, {len(publications)} publications, {len(projects)} projects, '
            f'{len(experiments)} experiments, {len(colonies)} colonies, '
            f'{len(biosamples)} biosamples, {len(observations)} observations, '
            f'{len(thermal_tolerances)} thermal_tolerances, {len(breakpoint_temperatures)} breakpoint_temperatures, '
            f'{len(thermal_limits)} thermal_limits, {len(ed50_attachments)} projected50attachment'
        )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run: no changes written.'))
            return

        with transaction.atomic():
            if options['flush_projects']:
                self._flush_projects()
                self._flush_users()

            # After flush: import users from backup so project owners exist
            users_backup = get('users.customuser')
            for obj in users_backup:
                pk = obj['pk']
                f = obj['fields']
                CustomUser.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'username': f.get('username') or f'user_{pk}',
                        'email': f.get('email') or f'user{pk}@imported.local',
                        'first_name': f.get('first_name') or '',
                        'last_name': f.get('last_name') or '',
                        'password': f.get('password') or '!',
                        'is_superuser': f.get('is_superuser', False),
                        'is_staff': f.get('is_staff', False),
                        'is_active': f.get('is_active', True),
                        'date_joined': f.get('date_joined'),
                        'last_login': f.get('last_login'),
                    },
                )

            # Create in dependency order, preserving PKs
            id_map = {}  # (model, old_pk) -> new_instance (if we ever remap)

            for obj in publications:
                pk = obj['pk']
                f = obj['fields']
                pub, _ = Publication.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'title': f.get('title') or '',
                        'year': f.get('year') or 0,
                        'doi': f.get('doi') or 'No doi available',
                    },
                )
                id_map[('publication', pk)] = pub

            for obj in projects:
                pk = obj['pk']
                f = obj['fields']
                proj, _ = Project.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'name': f.get('name') or '',
                        'registration_date': f.get('registration_date'),
                        'description': f.get('description') or '',
                        'owner_id': f.get('owner'),
                    },
                )
                id_map[('project', pk)] = proj

            for obj in experiments:
                pk = obj['pk']
                f = obj['fields']
                proj_id = f.get('project')
                if proj_id is None or not Project.objects.filter(pk=proj_id).exists():
                    continue
                Experiment.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'project_id': proj_id,
                        'name': f.get('name') or '',
                        'date': f.get('date'),
                    },
                )

            for obj in colonies:
                pk = obj['pk']
                f = obj['fields']
                Colony.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'name': f.get('name') or '',
                        'species': f.get('species') or '',
                        'country': (f.get('country') or '')[:10],
                        'latitude': float(f.get('latitude', 0)),
                        'longitude': float(f.get('longitude', 0)),
                    },
                )

            for obj in biosamples:
                pk = obj['pk']
                f = obj['fields']
                colony_id = f.get('colony')
                if colony_id is None or not Colony.objects.filter(pk=colony_id).exists():
                    continue
                BioSample.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'name': f.get('name') or '',
                        'collection_date': f.get('collection_date'),
                        'colony_id': colony_id,
                    },
                )

            for obj in observations:
                pk = obj['pk']
                f = obj['fields']
                exp_id = f.get('experiment')
                bio_id = f.get('biosample')
                if exp_id is None or bio_id is None:
                    continue
                if not Experiment.objects.filter(pk=exp_id).exists() or not BioSample.objects.filter(pk=bio_id).exists():
                    continue
                Observation.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'experiment_id': exp_id,
                        'biosample_id': bio_id,
                        'condition': f.get('condition') or '',
                        'temperature': int(f.get('temperature', 0)),
                        'timepoint': str(f.get('timepoint') or ''),
                        'pam_value': f.get('pam_value'),
                    },
                )

            # Project M2M: publications, biosamples
            for obj in projects:
                proj = Project.objects.filter(pk=obj['pk']).first()
                if not proj:
                    continue
                f = obj['fields']
                pub_ids = f.get('publications') or []
                bio_ids = f.get('biosamples') or []
                proj.publications.set(Publication.objects.filter(pk__in=pub_ids))
                proj.biosamples.set(BioSample.objects.filter(pk__in=bio_ids))

            # Publication M2M: biosamples
            for obj in publications:
                pub = Publication.objects.filter(pk=obj['pk']).first()
                if not pub:
                    continue
                bio_ids = obj['fields'].get('biosamples') or []
                pub.biosamples.set(BioSample.objects.filter(pk__in=bio_ids))

            # Thermal* with observations M2M
            for obj in thermal_tolerances:
                pk = obj['pk']
                f = obj['fields']
                colony_id = f.get('colony')
                if colony_id is None or not Colony.objects.filter(pk=colony_id).exists():
                    continue
                tt, _ = ThermalTolerance.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'colony_id': colony_id,
                        'condition': f.get('condition') or '',
                        'timepoint': f.get('timepoint') or '',
                        'abs_thermal_tolerance': f.get('abs_thermal_tolerance'),
                        'rel_thermal_tolerance': f.get('rel_thermal_tolerance'),
                        '_sst_clim_mmm': f.get('_sst_clim_mmm'),
                    },
                )
                obs_ids = f.get('observations') or []
                tt.observations.set(Observation.objects.filter(pk__in=obs_ids))

            for obj in breakpoint_temperatures:
                pk = obj['pk']
                f = obj['fields']
                colony_id = f.get('colony')
                if colony_id is None or not Colony.objects.filter(pk=colony_id).exists():
                    continue
                bt, _ = BreakpointTemperature.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'colony_id': colony_id,
                        'condition': f.get('condition') or '',
                        'timepoint': f.get('timepoint') or '',
                        'abs_breakpoint_temperature': f.get('abs_breakpoint_temperature'),
                        'rel_breakpoint_temperature': f.get('rel_breakpoint_temperature'),
                        '_sst_clim_mmm': f.get('_sst_clim_mmm'),
                    },
                )
                obs_ids = f.get('observations') or []
                bt.observations.set(Observation.objects.filter(pk__in=obs_ids))

            for obj in thermal_limits:
                pk = obj['pk']
                f = obj['fields']
                colony_id = f.get('colony')
                if colony_id is None or not Colony.objects.filter(pk=colony_id).exists():
                    continue
                tl, _ = ThermalLimit.objects.get_or_create(
                    pk=pk,
                    defaults={
                        'colony_id': colony_id,
                        'condition': f.get('condition') or '',
                        'timepoint': f.get('timepoint') or '',
                        'abs_thermal_limit': f.get('abs_thermal_limit'),
                        'rel_thermal_limit': f.get('rel_thermal_limit'),
                        '_sst_clim_mmm': f.get('_sst_clim_mmm'),
                    },
                )
                obs_ids = f.get('observations') or []
                tl.observations.set(Observation.objects.filter(pk__in=obs_ids))

            # ED50 Attachment -> Attachment (one per project; last record wins)
            for obj in ed50_attachments:
                f = obj['fields']
                project_id = f.get('project')
                if project_id is None or not Project.objects.filter(pk=project_id).exists():
                    continue
                attachment, _ = Attachment.objects.get_or_create(
                    project_id=project_id,
                    defaults={'additional_links': []},
                )
                # Map ED50 fields to current Attachment
                attachment.statistics = f.get('aggregated_statistics')
                attachment.description = f.get('description') or ''
                if f.get('boxplot_image'):
                    attachment.boxplot = f.get('boxplot_image')
                if f.get('temperature_curve_image'):
                    attachment.temp_curve = f.get('temperature_curve_image')
                if f.get('model_curve_image'):
                    attachment.model_curve = f.get('model_curve_image')
                attachment.save()

        self.stdout.write(self.style.SUCCESS('Import finished.'))

    def _flush_projects(self):
        """Delete projects app data in reverse dependency order."""
        Observation.objects.all().delete()
        ThermalTolerance.objects.all().delete()
        BreakpointTemperature.objects.all().delete()
        ThermalLimit.objects.all().delete()
        CartItem.objects.all().delete()
        CartGroup.objects.all().delete()
        BioSample.objects.all().delete()
        Colony.objects.all().delete()
        Experiment.objects.all().delete()
        Attachment.objects.all().delete()
        Project.objects.all().delete()
        Publication.objects.all().delete()
        self.stdout.write('Flushed projects app data.')

    def _flush_users(self):
        """Delete all users (so they can be re-imported from backup)."""
        CustomUser.objects.all().delete()
        self.stdout.write('Flushed users.')
