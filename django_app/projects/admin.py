# projects/admin.py
from django.contrib import admin
from projects.models import Project, Experiment, Colony, BioSample, \
    Observation, Publication, CartGroup, CartItem, ThermalTolerance, BreakpointTemperature, ThermalLimit


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'registration_date', 'owner')
    search_fields = ('name', 'owner__username')


@admin.register(Experiment)
class ExperimentAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'date')
    search_fields = ('name', 'project__name')


@admin.register(Colony)
class ColonyAdmin(admin.ModelAdmin):
    list_display = ('name', 'species', 'country', 'latitude', 'longitude')
    search_fields = ('name', 'species', 'country')


@admin.register(BioSample)
class BioSampleAdmin(admin.ModelAdmin):
    list_display = ('name', 'collection_date', 'colony')
    search_fields = ('name', 'colony__name')


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = (
        'experiment', 'biosample', 'condition', 'temperature', 'timepoint',
        'pam_value')
    search_fields = ('experiment__name', 'biosample__name')


@admin.register(ThermalTolerance)
class ThermalToleranceAdmin(admin.ModelAdmin):
    list_display = (
    'colony', 'condition', 'abs_thermal_tolerance', 'rel_thermal_tolerance',
    'display_observations')
    search_fields = ('colony__name', 'condition')

    def display_observations(self, obj):
        return ", ".join(
            [str(observation) for observation in obj.observations.all()])

    display_observations.short_description = "Observations"


@admin.register(BreakpointTemperature)
class BreakpointTemperatureAdmin(admin.ModelAdmin):
    list_display = (
    'colony', 'condition', 'abs_breakpoint_temperature', 'rel_breakpoint_temperature',
    'display_observations')
    search_fields = ('colony__name', 'condition')

    def display_observations(self, obj):
        return ", ".join(
            [str(observation) for observation in obj.observations.all()])

    display_observations.short_description = "Observations"


@admin.register(ThermalLimit)
class ThermalLimitAdmin(admin.ModelAdmin):
    list_display = (
    'colony', 'condition', 'abs_thermal_limit', 'rel_thermal_limit',
    'display_observations')
    search_fields = ('colony__name', 'condition')

    def display_observations(self, obj):
        return ", ".join(
            [str(observation) for observation in obj.observations.all()])

    display_observations.short_description = "Observations"


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ('title', 'year', 'doi')
    search_fields = ('title', 'doi')


@admin.register(CartGroup)
class CartGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'colony_count', 'created_at')
    search_fields = ('name', 'owner__username')
    list_filter = ('created_at', 'owner')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ('colony', 'cart_group', 'colony_name')
    search_fields = ('colony__name', 'cart_group__name')
    list_filter = ('cart_group',)
    
    def colony_name(self, obj):
        return obj.colony.name
    colony_name.short_description = 'Colony Name'
