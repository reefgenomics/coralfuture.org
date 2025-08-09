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


class UserCart(models.Model):
    owner = models.OneToOneField(CustomUser, on_delete=models.CASCADE,
                                 related_name='cart')
    items = models.ManyToManyField('Colony', related_name='carts')

    def __str__(self):
        return f"UserCart of {self.owner.username}, {self.colonies.count()} colonies"
