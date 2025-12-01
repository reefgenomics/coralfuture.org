# api/projects_api.py
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from projects.models import Project, Experiment, Observation, Colony
from api.serializers import ProjectSerializer, ProjectDetailSerializer


class ProjectsApiView(APIView):
    """
    API endpoint for retrieving a list of all projects with basic information.
    """
    
    def get(self, request):
        projects = Project.objects.prefetch_related('publications', 'owner').all()
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectDetailApiView(APIView):
    """
    API endpoint for retrieving detailed information about a specific project.
    This includes experiments, colonies, and observations related to the project.
    Requires authentication - only registered users can view project details.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, project_id):
        try:
            # Get the project object
            project = get_object_or_404(Project, id=project_id)
            
            # Retrieve all experiments for the project
            experiments = project.experiments.all()
            
            # Retrieve all observations for the project's experiments
            observations = Observation.objects.filter(experiment__in=experiments)
            
            # Retrieve all colonies for the project's biosamples
            colonies = Colony.objects.filter(biosamples__observations__in=observations).distinct()
            
            # Serialize the project with all related data
            serializer = ProjectDetailSerializer(project, context={
                'experiments': experiments,
                'observations': observations,
                'colonies': colonies
            })
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Error retrieving project details: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
