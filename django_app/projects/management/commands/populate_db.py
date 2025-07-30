import os
import sys
import pandas as pd
import json
import re

from django.core.management.base import BaseCommand

from users.models import CustomUser
from projects.models import BioSample, Observation

from projects.management.commands.utils._create_objects import (
    create_biosample, create_colony, create_thermaltolerance, create_experiment,
    create_observation, create_project, create_publication,
    create_breakpointtemperature, create_thermallimit)

from projects.management.commands.utils._validate_datasheet import validate_datasheet

# New: smart column auto-mapper using DeepSeek/OpenAI
from projects.management.commands.utils.column_auto_mapper import (
    map_and_transform_dataframe,
)


class Command(BaseCommand):
    help = 'Parse CSV and create instances in Django models.'

    def add_arguments(self, parser):
        parser.add_argument('--csv_path', type=str, required=True,
                            help='Path to the input CSV file')
        parser.add_argument('--owner', type=str, required=True,
                            help='Username of the owner for the datasheet')
        parser.add_argument('--no-pam', action='store_true',
                            help='Flag to indicate no PAM values are provided')

    def handle(self, *args, **kwargs):
        csv_path = kwargs['csv_path']
        owner_username = kwargs['owner']
        use_pam = not kwargs['no_pam']

        try:
            owner = CustomUser.objects.get(username=owner_username)
        except CustomUser.DoesNotExist:
            sys.stdout.write(f"User '{owner_username}' does not exist.\n")
            return

        try:
            df_raw = pd.read_csv(csv_path)
        except FileNotFoundError:
            sys.stdout.write(f"CSV file not found at '{csv_path}'.\n")
            return

        # --------------------------------------------------------------
        # 1. Auto-map raw dataframe to standard schema columns
        # --------------------------------------------------------------
        try:
            result = map_and_transform_dataframe(df_raw, return_instructions=True)
            df_std, mapping_instructions = result
        except Exception as e:
            sys.stdout.write(f"❌ Column auto-mapping failed: {e}\n")
            return

        # Temporary compatibility: validator expects 'Colony.ed50_value'
        if 'Colony.ed50_value' not in df_std.columns and 'Colony.ed50' in df_std.columns:
            df_std['Colony.ed50_value'] = df_std['Colony.ed50']

        # --------------------------------------------------------------
        # Normalize date fields (numeric YYYYMMDD -> YYYY-MM-DD strings)
        # --------------------------------------------------------------
        def _normalize_date_val(val):
            if pd.isna(val):
                return None
            # If value is numeric (int/float) like 20221114.0
            if isinstance(val, (int, float)):
                val_str = str(int(val))  # drop decimals
            else:
                val_str = str(val)

            val_str = val_str.strip()
            if re.match(r"^\d{8}$", val_str):
                return f"{val_str[0:4]}-{val_str[4:6]}-{val_str[6:8]}"
            return val_str  # return as-is if already formatted

        for date_col in ['Experiment.date', 'BioSample.collection_date']:
            if date_col in df_std.columns:
                df_std[date_col] = df_std[date_col].apply(_normalize_date_val)

        # --------------------------------------------------------------
        # 2. Save mapping + transformed dataset for audit
        # --------------------------------------------------------------
        logs_dir = os.path.join(os.path.dirname(csv_path), "import_logs")
        os.makedirs(logs_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(csv_path))[0]

        mapping_path = os.path.join(logs_dir, f"{base_name}_mapping.json")
        reformatted_path = os.path.join(logs_dir, f"{base_name}_reformatted.json")

        try:
            with open(mapping_path, "w", encoding="utf-8") as mp:
                json.dump(mapping_instructions, mp, indent=2)

            df_std.to_json(reformatted_path, orient="records", lines=True, force_ascii=False)
            sys.stdout.write(f"📝 Saved mapping to {mapping_path}\n")
            sys.stdout.write(f"📝 Saved reformatted data to {reformatted_path}\n")
        except Exception as save_exc:
            sys.stdout.write(f"⚠️ Could not save audit files: {save_exc}\n")

        # --------------------------------------------------------------
        # 3. Validate transformed dataframe & create DB instances
        # --------------------------------------------------------------
        validate_datasheet(df_std)
        self.create_instances(df_std, owner, csv_path, use_pam)

    def create_instances(self, df, owner, csv_path, use_pam):
        for _, row in df.iterrows():
            project, created = create_project(
                owner, row['Project.name'],
                description=f'Datasheet {os.path.basename(csv_path)}')

            sys.stdout.write(f"Project: {project}, created: {created}\n")

            experiment, created = create_experiment(project, (
                row['Experiment.name'], row['Experiment.date']))
            sys.stdout.write(f"Experiment: {experiment}, created: {created}\n")

            colony, created = create_colony((row['Colony.name'],
                                             row['Colony.species'],
                                             row['Colony.country'],
                                             row['Colony.latitude'],
                                             row['Colony.longitude']))
            sys.stdout.write(f"Colony: {colony}, created: {created}\n")

            # Create ED50 (Thermal Tolerance)
            thermal_tolerance, created = create_thermaltolerance(
                colony=colony,
                ed50_value=row['Colony.ed50_value'] if not pd.isnull(
                    row['Colony.ed50_value']) else None,
                condition=row['Observation.condition'],
                timepoint=str(row['Observation.timepoint']) if not pd.isnull(row['Observation.timepoint']) else None
            )
            
            # Create ED5 (Breakpoint Temperature) if available
            if 'Colony.ed5' in row and not pd.isnull(row['Colony.ed5']):
                breakpoint_temp, created = create_breakpointtemperature(
                    colony=colony,
                    ed5_value=row['Colony.ed5'],
                    condition=row['Observation.condition'],
                    timepoint=str(row['Observation.timepoint']) if not pd.isnull(row['Observation.timepoint']) else None
                )
                sys.stdout.write(f"Breakpoint Temperature (ED5): {breakpoint_temp}, created: {created}\n")
            
            # Create ED95 (Thermal Limit) if available
            if 'Colony.ed95' in row and not pd.isnull(row['Colony.ed95']):
                thermal_limit, created = create_thermallimit(
                    colony=colony,
                    ed95_value=row['Colony.ed95'],
                    condition=row['Observation.condition'],
                    timepoint=str(row['Observation.timepoint']) if not pd.isnull(row['Observation.timepoint']) else None
                )
                sys.stdout.write(f"Thermal Limit (ED95): {thermal_limit}, created: {created}\n")

            if use_pam:
                biosample, created = create_biosample(colony, (
                    row['BioSample.name'], row['BioSample.collection_date']))
                sys.stdout.write(
                    f"Biosample: {biosample}, created: {created}\n")

                observation, created = create_observation(experiment, biosample,
                                                          row)
                sys.stdout.write(
                    f"Observation: {observation}, created: {created}\n")

                publication, created = create_publication(row)
                sys.stdout.write(
                    f"Publication: {publication}, created: {created}\n")

                publication.biosamples.add(biosample)
                project.publications.add(publication)
                project.biosamples.add(biosample)
                
                # Add observation to thermal metrics
                if thermal_tolerance:
                    thermal_tolerance.observations.add(observation)
                
                # Add observations to ED5 and ED95 objects if they were created
                if 'Colony.ed5' in row and not pd.isnull(row['Colony.ed5']) and 'breakpoint_temp' in locals():
                    breakpoint_temp.observations.add(observation)
                
                if 'Colony.ed95' in row and not pd.isnull(row['Colony.ed95']) and 'thermal_limit' in locals():
                    thermal_limit.observations.add(observation)
            else:
                for temp in [30, 33, 36, 39]:
                    biosample, created = BioSample.objects.get_or_create(
                        name=f"{colony.name}-{temp}",
                        collection_date=experiment.date,
                        colony=colony
                    )
                    sys.stdout.write(
                        f"Biosample: {biosample}, created: {created}\n")

                    observation, created = Observation.objects.get_or_create(
                        experiment=experiment,
                        biosample=biosample,
                        condition=row['Observation.condition'],
                        temperature=temp,
                        timepoint=row['Observation.timepoint'],
                    )
                    sys.stdout.write(
                        f"Observation: {observation}, created: {created}\n")

                    publication, created = create_publication(row)
                    sys.stdout.write(
                        f"Publication: {publication}, created: {created}\n")

                    publication.biosamples.add(biosample)
                    project.publications.add(publication)
                    project.biosamples.add(biosample)
                    
                    # Add observation to thermal metrics
                    if thermal_tolerance:
                        thermal_tolerance.observations.add(observation)
                    
                    # Add observations to ED5 and ED95 objects if they were created
                    if 'Colony.ed5' in row and not pd.isnull(row['Colony.ed5']) and 'breakpoint_temp' in locals():
                        breakpoint_temp.observations.add(observation)
                    
                    if 'Colony.ed95' in row and not pd.isnull(row['Colony.ed95']) and 'thermal_limit' in locals():
                        thermal_limit.observations.add(observation)
