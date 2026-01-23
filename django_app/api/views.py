# api/views.py
import os
import tempfile
import pandas as pd
import csv
import json
from django.db.models import Max, Min
from django.core.management import call_command
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.views import View

from rest_framework import generics, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.serializers import BioSampleSerializer, \
    ColonySerializer, ThermalToleranceSerializer, \
    ObservationSerializer, ProjectSerializer, BreakpointTemperatureSerializer, ThermalLimitSerializer
# Apps imports
from projects.models import BioSample, Observation, Colony, Project, \
    ThermalTolerance, Project, CartGroup, CartItem, BreakpointTemperature, ThermalLimit
from django.db.models import Count, Q
from django.db import transaction
from django.utils import timezone
from datetime import timedelta


class CheckAuthenticationApiView(APIView):
    """
    This endpoint allows to check if user is authenticated.
    """

    def get(self, request):
        return Response({
            'authenticated': request.user.is_authenticated,
            'username': request.user.username})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CSRFTokenView(APIView):
    """
    Get CSRF token for authentication.
    """
    
    def get(self, request):
        from django.middleware.csrf import get_token
        csrf_token = get_token(request)
        return Response({'csrfToken': csrf_token})


class LoginApiView(APIView):
    """
    API endpoint for user login.
    """
    
    def post(self, request):
        try:
            # Parse JSON data
            if hasattr(request, 'data'):
                data = request.data
            else:
                data = json.loads(request.body)
            
            username = data.get('username')
            password = data.get('password')
            
            print(f"🔐 Login attempt for user: {username}")
            
            if not username or not password:
                return Response({
                    'success': False,
                    'error': 'Username and password are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Authenticate user
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                if user.is_active:
                    login(request, user)
                    print(f"✅ Login successful for user: {username}")
                    return Response({
                        'success': True,
                        'message': 'Login successful',
                        'username': user.username
                    })
                else:
                    print(f"❌ Inactive user login attempt: {username}")
                    return Response({
                        'success': False,
                        'error': 'Account is disabled'
                    }, status=status.HTTP_401_UNAUTHORIZED)
            else:
                print(f"❌ Invalid credentials for user: {username}")
                return Response({
                    'success': False,
                    'error': 'Invalid username or password'
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except json.JSONDecodeError:
            print("❌ Invalid JSON in login request")
            return Response({
                'success': False,
                'error': 'Invalid JSON data'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return Response({
                'success': False,
                'error': f'Login failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogoutApiView(APIView):
    """
    API endpoint for user logout.
    """
    
    def post(self, request):
        try:
            logout(request)
            return Response({
                'success': True,
                'message': 'Logout successful'
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CheckCSVForED50ApiView(APIView):
    """
    This endpoint checks if a CSV file contains ED50 values after column mapping. 
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if 'csv_file' not in request.FILES:
            return Response({'error': 'No CSV file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = request.FILES['csv_file']
        
        # Validate file type
        if not csv_file.name.lower().endswith('.csv'):
            return Response({'error': 'File must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read CSV and map columns to standard schema
            df = pd.read_csv(csv_file)
            
            # Use column mapper to transform to standard schema
            from projects.management.commands.utils.column_mapper import map_and_transform_dataframe
            
            try:
                transformed_df, instructions = map_and_transform_dataframe(df, return_instructions=True)
                
                # Check if Colony.ed50 column has actual values (not all NaN/null)
                ed50_column = 'Colony.ed50'
                has_ed50 = False
                ed50_info = {}
                
                if ed50_column in transformed_df.columns:
                    # Check if the column has any non-null values
                    non_null_count = transformed_df[ed50_column].notna().sum()
                    total_count = len(transformed_df)
                    
                    if non_null_count > 0:
                        has_ed50 = True
                        ed50_info = {
                            'non_null_count': int(non_null_count),
                            'total_count': int(total_count),
                            'percentage': round((non_null_count / total_count) * 100, 1)
                        }
                        print(f"✅ ED50 values found: {non_null_count}/{total_count} ({ed50_info['percentage']}%)")
                    else:
                        print(f"⚠️ ED50 column exists but all values are null/NaN")
                else:
                    print(f"❌ ED50 column not found in mapped data")
                
                return Response({
                    'has_ed50': has_ed50,
                    'ed50_info': ed50_info,
                    'column_mapping': instructions.get('mapping', {}),
                    'original_columns': df.columns.tolist(),
                    'transformed_columns': transformed_df.columns.tolist(),
                    'filename': csv_file.name
                }, status=status.HTTP_200_OK)
                
            except Exception as mapping_error:
                print(f"❌ Column mapping failed: {str(mapping_error)}")
                # Fallback to simple column check if mapping fails
                columns = df.columns.tolist()
                ed50_columns = []
                ed50_patterns = ['ed50', 'Colony.ed50', 'colony.ed50_value', 'ed50_value', 'ED50']
                
                for col in columns:
                    for pattern in ed50_patterns:
                        if pattern.lower() in col.lower():
                            ed50_columns.append(col)
                            break
                
                has_ed50 = len(ed50_columns) > 0
                
                return Response({
                    'has_ed50': has_ed50,
                    'ed50_columns': ed50_columns,
                    'mapping_failed': True,
                    'error': str(mapping_error),
                    'original_columns': columns,
                    'filename': csv_file.name
                }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error checking CSV: {str(e)}")
            return Response({
                'error': f'Failed to check CSV file: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadCSVApiView(APIView):
    """
    Clean workflow: Raw Data → Calculate EDs → Column Mapping → Database Upload
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if 'csv_file' not in request.FILES:
            return Response({'error': 'No CSV file provided'}, status=status.HTTP_400_BAD_REQUEST)

        csv_file = request.FILES['csv_file']
        no_pam = request.data.get('no_pam', False) == 'true'

        print(f"📁 Processing: {csv_file.name} | No PAM: {no_pam}")

        # Validate file type
        if not csv_file.name.lower().endswith('.csv'):
            return Response({'error': 'File must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)

        temp_raw_csv = None
        temp_ed_csv = None
        temp_combined_csv = None
        upload_description = f'Datasheet {csv_file.name}'
        created_project_ids = set()

        try:
            # ==============================================================
            # STEP 1: Load raw data and check for ED values
            # ==============================================================
            df_raw = pd.read_csv(csv_file)
            
            # Check if ED values already exist
            ed_patterns = ['ed50', 'ed5', 'ed95', 'ED50', 'ED5', 'ED95']
            has_ed_columns = any(
                any(pattern.lower() in col.lower() for pattern in ed_patterns)
                for col in df_raw.columns
            )
            
            df_with_eds = None
            
            if has_ed_columns:
                print("✅ ED values detected in uploaded file")
                df_with_eds = df_raw
            else:
                # ==============================================================
                # STEP 2: Calculate ED values using ed50-fastapi service
                # ==============================================================
                print("📊 No ED values detected - calculating EDs...")
                
                # Save raw data to temp file for ED calculation
                with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp:
                    df_raw.to_csv(tmp.name, index=False)
                    temp_raw_csv = tmp.name
                
                # Call ED50 calculator service (CSV endpoint)
                try:
                    import requests
                    
                    with open(temp_raw_csv, 'rb') as f:
                        files = {'file': (csv_file.name, f, 'text/csv')}
                        
                        # Get grouping properties from request or use defaults
                        # Check if Genotype column exists in raw data (case-insensitive)
                        genotype_col = None
                        for col in df_raw.columns:
                            if col.lower() == 'genotype':
                                genotype_col = col
                                break
                        
                        has_genotype = genotype_col is not None
                        if has_genotype:
                            print(f"✅ Found Genotype column: {genotype_col}")
                        
                        # Base grouping without Genotype
                        base_grouping = 'Site,Condition,Species,Timepoint'
                        
                        # Get user-provided grouping or use default
                        grouping = request.data.get('grouping_properties', base_grouping)
                        if not grouping or grouping.strip() == '':
                            grouping = base_grouping
                        
                        # ALWAYS add Genotype to grouping if it exists in the data
                        # This prevents mixing ED values from different genotypes
                        if has_genotype:
                            grouping_list = [g.strip() for g in grouping.split(',')]
                            # Use the actual column name (case-sensitive for the grouping string)
                            if genotype_col not in grouping_list:
                                # Insert Genotype before Timepoint if not already present
                                if 'Timepoint' in grouping_list:
                                    timepoint_idx = grouping_list.index('Timepoint')
                                    grouping_list.insert(timepoint_idx, genotype_col)
                                else:
                                    grouping_list.append(genotype_col)
                                grouping = ','.join(grouping_list)
                                print(f"⚠️ Genotype column found but not in grouping - adding it automatically")
                        
                        print(f"📊 Using grouping properties: {grouping}")
                        
                        data = {
                            'grouping_properties': grouping,
                            'drm_formula': 'Pam_value ~ Temperature',
                            'condition': 'Condition',
                            'faceting': ' ~ Species',
                            'faceting_model': 'Species ~ Site ~ Condition',
                        }
                        
                        # Use ed50-fastapi CSV endpoint
                        ed50_service_url = os.getenv('ED50_SERVICE_URL', 'http://ed50-fastapi:8001/calculate-csv')
                        print(f"🧮 Calling ED50 service: {ed50_service_url}")
                        
                        response = requests.post(
                            ed50_service_url,
                            files=files,
                            data=data,
                            timeout=600  # 10 minutes for large files
                        )
                        
                        if response.status_code == 200:
                            # Service returns CSV directly
                            print("✅ ED50 calculation successful")
                            
                            # Save EDs to temp file
                            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_ed:
                                tmp_ed.write(response.text)
                                temp_ed_csv = tmp_ed.name
                            
                            # Read both files
                            df_raw_data = pd.read_csv(temp_raw_csv)
                            df_eds = pd.read_csv(temp_ed_csv)
                            
                            # Merge EDs into raw data
                            # Merge on ALL grouping columns used for ED calculation (including Genotype if present)
                            merge_cols = []
                            # Parse grouping properties to get all columns
                            grouping_list = [g.strip() for g in grouping.split(',')]
                            
                            # Check which grouping columns exist in both dataframes
                            for col in grouping_list:
                                # Try exact match first
                                if col in df_raw_data.columns and col in df_eds.columns:
                                    merge_cols.append(col)
                                    # Ensure string type for merge
                                    df_raw_data[col] = df_raw_data[col].astype(str)
                                    df_eds[col] = df_eds[col].astype(str)
                                    print(f"✅ Found merge column: {col}")
                                else:
                                    # Try case-insensitive match (for Genotype or other columns)
                                    found_in_raw = None
                                    found_in_eds = None
                                    
                                    for c in df_raw_data.columns:
                                        if c.lower() == col.lower():
                                            found_in_raw = c
                                            break
                                    
                                    for c in df_eds.columns:
                                        if c.lower() == col.lower():
                                            found_in_eds = c
                                            break
                                    
                                    if found_in_raw and found_in_eds:
                                        # Map EDs column to match raw data column name
                                        if found_in_raw != found_in_eds:
                                            df_eds = df_eds.rename(columns={found_in_eds: found_in_raw})
                                        merge_cols.append(found_in_raw)
                                        df_raw_data[found_in_raw] = df_raw_data[found_in_raw].astype(str)
                                        df_eds[found_in_raw] = df_eds[found_in_raw].astype(str)
                                        print(f"✅ Found merge column (case-insensitive): {found_in_raw}")
                                    else:
                                        print(f"⚠️ WARNING: {col} not found in both dataframes for merge")
                            
                            if not merge_cols:
                                print("❌ No common merge columns found")
                                return Response({
                                    'error': 'Cannot merge ED values - no common grouping columns found'
                                }, status=status.HTTP_400_BAD_REQUEST)
                            
                            print(f"🔗 Merging EDs on columns: {merge_cols}")
                            
                            # Select ED columns from EDs dataframe
                            ed_cols = [c for c in df_eds.columns if c.upper() in ['ED5', 'ED50', 'ED95']]
                            df_with_eds = df_raw_data.merge(
                                df_eds[merge_cols + ed_cols],
                                on=merge_cols,
                                how='left'
                            )
                            
                            
                        else:
                            print(f"❌ ED50 service returned status {response.status_code}")
                            error_text = response.text[:500] if response.text else 'No error message'
                            return Response({
                                'error': f'ED50 calculation failed: {error_text}'
                            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                            
                except requests.exceptions.ConnectionError:
                    print("❌ ED50 service unavailable")
                    return Response({
                        'error': 'ED50 calculation service is not available. Please pre-calculate EDs and include them in your upload.'
                    }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                except requests.exceptions.Timeout:
                    print("❌ ED50 calculation timeout")
                    return Response({
                        'error': 'ED50 calculation timed out. Please try with a smaller dataset or pre-calculate EDs.'
                    }, status=status.HTTP_408_REQUEST_TIMEOUT)
            
            # ==============================================================
            # STEP 3: Normalize ED column names to standard format
            # ==============================================================
            print("🔧 Normalizing ED column names...")
            ed_mapping = {}
            for col in df_with_eds.columns:
                col_lower = col.lower()
                if 'ed50' in col_lower:
                    ed_mapping[col] = 'Colony.ed50'
                elif 'ed5' in col_lower and 'ed50' not in col_lower:
                    ed_mapping[col] = 'Colony.ed5'
                elif 'ed95' in col_lower:
                    ed_mapping[col] = 'Colony.ed95'
            
            if ed_mapping:
                df_with_eds.rename(columns=ed_mapping, inplace=True)
                print(f"✅ Normalized ED columns: {list(ed_mapping.values())}")
            
            # Verify ED50 exists
            if 'Colony.ed50' not in df_with_eds.columns:
                return Response({
                    'error': 'No ED50 values found after processing. Please ensure your data contains ED50 values.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ==============================================================
            # STEP 4: Save to temp file for populate_db
            # NOTE: No deduplication here - populate_db will handle it via get_or_create
            # ==============================================================
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as temp_csv:
                df_with_eds.to_csv(temp_csv.name, index=False)
                temp_combined_csv = temp_csv.name
            print(f"💾 Data with EDs saved to: {temp_combined_csv}")

            # ==============================================================
            # STEP 5: Run populate_db (includes column mapping inside)
            # ==============================================================
            print("🔄 Starting populate_db with column mapping...")
            
            # Track projects created during this upload for cleanup on error
            projects_before = set(Project.objects.filter(
                owner=request.user,
                description=upload_description
            ).values_list('id', flat=True))
            
            command_args = [
                '--csv_path', temp_combined_csv,
                '--owner', request.user.username,
            ]
            if no_pam:
                command_args.append('--no-pam')

            call_command('populate_db', *command_args)
            
            # Get projects created during this upload
            projects_after = set(Project.objects.filter(
                owner=request.user,
                description=upload_description
            ).values_list('id', flat=True))
            created_project_ids = projects_after - projects_before
            
            # ==============================================================
            # STEP 6: Assign MMM values and calculate relative metrics
            # ==============================================================
            print("🌡️ Assigning MMM values...")
            call_command('assign_mmm')
            print("✅ assign_mmm completed successfully")

            return Response({
                'message': 'Data uploaded and processed successfully',
                'filename': csv_file.name,
                'rows_processed': len(df_with_eds),
                'ed_source': 'pre-calculated' if has_ed_columns else 'calculated'
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"❌ Error during upload processing: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Clean up projects created during this failed upload
            try:
                if created_project_ids:
                    Project.objects.filter(id__in=created_project_ids).delete()
                    print(f"🗑️ Deleted {len(created_project_ids)} projects from failed upload")
                else:
                    # Fallback: delete projects with this description created recently
                    cutoff_time = timezone.now() - timedelta(minutes=5)
                    failed_projects = Project.objects.filter(
                        owner=request.user,
                        description=upload_description,
                        registration_date__gte=cutoff_time.date()
                    )
                    count = failed_projects.count()
                    failed_projects.delete()
                    if count > 0:
                        print(f"🗑️ Deleted {count} projects from failed upload (fallback cleanup)")
            except Exception as cleanup_error:
                print(f"⚠️ Failed to clean up projects: {cleanup_error}")
            
            return Response({
                'error': f'Failed to process CSV file: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        finally:
            # Clean up temporary files
            for temp_file in [temp_raw_csv, temp_ed_csv, temp_combined_csv]:
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.unlink(temp_file)
                        print(f"🗑️ Cleaned up: {temp_file}")
                    except Exception as cleanup_error:
                        print(f"⚠️ Failed to clean up {temp_file}: {cleanup_error}")


class ProjectsApiView(APIView):
    """
    This endpoint allows users to retrieve a list of available Projects.
    """

    def get(self, request):
        projects = Project.objects.all()
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BioSamplesApiView(APIView):
    """
    This endpoint allows users to retrieve a list of BioSamples.
    """

    def get(self, request):
        biosamples = BioSample.objects.all()
        serializer = BioSampleSerializer(biosamples, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ColoniesApiView(APIView):
    """
    This endpoint allows users to retrieve a list of Colonies.
    """

    def get(self, request):
        colonies = Colony.objects.all()
        serializer = ColonySerializer(colonies, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ThermalToleranceApiView(APIView):
    """
    This endpoint allows users to retriev a list of ThermalTolerance objects.
    """

    def get(self, request):
        thermal_tolerances = ThermalTolerance.objects.all()
        serializer = ThermalToleranceSerializer(thermal_tolerances, many=True)
        return Response(serializer.data)


class BreakpointTemperatureApiView(APIView):
    """
    This endpoint allows users to retrieve a list of BreakpointTemperature objects.
    """

    def get(self, request):
        breakpoint_temperatures = BreakpointTemperature.objects.all()
        serializer = BreakpointTemperatureSerializer(breakpoint_temperatures, many=True)
        return Response(serializer.data)


class ThermalLimitApiView(APIView):
    """
    This endpoint allows users to retrieve a list of ThermalLimit objects.
    """

    def get(self, request):
        thermal_limits = ThermalLimit.objects.all()
        serializer = ThermalLimitSerializer(thermal_limits, many=True)
        return Response(serializer.data)


class ThermalToleranceMinMaxView(APIView):
    def get(self, request):
        max_abs_thermal_tolerance = ThermalTolerance.objects.exclude(
            abs_thermal_tolerance__isnull=True).aggregate(
            Max('abs_thermal_tolerance'))['abs_thermal_tolerance__max']

        min_abs_thermal_tolerance = ThermalTolerance.objects.exclude(
            abs_thermal_tolerance__isnull=True).aggregate(
            Min('abs_thermal_tolerance'))['abs_thermal_tolerance__min']

        max_rel_thermal_tolerance = ThermalTolerance.objects.exclude(
            rel_thermal_tolerance__isnull=True).aggregate(
            Max('rel_thermal_tolerance'))['rel_thermal_tolerance__max']

        min_rel_thermal_tolerance = ThermalTolerance.objects.exclude(
            rel_thermal_tolerance__isnull=True).aggregate(
            Min('rel_thermal_tolerance'))['rel_thermal_tolerance__min']

        # Construct the response data
        response_data = {
            'max_abs_thermal_tolerance': max_abs_thermal_tolerance,
            'min_abs_thermal_tolerance': min_abs_thermal_tolerance,
            'max_rel_thermal_tolerance': max_rel_thermal_tolerance,
            'min_rel_thermal_tolerance': min_rel_thermal_tolerance
        }

        # Return the response
        return Response(response_data)


class BreakpointTemperatureMinMaxView(APIView):
    def get(self, request):
        max_abs_breakpoint_temperature = BreakpointTemperature.objects.exclude(
            abs_breakpoint_temperature__isnull=True).aggregate(
            Max('abs_breakpoint_temperature'))['abs_breakpoint_temperature__max']

        min_abs_breakpoint_temperature = BreakpointTemperature.objects.exclude(
            abs_breakpoint_temperature__isnull=True).aggregate(
            Min('abs_breakpoint_temperature'))['abs_breakpoint_temperature__min']

        max_rel_breakpoint_temperature = BreakpointTemperature.objects.exclude(
            rel_breakpoint_temperature__isnull=True).aggregate(
            Max('rel_breakpoint_temperature'))['rel_breakpoint_temperature__max']

        min_rel_breakpoint_temperature = BreakpointTemperature.objects.exclude(
            rel_breakpoint_temperature__isnull=True).aggregate(
            Min('rel_breakpoint_temperature'))['rel_breakpoint_temperature__min']

        # Construct the response data
        response_data = {
            'max_abs_breakpoint_temperature': max_abs_breakpoint_temperature,
            'min_abs_breakpoint_temperature': min_abs_breakpoint_temperature,
            'max_rel_breakpoint_temperature': max_rel_breakpoint_temperature,
            'min_rel_breakpoint_temperature': min_rel_breakpoint_temperature
        }

        # Return the response
        return Response(response_data)


class ThermalLimitMinMaxView(APIView):
    def get(self, request):
        max_abs_thermal_limit = ThermalLimit.objects.exclude(
            abs_thermal_limit__isnull=True).aggregate(
            Max('abs_thermal_limit'))['abs_thermal_limit__max']

        min_abs_thermal_limit = ThermalLimit.objects.exclude(
            abs_thermal_limit__isnull=True).aggregate(
            Min('abs_thermal_limit'))['abs_thermal_limit__min']

        max_rel_thermal_limit = ThermalLimit.objects.exclude(
            rel_thermal_limit__isnull=True).aggregate(
            Max('rel_thermal_limit'))['rel_thermal_limit__max']

        min_rel_thermal_limit = ThermalLimit.objects.exclude(
            rel_thermal_limit__isnull=True).aggregate(
            Min('rel_thermal_limit'))['rel_thermal_limit__min']

        # Construct the response data
        response_data = {
            'max_abs_thermal_limit': max_abs_thermal_limit,
            'min_abs_thermal_limit': min_abs_thermal_limit,
            'max_rel_thermal_limit': max_rel_thermal_limit,
            'min_rel_thermal_limit': min_rel_thermal_limit
        }

        # Return the response
        return Response(response_data)


class ObservationsApiView(APIView):
    """
    This endpoint allows users to retrieve a list of Observations.
    """

    def get(self, request):
        observations = Observation.objects.all()
        serializer = ObservationSerializer(observations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ObservationsByBioSampleView(generics.GenericAPIView):
    """
    This endpoint allows user to retrieve Observations by list of BioSamples.
    """
    queryset = Observation.objects.all()
    serializer_class = ObservationSerializer

    def get(self, request, *args, **kwargs):
        biosample_ids = request.query_params.get('biosample_ids', None)
        if biosample_ids is not None:
            biosample_ids = [int(id) for id in biosample_ids.split(',')]
            observations = self.get_queryset().filter(
                biosample_id__in=biosample_ids)
            serializer = self.get_serializer(observations, many=True)
            return Response(serializer.data)
        else:
            return Response({"error": "No biosample_ids provided"}, status=400)


class UserCartApiView(APIView):
    """
    This endpoint allows to operate with user cart groups.
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all cart groups for the user with complete colony data."""
        cart_groups = CartGroup.objects.filter(owner=request.user).prefetch_related(
            'colonies', 'cart_items'
        )
        
        groups_data = []
        for group in cart_groups:
            group_data = {
                'id': group.id,
                'name': group.name,
                'created_at': group.created_at,
                'updated_at': group.updated_at,
                'filter_params': group.filter_params,
                'colony_count': group.colony_count,
                'colonies': []
            }
            
            # Get complete colony data from CartItem
            for cart_item in group.cart_items.all():
                group_data['colonies'].append(cart_item.colony_data)
            
            groups_data.append(group_data)
        
        return Response(groups_data)

    def post(self, request):
        """
        Create a new cart group with colonies and filters.
        Example: {
            "name": "My Filter Group",
            "colony_ids": [1, 2, 3],
            "filter_params": {"species": "Acropora", "temperature": [25, 30]}
        }
        """
        name = request.data.get('name', 'Filter Group')
        colony_ids = request.data.get('colony_ids', [])
        filter_params = request.data.get('filter_params', {})

        if not colony_ids:
            return Response({'error': 'No colony_ids provided'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create new cart group
            cart_group = CartGroup.objects.create(
                owner=request.user,
                name=name,
                filter_params=filter_params
            )

            # Add colonies to the group
            colonies = Colony.objects.filter(id__in=colony_ids)
            cart_group.colonies.set(colonies)

            # Create CartItem objects for each colony (this will auto-populate colony_data)
            for colony in colonies:
                CartItem.objects.create(
                    cart_group=cart_group,
                    colony=colony
                )

            return Response({
                'message': f'Cart group "{name}" created with {colonies.count()} colonies',
                'group_id': cart_group.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete a specific cart group."""
        group_id = request.data.get('group_id')
        if not group_id:
            return Response({'error': 'group_id required'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        try:
            cart_group = CartGroup.objects.get(id=group_id, owner=request.user)
            cart_group.delete()
            return Response({'message': 'Cart group deleted successfully'})
        except CartGroup.DoesNotExist:
            return Response({'error': 'Cart group not found'}, 
                          status=status.HTTP_404_NOT_FOUND)


class CalculateED50ApiView(APIView):
    """
    This endpoint sends data to the ED50 calculator service for processing.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if 'csv_file' not in request.FILES:
            return Response({'error': 'No CSV file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = request.FILES['csv_file']
        
        # Validate file type
        if not csv_file.name.lower().endswith('.csv'):
            return Response({'error': 'File must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            import requests
            
            # Forward the file to ED50 calculator service
            files = {'file': (csv_file.name, csv_file.read(), 'text/csv')}
            
            # ED50 calculator service URL
            ed50_service_url = 'http://ed50-calculator:5000/calculate'
            
            print(f"🧮 Sending file to ED50 calculator: {csv_file.name}")
            
            # Make request to ED50 service
            response = requests.post(ed50_service_url, files=files, timeout=300)
            
            if response.status_code == 200:
                results = response.json()
                print(f"✅ ED50 calculation successful: {results.get('status', 'unknown')}")
                
                return Response({
                    'status': 'success',
                    'message': 'ED50 calculation completed successfully',
                    'results': results,
                    'filename': csv_file.name
                }, status=status.HTTP_200_OK)
            else:
                error_data = response.json() if response.headers.get('content-type') == 'application/json' else {'error': response.text}
                print(f"❌ ED50 calculation failed: {error_data}")
                
                return Response({
                    'error': 'ED50 calculation failed',
                    'details': error_data,
                    'service_status': response.status_code
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except requests.exceptions.ConnectionError:
            return Response({
                'error': 'ED50 calculator service is not available',
                'message': 'Please ensure the ED50 calculator service is running'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except requests.exceptions.Timeout:
            return Response({
                'error': 'ED50 calculation timed out',
                'message': 'The calculation took too long to complete'
            }, status=status.HTTP_408_REQUEST_TIMEOUT)
        except Exception as e:
            print(f"❌ Error communicating with ED50 service: {str(e)}")
            return Response({
                'error': f'Failed to calculate ED50: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CartGroupManagementApiView(APIView):
    """
    Endpoint for managing individual cart groups (rename, update).
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def put(self, request, group_id):
        """Update cart group name."""
        try:
            cart_group = CartGroup.objects.get(id=group_id, owner=request.user)
            new_name = request.data.get('name')
            
            if not new_name:
                return Response({'error': 'name field required'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            cart_group.name = new_name
            cart_group.save()
            
            return Response({
                'message': 'Cart group renamed successfully',
                'new_name': new_name
            })
            
        except CartGroup.DoesNotExist:
            return Response({'error': 'Cart group not found'}, 
                          status=status.HTTP_404_NOT_FOUND)


class CartExportApiView(APIView):
    """
    Endpoint for exporting cart data as CSV.
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Export selected cart groups as CSV."""
        group_ids = request.data.get('group_ids', [])
        export_all = request.data.get('export_all', False)
        
        if not export_all and not group_ids:
            return Response({'error': 'Either export_all or group_ids required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if export_all:
                cart_groups = CartGroup.objects.filter(owner=request.user)
            else:
                cart_groups = CartGroup.objects.filter(id__in=group_ids, owner=request.user)
            
            if not cart_groups.exists():
                return Response({'error': 'No cart groups found'}, 
                              status=status.HTTP_404_NOT_FOUND)
            
            # Generate CSV data
            import csv
            from io import StringIO
            
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header
            header = [
                'Group Name', 'Project Name', 'Experiment Name', 'Colony ID', 'Colony Name', 
                'Species', 'Country', 'Latitude', 'Longitude', 'SST Clim MMM', 
                'Collection Date', 'Site', 'Condition', 'Temperature', 'Timepoint',
                'abs. ED50', 'rel. ED50 (ED50-MMM)', 'abs. ED5', 'rel. ED5 (ED5-MMM)', 
                'abs. ED95', 'rel. ED95 (ED95-MMM)'
            ]
            writer.writerow(header)
            
            # Write data rows
            for group in cart_groups:
                for cart_item in group.cart_items.all():
                    colony_data = cart_item.colony_data
                    
                    # Get basic colony info
                    colony = colony_data['colony']
                    
                    # Process biosamples and observations
                    for biosample in colony_data.get('biosamples', []):
                        for observation in biosample.get('observations', []):
                            # Initialize row with proper order
                            row = [
                                group.name,  # 0: Group Name
                                observation.get('experiment', {}).get('project', {}).get('name', ''),  # 1: Project Name
                                observation.get('experiment', {}).get('name', ''),  # 2: Experiment Name
                                colony['id'],  # 3: Colony ID
                                colony['name'],  # 4: Colony Name
                                colony['species'],  # 5: Species
                                colony['country'],  # 6: Country
                                colony['latitude'],  # 7: Latitude
                                colony['longitude'],  # 8: Longitude
                                '',  # 9: SST Clim MMM (will be filled from thermal data)
                                biosample.get('collection_date', ''),  # 10: Collection Date
                                observation.get('experiment', {}).get('name', ''),  # 11: Site
                                observation.get('condition', ''),  # 12: Condition
                                observation.get('temperature', ''),  # 13: Temperature
                                observation.get('timepoint', ''),  # 14: Timepoint
                                '',  # 15: abs. ED50 (will be filled from thermal data)
                                '',  # 16: rel. ED50 (ED50-MMM)
                                '',  # 17: abs. ED5 (will be filled from breakpoint data)
                                '',  # 18: rel. ED5 (ED5-MMM)
                                '',  # 19: abs. ED95 (will be filled from thermal limit data)
                                ''   # 20: rel. ED95 (ED95-MMM)
                            ]
                            
                            # Add thermal tolerance data if available
                            for tt in colony_data.get('thermal_tolerances', []):
                                if (tt.get('condition') == observation.get('condition') and 
                                    tt.get('timepoint') == observation.get('timepoint')):
                                    row[9] = tt.get('sst_clim_mmm', '')  # SST Clim MMM
                                    row[15] = tt.get('abs_thermal_tolerance', '')  # abs. ED50
                                    row[16] = tt.get('rel_thermal_tolerance', '')  # rel. ED50 (ED50-MMM)
                                    break
                            
                            # Add breakpoint temperature data if available
                            for bt in colony_data.get('breakpoint_temperatures', []):
                                if (bt.get('condition') == observation.get('condition') and 
                                    bt.get('timepoint') == observation.get('timepoint')):
                                    # Use SST from breakpoint if not already set
                                    if not row[9]:
                                        row[9] = bt.get('sst_clim_mmm', '')
                                    row[17] = bt.get('abs_breakpoint_temperature', '')  # abs. ED5
                                    row[18] = bt.get('rel_breakpoint_temperature', '')  # rel. ED5 (ED5-MMM)
                                    break
                            
                            # Add thermal limit data if available
                            for tl in colony_data.get('thermal_limits', []):
                                if (tl.get('condition') == observation.get('condition') and 
                                    tl.get('timepoint') == observation.get('timepoint')):
                                    # Use SST from thermal limit if not already set
                                    if not row[9]:
                                        row[9] = tl.get('sst_clim_mmm', '')
                                    row[19] = tl.get('abs_thermal_limit', '')  # abs. ED95
                                    row[20] = tl.get('rel_thermal_limit', '')  # rel. ED95 (ED95-MMM)
                                    break
                            
                            writer.writerow(row)
            
            # Prepare response
            output.seek(0)
            csv_content = output.getvalue()
            
            from django.http import HttpResponse
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="coral_cart_export.csv"'
            
            return response
            
        except Exception as e:
            return Response({'error': f'Export failed: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StatisticsApiView(APIView):
    """
    Endpoint for getting public statistics about coral data.
    This endpoint is accessible without authentication.
    """

    def get(self, request):
        """Get statistics about coral colonies, projects, countries, and data availability."""
        try:
            # Count coral colonies
            colonies_count = Colony.objects.count()
            
            # Count research projects
            projects_count = Project.objects.count()
            
            # Count unique countries
            countries_count = Colony.objects.values('country').distinct().count()
            
            # Count total observations (for 24/7 data access indicator)
            observations_count = Observation.objects.count()
            
            # Additional statistics for better context
            species_count = Colony.objects.values('species').distinct().count()
            
            # Get some recent activity indicators
            recent_observations = Observation.objects.filter(
                experiment__project__registration_date__isnull=False
            ).count()
            
            # Countries with most colonies
            top_countries = Colony.objects.values('country').annotate(
                colony_count=Count('id')
            ).order_by('-colony_count')[:5]
            
            # Species with most colonies
            top_species = Colony.objects.values('species').annotate(
                colony_count=Count('id')
            ).order_by('-colony_count')[:5]
            
            return Response({
                'coral_colonies': colonies_count,
                'research_projects': projects_count,
                'countries': countries_count,
                'data_access_24_7': observations_count > 0,  # True if we have observations
                'observations_count': observations_count,
                'species_count': species_count,
                'recent_observations': recent_observations,
                'top_countries': list(top_countries),
                'top_species': list(top_species),
                'last_updated': '2024-01-01'  # You can make this dynamic if needed
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': f'Failed to get statistics: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



