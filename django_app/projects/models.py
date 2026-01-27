# projects/models.py
from django.db import models
from users.models import CustomUser


class Publication(models.Model):
    """
    Publication includes Observation(s) and belongs to Project(s).
    """
    title = models.TextField()
    year = models.IntegerField()
    doi = models.CharField(max_length=100)
    biosamples = models.ManyToManyField('BioSample',
                                        related_name='publications')

    def __str__(self):
        return f"Publication {self.id}, {self.doi}"


class Project(models.Model):
    """
    Project includes Experiment(s).
    """
    name = models.CharField(max_length=100)
    registration_date = models.DateField()
    description = models.TextField()
    owner = models.ForeignKey(CustomUser, on_delete=models.CASCADE,
                              related_name='projects')
    publications = models.ManyToManyField(Publication,
                                          related_name='projects')
    biosamples = models.ManyToManyField('BioSample', related_name='projects')

    def __str__(self):
        return f"Project {self.name}"


class Experiment(models.Model):
    """
    Experiment includes Observation(s).
    """
    project = models.ForeignKey(Project, on_delete=models.CASCADE,
                                related_name='experiments')
    name = models.CharField(max_length=100)
    date = models.DateField()

    def __str__(self):
        return f"Experiment {self.name} from {self.project.name}"


class Colony(models.Model):
    """
    Colony includes BioSample(s).
    """
    name = models.CharField(max_length=100)
    species = models.CharField(max_length=100)
    country = models.CharField(max_length=10)
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __str__(self):
        return f"Colony {self.name} of {self.species} from {self.country} ({self.latitude}, {self.longitude})"


class BioSample(models.Model):
    """
    BioSample includes Observation(s).
    """
    name = models.CharField(max_length=100)
    collection_date = models.DateField()
    colony = models.ForeignKey(Colony, on_delete=models.CASCADE,
                               related_name='biosamples')

    def __str__(self):
        return f"BioSample {self.id} {self.name} of Colony {self.colony.id}"


class Observation(models.Model):
    """
    Observation belongs to Experiment.
    """
    experiment = models.ForeignKey(Experiment, on_delete=models.CASCADE,
                                   related_name='observations')
    biosample = models.ForeignKey(BioSample, on_delete=models.CASCADE,
                                  related_name='observations')
    condition = models.CharField(max_length=100)
    temperature = models.IntegerField()
    timepoint = models.CharField(max_length=100)
    pam_value = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Observation {self.id} of Biosample {self.biosample.id} {self.biosample.name}"

    def save(self, *args, **kwargs):
        # Ensure pam_value is not None before rounding
        if self.pam_value is not None:
            self.pam_value = round(self.pam_value, 3)
        super().save(*args, **kwargs)


