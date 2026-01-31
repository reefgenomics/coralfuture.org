# api/projects_api.py
import json
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from projects.models import Project, Experiment, Observation, Colony, Attachment, Publication
from api.serializers import ProjectSerializer, ProjectDetailSerializer


def _is_owner(request, project):
    return request.user.is_authenticated and project.owner_id == request.user.id


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
            
            # Serialize the project with all related data (pass request for attachment URLs)
            serializer = ProjectDetailSerializer(project, context={
                'request': request,
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


class ProjectUpdateApiView(APIView):
    """PATCH: update project name and/or description. Owner only."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)
        if not _is_owner(request, project):
            return Response({'error': 'Only the project owner can update the project.'}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get('name')
        description = request.data.get('description')
        if name is not None:
            project.name = name
        if description is not None:
            project.description = description
        project.save()
        return Response({'id': project.id, 'name': project.name, 'description': project.description}, status=status.HTTP_200_OK)


class AttachmentUpdateApiView(APIView):
    """PATCH: update project attachment (boxplot, temp_curve, model_curve, statistics). Owner only."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)
        if not _is_owner(request, project):
            return Response({'error': 'Only the project owner can update attachments.'}, status=status.HTTP_403_FORBIDDEN)
        attachment, _ = Attachment.objects.get_or_create(project=project)
        if 'boxplot' in request.FILES:
            attachment.boxplot = request.FILES['boxplot']
        if 'temp_curve' in request.FILES:
            attachment.temp_curve = request.FILES['temp_curve']
        if 'model_curve' in request.FILES:
            attachment.model_curve = request.FILES['model_curve']
        if 'cover_photo' in request.FILES:
            attachment.cover_photo = request.FILES['cover_photo']
        def _truthy(v):
            return v in (True, 'true', 'True', '1')
        if _truthy(request.data.get('clear_boxplot')):
            attachment.boxplot = None
        if _truthy(request.data.get('clear_temp_curve')):
            attachment.temp_curve = None
        if _truthy(request.data.get('clear_model_curve')):
            attachment.model_curve = None
        if _truthy(request.data.get('clear_cover_photo')):
            attachment.cover_photo = None
        if 'statistics' in request.data:
            val = request.data['statistics']
            attachment.statistics = json.loads(val) if isinstance(val, str) else val
        if 'publication_ids' in request.data:
            val = request.data['publication_ids']
            ids = json.loads(val) if isinstance(val, str) else val
            attachment.publications.set(ids or [])
        if 'additional_links' in request.data:
            val = request.data['additional_links']
            attachment.additional_links = json.loads(val) if isinstance(val, str) else (val or [])
        attachment.save()
        return Response({'message': 'Attachment updated', 'attachment_id': attachment.id}, status=status.HTTP_200_OK)


class ProjectPublicationAddApiView(APIView):
    """POST: add a publication to the project (create or link by title, year, doi). Owner only."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)
        if not _is_owner(request, project):
            return Response({'error': 'Only the project owner can add publications.'}, status=status.HTTP_403_FORBIDDEN)
        title = request.data.get('title')
        year = request.data.get('year')
        doi = (request.data.get('doi') or '').strip()
        authors = (request.data.get('authors') or '').strip()
        journal = (request.data.get('journal') or '').strip()
        if not title or not year:
            return Response({'error': 'title and year are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            year = int(year)
        except (TypeError, ValueError):
            return Response({'error': 'year must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if doi:
            pub, created = Publication.objects.get_or_create(
                doi=doi,
                defaults={'title': title, 'year': year, 'authors': authors, 'journal': journal}
            )
            if not created:
                pub.title = title
                pub.year = year
                pub.authors = authors
                pub.journal = journal
                pub.save(update_fields=['title', 'year', 'authors', 'journal'])
        else:
            pub = Publication.objects.create(
                title=title, year=year, doi='No doi available', authors=authors, journal=journal
            )
            created = True
        project.publications.add(pub)
        attachment = Attachment.objects.filter(project=project).first()
        if attachment:
            attachment.publications.add(pub)
        return Response({
            'id': pub.id, 'title': pub.title, 'year': pub.year, 'doi': pub.doi,
            'authors': pub.authors, 'journal': pub.journal,
            'created': created
        }, status=status.HTTP_201_CREATED)


class ProjectPublicationRemoveApiView(APIView):
    """DELETE: remove a publication from the project. Owner only."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id, publication_id):
        project = get_object_or_404(Project, id=project_id)
        if not _is_owner(request, project):
            return Response({'error': 'Only the project owner can remove publications.'}, status=status.HTTP_403_FORBIDDEN)
        pub = get_object_or_404(Publication, id=publication_id)
        project.publications.remove(pub)
        attachment = Attachment.objects.filter(project=project).first()
        if attachment:
            attachment.publications.remove(pub)
        return Response({'message': 'Publication removed'}, status=status.HTTP_204_NO_CONTENT)
