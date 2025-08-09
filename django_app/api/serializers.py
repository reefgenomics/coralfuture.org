from rest_framework import serializers

from projects.models import BioSample, Colony, ThermalTolerance, \
    Observation, Project, BreakpointTemperature, ThermalLimit


class BioSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BioSample
        fields = '__all__'


class ThermalToleranceSerializer(serializers.ModelSerializer):
    colony_name = serializers.CharField(source='colony.name', read_only=True)
    sst_clim_mmm = serializers.FloatField(source='_sst_clim_mmm', read_only=True)

    class Meta:
        model = ThermalTolerance
        fields = ['colony_name', 'abs_thermal_tolerance',
                  'rel_thermal_tolerance', 'sst_clim_mmm',
                  'condition', 'timepoint']


class BreakpointTemperatureSerializer(serializers.ModelSerializer):
    colony_name = serializers.CharField(source='colony.name', read_only=True)
    sst_clim_mmm = serializers.FloatField(source='_sst_clim_mmm', read_only=True)

    class Meta:
        model = BreakpointTemperature
        fields = ['colony_name', 'abs_breakpoint_temperature',
                  'rel_breakpoint_temperature', 'sst_clim_mmm',
                  'condition', 'timepoint']


class ThermalLimitSerializer(serializers.ModelSerializer):
    colony_name = serializers.CharField(source='colony.name', read_only=True)
    sst_clim_mmm = serializers.FloatField(source='_sst_clim_mmm', read_only=True)

    class Meta:
        model = ThermalLimit
        fields = ['colony_name', 'abs_thermal_limit',
                  'rel_thermal_limit', 'sst_clim_mmm',
                  'condition', 'timepoint']


class ColonySerializer(serializers.ModelSerializer):
    thermal_tolerances = serializers.SerializerMethodField()
    breakpoint_temperatures = serializers.SerializerMethodField()
    thermal_limits = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()

    def get_projects(self, obj):
        # Get all projects related to the colony's biosamples
        biosamples = obj.biosamples.all()
        projects = Project.objects.filter(biosamples__in=biosamples).distinct()
        # Assuming you want to serialize projects' names
        return [project.name for project in projects]

    def get_thermal_tolerances(self, obj):
        # Get all thermal tolerances associated with the colony
        thermal_tolerances = ThermalTolerance.objects.filter(colony=obj)
        # Serialize the thermal tolerance objects
        serializer = ThermalToleranceSerializer(thermal_tolerances, many=True)
        return serializer.data

    def get_breakpoint_temperatures(self, obj):
        # Get all breakpoint temperatures associated with the colony
        breakpoint_temperatures = BreakpointTemperature.objects.filter(colony=obj)
        # Serialize the breakpoint temperature objects
        serializer = BreakpointTemperatureSerializer(breakpoint_temperatures, many=True)
        return serializer.data

    def get_thermal_limits(self, obj):
        # Get all thermal limits associated with the colony
        thermal_limits = ThermalLimit.objects.filter(colony=obj)
        # Serialize the thermal limit objects
        serializer = ThermalLimitSerializer(thermal_limits, many=True)
        return serializer.data

    class Meta:
        model = Colony
        fields = ['id', 'name', 'species', 'country', 'latitude', 'longitude',
                  'thermal_tolerances', 'breakpoint_temperatures', 'thermal_limits', 'projects']


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description']
