from django.conf import settings
from django.db import models


class ResearcherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='researcher_profile')
    profile_photo = models.ImageField(upload_to='profiles/', null=True, blank=True)
    description = models.TextField(blank=True, default='')
    affiliation = models.CharField(max_length=255, blank=True, default='')
    department = models.CharField(max_length=255, blank=True, default='')
    position = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=120, blank=True, default='')
    country = models.CharField(max_length=120, blank=True, default='')
    orcid = models.CharField(max_length=50, blank=True, default='')
    website = models.URLField(blank=True, default='')
    google_scholar = models.URLField(blank=True, default='')
    researchgate = models.URLField(blank=True, default='')
    research_interests = models.JSONField(default=list, blank=True)
    expertise = models.JSONField(default=list, blank=True)
    links = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Researcher profile for {self.user.username}"
