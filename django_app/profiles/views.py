import json

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from profiles.models import ResearcherProfile
from profiles.serializers import PublicResearcherProfileSerializer, ResearcherProfileSerializer
from users.models import CustomUser


def _normalize_profile_payload(data):
    payload = {key: data.get(key) for key in data}
    for key in ('links', 'research_interests', 'expertise'):
        value = payload.get(key)
        if isinstance(value, str):
            payload[key] = json.loads(value) if value else []
    return payload


class MyResearcherProfileApiView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        profile, _ = ResearcherProfile.objects.get_or_create(user=request.user)
        serializer = ResearcherProfileSerializer(profile, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile, _ = ResearcherProfile.objects.get_or_create(user=request.user)
        try:
            payload = _normalize_profile_payload(request.data)
        except json.JSONDecodeError:
            return Response({'error': 'Invalid JSON in profile list fields.'}, status=status.HTTP_400_BAD_REQUEST)

        if payload.get('clear_profile_photo') in (True, 'true', 'True', '1'):
            profile.profile_photo = None
            profile.save(update_fields=['profile_photo'])

        serializer = ResearcherProfileSerializer(
            profile,
            data=payload,
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicResearcherProfileApiView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, username):
        user = get_object_or_404(CustomUser, username=username)
        profile, _ = ResearcherProfile.objects.get_or_create(user=user)
        serializer = PublicResearcherProfileSerializer(profile, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
