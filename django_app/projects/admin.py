# projects/admin.py
from django.contrib import admin
from projects.models import Project, Experiment, Colony, BioSample, \
    Observation, Publication, CartGroup, CartItem, ThermalTolerance, BreakpointTemperature, ThermalLimit


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'registration_date', 'owner')
    search_fields = ('name', 'owner__username')
    def _delete_thermal_data(self, colony):
        """Delete all thermal data for a colony."""
        ThermalTolerance.objects.filter(colony=colony).delete()
        BreakpointTemperature.objects.filter(colony=colony).delete()
        ThermalLimit.objects.filter(colony=colony).delete()
    
    def _should_delete_colony(self, colony):
        """Check if colony can be safely deleted."""
        return (colony.biosamples.count() == 0 and 
                colony.cart_items.count() == 0 and 
                colony.cart_groups.count() == 0)
    
    def delete_model(self, request, obj):
        """Delete project and all related data."""
        # Collect related objects before clearing relationships
        biosamples = list(obj.biosamples.all())
        publications = list(obj.publications.all())
        colony_ids = {bs.colony.id for bs in biosamples}
        
        # Clear ManyToMany relationships
        obj.publications.clear()
        obj.biosamples.clear()
        
        # Delete biosamples with no projects
        for bs in biosamples:
            bs.refresh_from_db()
            if bs.projects.count() == 0:
                bs.delete()
        
        # Delete orphaned colonies
        for colony_id in colony_ids:
            try:
                colony = Colony.objects.get(id=colony_id)
                if self._should_delete_colony(colony):
                    self._delete_thermal_data(colony)
                    colony.delete()
            except Colony.DoesNotExist:
                pass
        
        # Delete orphaned publications
        for pub in publications:
            pub.refresh_from_db()
            if pub.projects.count() == 0:
                pub.delete()
        
        # Delete project (cascades to experiments/observations)
        obj.delete()
    
    def delete_queryset(self, request, queryset):
        """Handle bulk deletion from admin list view."""
        for obj in queryset:
            self.delete_model(request, obj)


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
