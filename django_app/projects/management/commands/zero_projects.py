"""
Обнулить данные приложения projects в текущей БД.
Удаляет все: Publication, Project, Experiment, Colony, BioSample, Observation,
ThermalTolerance, BreakpointTemperature, ThermalLimit, Attachment, CartGroup, CartItem.
Пользователи (users) не трогаются.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from projects.models import (
    Observation,
    ThermalTolerance,
    BreakpointTemperature,
    ThermalLimit,
    CartItem,
    CartGroup,
    BioSample,
    Colony,
    Experiment,
    Attachment,
    Project,
    Publication,
)


class Command(BaseCommand):
    help = 'Обнулить данные projects в текущей БД (без импорта).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Не спрашивать подтверждение',
        )

    def handle(self, *args, **options):
        if not options['no_input']:
            confirm = input('Удалить все данные projects? (yes/no): ')
            if confirm.lower() not in ('yes', 'y'):
                self.stdout.write('Отменено.')
                return

        with transaction.atomic():
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

        self.stdout.write(self.style.SUCCESS('Данные projects обнулены.'))
