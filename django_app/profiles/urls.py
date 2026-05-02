from django.urls import path

from profiles.views import MyResearcherProfileApiView, PublicResearcherProfileApiView


auth_urlpatterns = [
    path('profile/', MyResearcherProfileApiView.as_view()),
]

public_urlpatterns = [
    path('users/<str:username>/', PublicResearcherProfileApiView.as_view()),
]
