import subprocess
import sys

import pandas as pd
from django.core.management.base import BaseCommand
from projects.models import Colony


class Command(BaseCommand):
    help = 'Extract the maximum monthly mean (MMM) and assign to colonies'

    def handle(self, *args, **kwargs):

        coordinates_file = "/tmp/coordinates.tsv"
        sst_clim_mmm_file = "/tmp/sst_clim_mmm.tsv"

        colonies = Colony.objects.all()

        self.get_colony_coords(colonies, coordinates_file)
        self.get_sst_clim_mmm(coordinates_file, sst_clim_mmm_file)
        self.populate_db_with_mmm(colonies, sst_clim_mmm_file)

    def get_colony_coords(self, colonies, outfile):
        coordinates = set(
            [(colony.latitude, colony.longitude) for colony in colonies])

        # cwsample expects: latitude longitude (no headers, tab-separated)
        with open(outfile, 'w') as f:
            for lat, lon in coordinates:
                f.write(f"{lat}\t{lon}\n")
        
        self.stdout.write(
            self.style.SUCCESS(f'Coordinates saved to {outfile}'))

    def get_sst_clim_mmm(self, infile, outfile):
        command = f'cwsample -H -V sst_clim_mmm -S {infile} /usr/src/ct5km_climatology_v3.1.nc {outfile}'

        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        if process.returncode == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Command executed successfully! Output file: {outfile}'))
        else:
            self.stdout.write(self.style.ERROR(
                f'Error executing command: {stderr.decode("utf-8")}'))
            raise Exception(f'cwsample command failed: {stderr.decode("utf-8")}')



    def populate_db_with_mmm(self, colonies, infile):
        try:
            df = pd.read_csv(infile, sep='\t')
        except:
            # Fallback to whitespace delimiter
            df = pd.read_csv(infile, delim_whitespace=True)
        
        # Debug: show columns
        self.stdout.write(f"Columns in SST file: {list(df.columns)}")
        self.stdout.write(f"First row: {df.iloc[0].to_dict()}")
        
        # cwsample returns single column with space-separated values
        if len(df.columns) == 1 and ' ' in df.columns[0]:
            # Split the single column into separate columns
            col_name = df.columns[0]
            df[['latitude', 'longitude', 'sst_clim_mmm']] = df[col_name].str.split(' ', expand=True)
            df = df[['latitude', 'longitude', 'sst_clim_mmm']]
            # Convert to numeric
            df['latitude'] = pd.to_numeric(df['latitude'])
            df['longitude'] = pd.to_numeric(df['longitude'])
            df['sst_clim_mmm'] = pd.to_numeric(df['sst_clim_mmm'])
        
        for index, row in df.iterrows():
            latitude = row['latitude']
            longitude = row['longitude']
            sst_clim_mmm = row['sst_clim_mmm']

            # Find colonies with matching coordinates (with tolerance for floating point)
            matching_colonies = []
            for colony in colonies:
                if (abs(colony.latitude - latitude) < 0.001 and 
                    abs(colony.longitude - longitude) < 0.001):
                    matching_colonies.append(colony)

            # Assign MMM to each matching Colony object
            for colony in matching_colonies:
                # ThermalTolerance
                for thermal_tolerance in colony.thermal_tolerances.all():
                    thermal_tolerance._sst_clim_mmm = sst_clim_mmm
                    # Special case for Red Sea coordinates
                    if (abs(colony.latitude - 29.5) < 0.1 and 
                        abs(colony.longitude - 34.9) < 0.1):
                        thermal_tolerance._sst_clim_mmm = 27.01
                    thermal_tolerance.save()

                # BreakpointTemperature
                for breakpoint in colony.breakpoint_temperatures.all():
                    breakpoint._sst_clim_mmm = sst_clim_mmm
                    if (abs(colony.latitude - 29.5) < 0.1 and 
                        abs(colony.longitude - 34.9) < 0.1):
                        breakpoint._sst_clim_mmm = 27.01
                    breakpoint.save()

                # ThermalLimit
                for thermal_limit in colony.thermal_limits.all():
                    thermal_limit._sst_clim_mmm = sst_clim_mmm
                    if (abs(colony.latitude - 29.5) < 0.1 and 
                        abs(colony.longitude - 34.9) < 0.1):
                        thermal_limit._sst_clim_mmm = 27.01
                    thermal_limit.save()

                self.stdout.write(
                    f'MMM {sst_clim_mmm} assigned to colony: {colony.name}')