class ThermalTolerance(models.Model):
    """
    Represents Thermal Tolerance for a Colony under specific Condition and Timepoint.
    """
    colony = models.ForeignKey(Colony, on_delete=models.CASCADE,
                               related_name='thermal_tolerances')
    observations = models.ManyToManyField(Observation,
                                          related_name='thermal_tolerances')
    condition = models.CharField(max_length=100, null=True, blank=True)
    timepoint = models.CharField(max_length=100, null=True, blank=True)
    abs_thermal_tolerance = models.FloatField(null=True, blank=True)
    rel_thermal_tolerance = models.FloatField(null=True, blank=True)
    # Internal attribute
    _sst_clim_mmm = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ['colony', 'condition', 'timepoint', 'abs_thermal_tolerance']

    def save(self, *args, **kwargs):
        # Ensure abs_thermal_tolerance is not None before rounding
        if self.abs_thermal_tolerance is not None:
            self.abs_thermal_tolerance = round(self.abs_thermal_tolerance, 2)
        if self._sst_clim_mmm is not None:
            self._sst_clim_mmm = round(self._sst_clim_mmm, 2)
        if self.abs_thermal_tolerance is not None and self._sst_clim_mmm is not None:
            self.rel_thermal_tolerance = round(
                self.abs_thermal_tolerance - self._sst_clim_mmm,
                2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Thermal Tolerance for Colony {self.colony.name} under {self.condition} at {self.timepoint}: {self.abs_thermal_tolerance}"


class BreakpointTemperature(models.Model):
    """
    Represents Breakpoint Temperature (ED5) for a Colony under specific Condition and Timepoint.
    """
    colony = models.ForeignKey(Colony, on_delete=models.CASCADE,
                               related_name='breakpoint_temperatures')
    observations = models.ManyToManyField(Observation,
                                          related_name='breakpoint_temperatures')
    condition = models.CharField(max_length=100, null=True, blank=True)
    timepoint = models.CharField(max_length=100, null=True, blank=True)
    abs_breakpoint_temperature = models.FloatField(null=True, blank=True)
    rel_breakpoint_temperature = models.FloatField(null=True, blank=True)
    # Internal attribute
    _sst_clim_mmm = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ['colony', 'condition', 'timepoint', 'abs_breakpoint_temperature']

    def save(self, *args, **kwargs):
        # Ensure abs_breakpoint_temperature is not None before rounding
        if self.abs_breakpoint_temperature is not None:
            self.abs_breakpoint_temperature = round(self.abs_breakpoint_temperature, 2)
        if self._sst_clim_mmm is not None:
            self._sst_clim_mmm = round(self._sst_clim_mmm, 2)
        if self.abs_breakpoint_temperature is not None and self._sst_clim_mmm is not None:
            self.rel_breakpoint_temperature = round(
                self.abs_breakpoint_temperature - self._sst_clim_mmm,
                2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Breakpoint Temperature for Colony {self.colony.name} under {self.condition} at {self.timepoint}: {self.abs_breakpoint_temperature}"


class ThermalLimit(models.Model):
    """
    Represents Thermal Limit (ED95) for a Colony under specific Condition and Timepoint.
    """
    colony = models.ForeignKey(Colony, on_delete=models.CASCADE,
                               related_name='thermal_limits')
    observations = models.ManyToManyField(Observation,
                                          related_name='thermal_limits')
    condition = models.CharField(max_length=100, null=True, blank=True)
    timepoint = models.CharField(max_length=100, null=True, blank=True)
    abs_thermal_limit = models.FloatField(null=True, blank=True)
    rel_thermal_limit = models.FloatField(null=True, blank=True)
    # Internal attribute
    _sst_clim_mmm = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ['colony', 'condition', 'timepoint', 'abs_thermal_limit']

    def save(self, *args, **kwargs):
        # Ensure abs_thermal_limit is not None before rounding
        if self.abs_thermal_limit is not None:
            self.abs_thermal_limit = round(self.abs_thermal_limit, 2)
        if self._sst_clim_mmm is not None:
            self._sst_clim_mmm = round(self._sst_clim_mmm, 2)
        if self.abs_thermal_limit is not None and self._sst_clim_mmm is not None:
            self.rel_thermal_limit = round(
                self.abs_thermal_limit - self._sst_clim_mmm,
                2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Thermal Limit for Colony {self.colony.name} under {self.condition} at {self.timepoint}: {self.abs_thermal_limit}"


class CartGroup(models.Model):
    """
    Represents a group of colonies added to cart with specific filters.
    """
    owner = models.ForeignKey(CustomUser, on_delete=models.CASCADE,
                              related_name='cart_groups')
    name = models.CharField(max_length=200, default="Filter Group")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Filter parameters (JSON field to store all filter data)
    filter_params = models.JSONField(default=dict, blank=True)
    
    # Colonies in this group
    colonies = models.ManyToManyField(Colony, related_name='cart_groups')
    
    def __str__(self):
        return f"Cart Group: {self.name} ({self.colonies.count()} colonies)"
    
    @property
    def colony_count(self):
        return self.colonies.count()


class CartItem(models.Model):
    """
    Individual colony item within a cart group with complete data.
    """
    cart_group = models.ForeignKey(CartGroup, on_delete=models.CASCADE,
                                   related_name='cart_items')
    colony = models.ForeignKey(Colony, on_delete=models.CASCADE,
                               related_name='cart_items')
    
    # Store complete colony data at time of addition
    colony_data = models.JSONField(default=dict)
    
    def __str__(self):
        return f"Cart Item: {self.colony.name} in {self.cart_group.name}"
    
    def save(self, *args, **kwargs):
        # Auto-populate colony_data if not provided
        if not self.colony_data:
            self.colony_data = self._get_complete_colony_data()
        super().save(*args, **kwargs)
    
    def _get_complete_colony_data(self):
        """Get complete colony data including all related information."""
        data = {
            'colony': {
                'id': self.colony.id,
                'name': self.colony.name,
                'species': self.colony.species,
                'country': self.colony.country,
                'latitude': self.colony.latitude,
                'longitude': self.colony.longitude,
            },
            'biosamples': [],
            'thermal_tolerances': [],
            'breakpoint_temperatures': [],
            'thermal_limits': [],
        }
        
        # Add biosamples data
        for biosample in self.colony.biosamples.all():
            biosample_data = {
                'id': biosample.id,
                'name': biosample.name,
                'collection_date': biosample.collection_date.isoformat() if biosample.collection_date else None,
                'observations': []
            }
            
            # Add observations for this biosample
            for observation in biosample.observations.all():
                obs_data = {
                    'id': observation.id,
                    'condition': observation.condition,
                    'temperature': observation.temperature,
                    'timepoint': observation.timepoint,
                    'pam_value': observation.pam_value,
                    'experiment': {
                        'id': observation.experiment.id,
                        'name': observation.experiment.name,
                        'date': observation.experiment.date.isoformat() if observation.experiment.date else None,
                        'project': {
                            'id': observation.experiment.project.id,
                            'name': observation.experiment.project.name,
                        }
                    }
                }
                biosample_data['observations'].append(obs_data)
            
            data['biosamples'].append(biosample_data)
        
        # Add thermal tolerance data
        for tt in self.colony.thermal_tolerances.all():
            tt_data = {
                'id': tt.id,
                'condition': tt.condition,
                'timepoint': tt.timepoint,
                'abs_thermal_tolerance': tt.abs_thermal_tolerance,
                'rel_thermal_tolerance': tt.rel_thermal_tolerance,
                'sst_clim_mmm': tt._sst_clim_mmm,
            }
            data['thermal_tolerances'].append(tt_data)
        
        # Add breakpoint temperature data
        for bt in self.colony.breakpoint_temperatures.all():
            bt_data = {
                'id': bt.id,
                'condition': bt.condition,
                'timepoint': bt.timepoint,
                'abs_breakpoint_temperature': bt.abs_breakpoint_temperature,
                'rel_breakpoint_temperature': bt.rel_breakpoint_temperature,
                'sst_clim_mmm': bt._sst_clim_mmm,
            }
            data['breakpoint_temperatures'].append(bt_data)
        
        # Add thermal limit data
        for tl in self.colony.thermal_limits.all():
            tl_data = {
                'id': tl.id,
                'condition': tl.condition,
                'timepoint': tl.timepoint,
                'abs_thermal_limit': tl.abs_thermal_limit,
                'rel_thermal_limit': tl.rel_thermal_limit,
                'sst_clim_mmm': tl._sst_clim_mmm,
            }
            data['thermal_limits'].append(tl_data)
        
        return data


class ProjectED50Attachment(models.Model):
    """
    Stores ED50 calculation results for a project including plots and statistics.
    """
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE,
        related_name='ed50_attachments'
    )
    
    # Image files
    boxplot_image = models.ImageField(
        upload_to='ed50_attachments/boxplots/',
        null=True,
        blank=True,
        help_text='ED50s Boxplot'
    )
    temperature_curve_image = models.ImageField(
        upload_to='ed50_attachments/temp_curves/',
        null=True,
        blank=True,
        help_text='Temperature Response Curves'
    )
    model_curve_image = models.ImageField(
        upload_to='ed50_attachments/model_curves/',
        null=True,
        blank=True,
        help_text='Model Curve with ED bands'
    )
    
    # Statistical data
    aggregated_statistics = models.JSONField(
        default=list,
        blank=True,
        help_text='Aggregated Statistics (Mean, SD, SE, Conf_Int for ED5, ED50, ED95)'
    )
    individual_eds = models.JSONField(
        default=list,
        blank=True,
        help_text='Individual ED values'
    )
    
    # Calculation parameters
    calculation_params = models.JSONField(
        default=dict,
        blank=True,
        help_text='Parameters used for calculation (grouping, formula, etc.)'
    )
    
    # Description field with HTML support
    description = models.TextField(
        blank=True,
        null=True,
        help_text='HTML description for the attachment'
    )
    
    # Metadata
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_ed50_attachments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Project ED50 Attachment'
        verbose_name_plural = 'Project ED50 Attachments'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"ED50 Attachment for {self.project.name} ({self.created_at.strftime('%Y-%m-%d')})"
