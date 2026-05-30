from django.contrib import admin

from profiles.models import ResearcherProfile


@admin.register(ResearcherProfile)
class ResearcherProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'affiliation', 'position', 'country', 'updated_at')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'affiliation', 'orcid')
    readonly_fields = ('created_at', 'updated_at')
