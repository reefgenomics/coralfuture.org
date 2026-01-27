# api/projects_api.py
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile
import requests
import tempfile
import os
import pandas as pd
from io import StringIO
import base64

from projects.models import Project, Experiment, Observation, Colony, ProjectED50Attachment
from api.serializers import ProjectSerializer, ProjectDetailSerializer, ProjectED50AttachmentSerializer


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
    Public endpoint - no authentication required for viewing.
    """
    
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
                'colonies': colonies,
                'request': request
            })
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Error retrieving project details: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProjectED50CalculateApiView(APIView):
    """
    API endpoint for calculating and attaching ED50 data to a project.
    This endpoint:
    1. Extracts observations from the project
    2. Calls ed50-fastapi service to calculate EDs
    3. Stores results (CSV, plots, statistics) as ProjectED50Attachment
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, project_id):
        try:
            # Get the project
            project = get_object_or_404(Project, id=project_id)
            
            # Get all observations for this project
            experiments = project.experiments.all()
            observations = Observation.objects.filter(experiment__in=experiments)
            
            if not observations.exists():
                return Response({
                    'error': 'No observations found for this project'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Build CSV data from observations
            data_rows = []
            for obs in observations:
                row = {
                    'Site': obs.biosample.colony.name,
                    'Species': obs.biosample.colony.species,
                    'Condition': obs.condition,
                    'Temperature': obs.temperature,
                    'Timepoint': obs.timepoint,
                    'Pam_value': obs.pam_value if obs.pam_value is not None else '',
                }
                data_rows.append(row)
            
            if not data_rows:
                return Response({
                    'error': 'No valid observation data to process'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create DataFrame and CSV
            df = pd.DataFrame(data_rows)
            csv_data = df.to_csv(index=False)
            
            # Get calculation parameters from request or use defaults
            grouping_properties = request.data.get('grouping_properties', 'Site,Condition,Species,Timepoint')
            drm_formula = request.data.get('drm_formula', 'Pam_value ~ Temperature')
            condition = request.data.get('condition', 'Condition')
            faceting = request.data.get('faceting', ' ~ Species')
            faceting_model = request.data.get('faceting_model', 'Species ~ Site ~ Condition')
            
            # Call ed50-fastapi service
            ed50_service_url = os.getenv('ED50_SERVICE_URL', 'http://ed50-fastapi:8001/process')
            
            print(f"🧮 Calling ED50 service for project {project.name}...")
            
            # Create temp file for upload
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
                tmp_file.write(csv_data)
                tmp_file_path = tmp_file.name
            
            try:
                with open(tmp_file_path, 'rb') as f:
                    files = {'file': ('project_data.csv', f, 'text/csv')}
                    data = {
                        'grouping_properties': grouping_properties,
                        'drm_formula': drm_formula,
                        'condition': condition,
                        'faceting': faceting,
                        'faceting_model': faceting_model,
                        'size_text': '12',
                        'size_points': '2.5'
                    }
                    
                    response = requests.post(
                        ed50_service_url,
                        files=files,
                        data=data,
                        timeout=600
                    )
                
                if response.status_code != 200:
                    return Response({
                        'error': f'ED50 calculation failed: {response.text[:500]}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                # Parse response (HTML with embedded data)
                # Extract CSV data and images from HTML response
                html_content = response.text
                
                # Extract CSV data (between specific markers or from download link)
                # For now, we'll need to call the CSV endpoint separately
                csv_response = requests.post(
                    'http://ed50-fastapi:8001/calculate-csv',
                    files={'file': ('project_data.csv', csv_data, 'text/csv')},
                    data=data,
                    timeout=600
                )
                
                if csv_response.status_code != 200:
                    return Response({
                        'error': 'Failed to get CSV results from ED50 service'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                # Parse CSV response
                csv_content = csv_response.text
                
                # Split individual and aggregated statistics
                individual_csv = csv_content
                aggregated_data = []
                
                if '#AGGREGATED_STATISTICS' in csv_content:
                    parts = csv_content.split('#AGGREGATED_STATISTICS', 1)
                    individual_csv = parts[0].strip()
                    if len(parts) > 1:
                        aggregated_csv = parts[1].strip()
                        aggregated_df = pd.read_csv(StringIO(aggregated_csv))
                        aggregated_data = aggregated_df.to_dict('records')
                
                # Parse individual EDs
                individual_df = pd.read_csv(StringIO(individual_csv))
                individual_data = individual_df.to_dict('records')
                
                # Create ED50 attachment (without images for now, as we need multipart response)
                attachment = ProjectED50Attachment.objects.create(
                    project=project,
                    created_by=request.user,
                    aggregated_statistics=aggregated_data,
                    individual_eds=individual_data,
                    calculation_params={
                        'grouping_properties': grouping_properties,
                        'drm_formula': drm_formula,
                        'condition': condition,
                        'faceting': faceting,
                        'faceting_model': faceting_model
                    }
                )
                
                print(f"✅ ED50 attachment created for project {project.name}")
                
                # Serialize and return
                serializer = ProjectED50AttachmentSerializer(
                    attachment, 
                    context={'request': request}
                )
                
                return Response({
                    'message': 'ED50 calculation completed successfully',
                    'attachment': serializer.data
                }, status=status.HTTP_201_CREATED)
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
            
        except requests.exceptions.ConnectionError:
            return Response({
                'error': 'ED50 calculation service is not available'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except requests.exceptions.Timeout:
            return Response({
                'error': 'ED50 calculation timed out'
            }, status=status.HTTP_408_REQUEST_TIMEOUT)
        except Exception as e:
            print(f"❌ Error calculating ED50 for project: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Failed to calculate ED50: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateED50AttachmentDescriptionApiView(APIView):
    """
    API endpoint for updating the description of an ED50 attachment.
    Only the project owner can update the description.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, attachment_id):
        try:
            # Get the attachment
            attachment = get_object_or_404(ProjectED50Attachment, id=attachment_id)
            
            # Check if user is the project owner
            if attachment.project.owner != request.user:
                return Response({
                    'error': 'Only the project owner can update the description'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Update description
            description = request.data.get('description', '')
            attachment.description = description
            attachment.save()
            
            # Return updated attachment
            serializer = ProjectED50AttachmentSerializer(
                attachment, 
                context={'request': request}
            )
            
            return Response({
                'message': 'Description updated successfully',
                'attachment': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error updating ED50 attachment description: {str(e)}")
            return Response({
                'error': f'Failed to update description: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
