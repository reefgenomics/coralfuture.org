from rest_framework import serializers

from projects.models import BioSample, Colony, ThermalTolerance, \
    Observation, Project, BreakpointTemperature, ThermalLimit, Experiment, ProjectED50Attachment


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
    publications = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    
    def get_publications(self, obj):
        publications = obj.publications.all()
        return [{
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'doi': pub.doi
        } for pub in publications]
    
    def get_owner(self, obj):
        return {
            'id': obj.owner.id,
            'username': obj.owner.username,
            'email': obj.owner.email
        }
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'registration_date', 'description', 'owner', 'publications']


class ExperimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experiment
        fields = ['id', 'name', 'date']


class ColonyDetailSerializer(serializers.ModelSerializer):
    thermal_tolerances = serializers.SerializerMethodField()
    breakpoint_temperatures = serializers.SerializerMethodField()
    thermal_limits = serializers.SerializerMethodField()
    
    def get_thermal_tolerances(self, obj):
        thermal_tolerances = obj.thermal_tolerances.all()
        return [{
            'id': tt.id,
            'condition': tt.condition,
            'timepoint': tt.timepoint,
            'abs_thermal_tolerance': tt.abs_thermal_tolerance,
            'rel_thermal_tolerance': tt.rel_thermal_tolerance,
            'sst_clim_mmm': tt._sst_clim_mmm
        } for tt in thermal_tolerances if tt.abs_thermal_tolerance and tt.condition and tt.timepoint]
    
    def get_breakpoint_temperatures(self, obj):
        breakpoint_temperatures = obj.breakpoint_temperatures.all()
        return [{
            'id': bt.id,
            'condition': bt.condition,
            'timepoint': bt.timepoint,
            'abs_breakpoint_temperature': bt.abs_breakpoint_temperature,
            'rel_breakpoint_temperature': bt.rel_breakpoint_temperature,
            'sst_clim_mmm': bt._sst_clim_mmm
        } for bt in breakpoint_temperatures if bt.abs_breakpoint_temperature and bt.condition and bt.timepoint]
    
    def get_thermal_limits(self, obj):
        thermal_limits = obj.thermal_limits.all()
        return [{
            'id': tl.id,
            'condition': tl.condition,
            'timepoint': tl.timepoint,
            'abs_thermal_limit': tl.abs_thermal_limit,
            'rel_thermal_limit': tl.rel_thermal_limit,
            'sst_clim_mmm': tl._sst_clim_mmm
        } for tl in thermal_limits if tl.abs_thermal_limit and tl.condition and tl.timepoint]
    
    class Meta:
        model = Colony
        fields = ['id', 'name', 'species', 'country', 'latitude', 'longitude', 
                 'thermal_tolerances', 'breakpoint_temperatures', 'thermal_limits']


class ObservationDetailSerializer(serializers.ModelSerializer):
    biosample = serializers.SerializerMethodField()
    experiment = serializers.SerializerMethodField()
    related_projects = serializers.SerializerMethodField()
    
    def get_biosample(self, obj):
        return {
            'id': obj.biosample.id,
            'name': obj.biosample.name,
            'collection_date': obj.biosample.collection_date
        }
    
    def get_experiment(self, obj):
        return {
            'id': obj.experiment.id,
            'name': obj.experiment.name,
            'date': obj.experiment.date
        }
    
    def get_related_projects(self, obj):
        # Get all projects related to this biosample, excluding the current project
        current_project_id = self.context.get('current_project_id')
        projects = obj.biosample.projects.exclude(id=current_project_id)
        return [{'id': p.id, 'name': p.name} for p in projects]
    
    class Meta:
        model = Observation
        fields = ['id', 'biosample', 'experiment', 'condition', 'temperature', 
                 'timepoint', 'pam_value', 'related_projects']


class ProjectDetailSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    publications = serializers.SerializerMethodField()
    experiments = serializers.SerializerMethodField()
    colonies = serializers.SerializerMethodField()
    observations = serializers.SerializerMethodField()
    ed50_attachments = serializers.SerializerMethodField()
    
    def get_owner(self, obj):
        return {
            'id': obj.owner.id,
            'username': obj.owner.username,
            'email': obj.owner.email
        }
    
    def get_publications(self, obj):
        publications = obj.publications.all()
        return [{
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'doi': pub.doi
        } for pub in publications]
    
    def get_experiments(self, obj):
        experiments = self.context.get('experiments', [])
        return ExperimentSerializer(experiments, many=True).data
    
    def get_colonies(self, obj):
        colonies = self.context.get('colonies', [])
        return ColonyDetailSerializer(colonies, many=True).data
    
    def get_observations(self, obj):
        observations = self.context.get('observations', [])
        return ObservationDetailSerializer(observations, many=True, context={
            'current_project_id': obj.id
        }).data
    
    def get_ed50_attachments(self, obj):
        attachments = obj.ed50_attachments.all()
        request = self.context.get('request')
        return ProjectED50AttachmentSerializer(
            attachments, 
            many=True, 
            context={'request': request}
        ).data
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'registration_date', 'description', 'owner', 
                 'publications', 'experiments', 'colonies', 'observations', 'ed50_attachments']


class ProjectED50AttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for ED50 attachments with image URLs and statistical data.
    """
    boxplot_image_url = serializers.SerializerMethodField()
    temperature_curve_image_url = serializers.SerializerMethodField()
    model_curve_image_url = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    def get_boxplot_image_url(self, obj):
        if obj.boxplot_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.boxplot_image.url)
            return obj.boxplot_image.url
        return None
    
    def get_temperature_curve_image_url(self, obj):
        if obj.temperature_curve_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.temperature_curve_image.url)
            return obj.temperature_curve_image.url
        return None
    
    def get_model_curve_image_url(self, obj):
        if obj.model_curve_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.model_curve_image.url)
            return obj.model_curve_image.url
        return None
    
    class Meta:
        model = ProjectED50Attachment
        fields = [
            'id', 
            'project',
            'boxplot_image_url',
            'temperature_curve_image_url', 
            'model_curve_image_url',
            'aggregated_statistics',
            'individual_eds',
            'calculation_params',
            'description',
            'created_by_username',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
