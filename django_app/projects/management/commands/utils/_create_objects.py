from datetime import datetime
import pandas as pd

from projects.models import BioSample, Colony, ThermalTolerance, \
    Experiment, Observation, Project, Publication, BreakpointTemperature, ThermalLimit


def create_project(owner, project_key, description):
    if project_key == 'Voolstra et al. 2021':
        registration_date = datetime.strptime('2023-12-31', '%Y-%m-%d').date()
    elif project_key == 'Evensen et al. 2022':
        registration_date = datetime.strptime('2024-02-01', '%Y-%m-%d').date()
    elif project_key == '2022 Fiji Jareis':
        registration_date = datetime.strptime('2024-04-14', '%Y-%m-%d').date()
    else:
        registration_date = datetime.now().date()
    return Project.objects.get_or_create(
        name=project_key,
        registration_date=registration_date,
        description=description,
        owner=owner)


def create_experiment(project, experiment_key):
    return Experiment.objects.get_or_create(
        name=experiment_key[0],
        project=project,
        date=datetime.strptime(experiment_key[1], '%Y-%m-%d').date())


def create_colony(colony_key):
    return Colony.objects.get_or_create(
        name=colony_key[0],
        species=colony_key[1],
        country=colony_key[2],
        latitude=colony_key[3],
        longitude=colony_key[4])


def create_thermaltolerance(colony, ed50_value, condition=None, timepoint=None):
    if ed50_value is None:
        return None, False
    # Ensure timepoint is a string
    if timepoint is not None:
        timepoint = str(timepoint)
    return ThermalTolerance.objects.get_or_create(
        colony=colony,
        condition=condition,
        timepoint=timepoint,
        abs_thermal_tolerance=ed50_value,
        defaults={
            'abs_thermal_tolerance': ed50_value,
            'condition': condition,
            'timepoint': timepoint
        })


def create_breakpointtemperature(colony, ed5_value, condition=None, timepoint=None):
    if ed5_value is None:
        return None, False
    # Ensure timepoint is a string
    if timepoint is not None:
        timepoint = str(timepoint)
    return BreakpointTemperature.objects.get_or_create(
        colony=colony,
        condition=condition,
        timepoint=timepoint,
        abs_breakpoint_temperature=ed5_value,
        defaults={
            'abs_breakpoint_temperature': ed5_value,
            'condition': condition,
            'timepoint': timepoint
        })


def create_thermallimit(colony, ed95_value, condition=None, timepoint=None):
    if ed95_value is None:
        return None, False
    # Ensure timepoint is a string
    if timepoint is not None:
        timepoint = str(timepoint)
    return ThermalLimit.objects.get_or_create(
        colony=colony,
        condition=condition,
        timepoint=timepoint,
        abs_thermal_limit=ed95_value,
        defaults={
            'abs_thermal_limit': ed95_value,
            'condition': condition,
            'timepoint': timepoint
        })


def create_biosample(colony, biosample_key):
    return BioSample.objects.get_or_create(
        name=biosample_key[0],
        collection_date=biosample_key[1],
        colony=colony)


def create_observation(experiment, biosample, row):
    return Observation.objects.get_or_create(
        experiment=experiment,
        biosample=biosample,
        condition=row['Observation.condition'],
        temperature=row['Observation.temperature'],
        timepoint=str(row['Observation.timepoint']) if not pd.isna(row['Observation.timepoint']) else "",
        pam_value=row['Observation.pam_value'])


def create_publication(row):
    return Publication.objects.get_or_create(
        title=row['Publication.title'],
        year=row['Publication.year'],
        doi=row['Publication.doi'])
