from django.core.management.base import BaseCommand
from projects.models import Colony, ThermalTolerance, BioSample, Project


class Command(BaseCommand):
    help = 'Check colony by ID or name: thermal tolerances and project links'

    def add_arguments(self, parser):
        parser.add_argument('colony', type=str, help='Colony ID or name (e.g. 5278 or Saadiyat_Platygyra_daedalea_10)')

    def handle(self, *args, **options):
        arg = options['colony']
        if arg.isdigit():
            try:
                c = Colony.objects.get(id=int(arg))
            except Colony.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Colony id={arg} not found'))
                return
        else:
            colonies = Colony.objects.filter(name=arg)
            if not colonies.exists():
                self.stdout.write(self.style.ERROR(f'Colony name="{arg}" not found'))
                return
            if colonies.count() > 1:
                self.stdout.write(self.style.WARNING(f'Multiple colonies with name "{arg}":'))
            c = colonies.first()

        self.stdout.write(f'Colony: {c.name} (ID: {c.id})')
        self.stdout.write(f'Species: {c.species}')
        self.stdout.write(f'Coordinates: {c.latitude}, {c.longitude}')
        self.stdout.write('')

        tts = c.thermal_tolerances.all()
        self.stdout.write(f'Thermal Tolerances: {tts.count()} record(s)')
        for tt in tts:
            self.stdout.write(f'  TT id={tt.id} condition={tt.condition} timepoint={tt.timepoint} abs_ED50={tt.abs_thermal_tolerance}')
        self.stdout.write('')

        biosamples = c.biosamples.all()
        self.stdout.write(f'BioSamples: {biosamples.count()}')
        project_ids = set()
        for bs in biosamples:
            for obs in bs.observations.all():
                if obs.experiment and obs.experiment.project_id:
                    project_ids.add(obs.experiment.project_id)
        for p in Project.objects.filter(biosamples__colony=c):
            project_ids.add(p.id)
        if project_ids:
            self.stdout.write(f'Projects linked: {sorted(project_ids)}')
            for pid in sorted(project_ids):
                p = Project.objects.get(id=pid)
                self.stdout.write(f'  - {p.name} (id={p.id})')
        else:
            self.stdout.write(self.style.WARNING('Projects linked: NONE (colony not attached to any project)'))
