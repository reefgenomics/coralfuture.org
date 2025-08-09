# api/views.py
import os
import tempfile
import pandas as pd
from django.db.models import Max, Min
from django.core.management import call_command

from rest_framework import generics, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.serializers import BioSampleSerializer, \
    ColonySerializer, ThermalToleranceSerializer, \
    ObservationSerializer, ProjectSerializer, BreakpointTemperatureSerializer, ThermalLimitSerializer
# Apps imports
from projects.models import BioSample, Observation, Colony, \
    ThermalTolerance, Project, UserCart, BreakpointTemperature, ThermalLimit


class CheckAuthenticationApiView(APIView):
    """
    This endpoint allows to check if user is authenticated.
    """

    def get(self, request):
        return Response({
            'authenticated': request.user.is_authenticated,
            'username': request.user.username})


class CheckCSVForED50ApiView(APIView):
    """
    This endpoint checks if a CSV file contains ED50 values after AI processing. 
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
            # Read CSV and process with AI mapper
            df = pd.read_csv(csv_file)
            print(f"📊 Original CSV columns: {df.columns.tolist()}")
            
            # Use AI mapper to transform to standard schema
            from projects.management.commands.utils.column_auto_mapper import map_and_transform_dataframe
            
            try:
                transformed_df, instructions = map_and_transform_dataframe(df, return_instructions=True)
                print(f"🤖 AI transformed columns: {transformed_df.columns.tolist()}")
                
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
                    print(f"❌ ED50 column not found in transformed data")
                
                return Response({
                    'has_ed50': has_ed50,
                    'ed50_info': ed50_info,
                    'ai_mapping': instructions.get('mapping', {}),
                    'original_columns': df.columns.tolist(),
                    'transformed_columns': transformed_df.columns.tolist(),
                    'filename': csv_file.name
                }, status=status.HTTP_200_OK)
                
            except Exception as ai_error:
                print(f"🤖 AI mapping failed: {str(ai_error)}")
                # Fallback to simple column check if AI fails
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
                    'ai_mapping_failed': True,
                    'ai_error': str(ai_error),
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
    This endpoint allows authenticated users to upload CSV files with coral research data.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if 'csv_file' not in request.FILES:
            return Response({'error': 'No CSV file provided'}, status=status.HTTP_400_BAD_REQUEST)

        csv_file = request.FILES['csv_file']
        ed50_file = request.FILES.get('ed50_file')  # optional
        no_pam = request.data.get('no_pam', False) == 'true'

        print(f"📁 Main CSV: {csv_file.name} | ED50 CSV: {ed50_file.name if ed50_file else '—'} | No PAM: {no_pam}")

        # Validate file types
        if not csv_file.name.lower().endswith('.csv'):
            return Response({'error': 'Main file must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)
        if ed50_file and not ed50_file.name.lower().endswith('.csv'):
            return Response({'error': 'ED50 file must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Read main CSV into dataframe for ED50 presence check / potential merge
            df_main = pd.read_csv(csv_file)
            print(f"📊 Loaded main CSV with {len(df_main)} rows & {len(df_main.columns)} columns")

            # Detect existing ED50 column in main CSV and standardise its name
            ed50_patterns = ['ed50', 'Colony.ed50', 'ed50_value']
            ed50_col_in_main = next((col for col in df_main.columns if any(p.lower() in col.lower() for p in ed50_patterns)), None)
            has_ed50 = ed50_col_in_main is not None

            # If ED50 present but column not yet standardised, rename it
            if has_ed50 and ed50_col_in_main != 'Colony.ed50':
                df_main.rename(columns={ed50_col_in_main: 'Colony.ed50'}, inplace=True)
                print(f"🔧 Renamed '{ed50_col_in_main}' -> 'Colony.ed50' in main CSV")

            if not has_ed50 and ed50_file is None:
                return Response({
                    'error': 'No ED50 values detected in the main CSV. Please upload a matching ED50 results CSV as well.'
                }, status=status.HTTP_400_BAD_REQUEST)

            if not has_ed50 and ed50_file is not None:
                # Merge ED50 columns from provided file
                df_ed = pd.read_csv(ed50_file)
                print(f"📊 Loaded ED50 CSV with {len(df_ed)} rows & {len(df_ed.columns)} columns")

                # -----------------------------------------------------------------
                # Harmonise ED50 dataframe columns & prepare for merge
                # -----------------------------------------------------------------

                # 1) Detect the ED50 column name (case-insensitive)
                ed50_column_name = next((c for c in df_ed.columns if c.lower() == 'ed50'), None)
                if ed50_column_name is None:
                    return Response({
                        'error': 'ED50 column not found in the provided ED50 CSV.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Also detect ED5 and ED95 columns
                ed5_column_name = next((c for c in df_ed.columns if c.lower() == 'ed5'), None)
                ed95_column_name = next((c for c in df_ed.columns if c.lower() == 'ed95'), None)

                # 2) If the ED50 results file contains a composite "GroupingProperty"
                #    but lacks an explicit Genotype column, extract it from the string.
                if 'Genotype' not in df_ed.columns and 'GroupingProperty' in df_ed.columns:
                    df_ed['Genotype'] = df_ed['GroupingProperty'].astype(str).apply(
                        lambda s: s.split('_')[-1] if '_' in s else pd.NA
                    )

                # 3) Ensure dtype consistency between both dataframes for merge keys
                for col in ['Site', 'Condition', 'Species', 'Genotype', 'Timepoint']:
                    if col in df_main.columns:
                        df_main[col] = df_main[col].astype(str)
                    if col in df_ed.columns:
                        df_ed[col] = df_ed[col].astype(str)

                # Attempt merge using common descriptive columns
                candidate_keys = ['Site', 'Condition', 'Species', 'Genotype', 'Timepoint']
                merge_keys = [k for k in candidate_keys if k in df_main.columns and k in df_ed.columns]

                if merge_keys:
                    print(f"🔗 Attempting merge using keys: {merge_keys}")
                    
                    # Build list of columns to merge
                    ed_columns_to_merge = [ed50_column_name]
                    if ed5_column_name:
                        ed_columns_to_merge.append(ed5_column_name)
                    if ed95_column_name:
                        ed_columns_to_merge.append(ed95_column_name)
                    
                    df_combined = df_main.merge(
                        df_ed[merge_keys + ed_columns_to_merge],
                        on=merge_keys,
                        how='left'
                    )
                    
                    # Rename columns to standard names
                    df_combined.rename(columns={ed50_column_name: 'Colony.ed50'}, inplace=True)
                    if ed5_column_name:
                        df_combined.rename(columns={ed5_column_name: 'Colony.ed5'}, inplace=True)
                    if ed95_column_name:
                        df_combined.rename(columns={ed95_column_name: 'Colony.ed95'}, inplace=True)

                    missing_after_merge = df_combined['Colony.ed50'].isna().sum()
                    print(f"ℹ️ Missing ED50 after key-merge: {missing_after_merge}")

                    # If still missing, try fill per Temperature group (common 10× pattern)
                    if missing_after_merge > 0 and 'Temperature' in df_ed.columns:
                        temp_to_ed50 = df_ed.groupby('Temperature')[ed50_column_name].first().to_dict()
                        df_combined['Colony.ed50'] = df_combined.apply(
                            lambda row: temp_to_ed50.get(row['Temperature']) if pd.isna(row['Colony.ed50']) else row['Colony.ed50'],
                            axis=1
                        )
                        
                        # Also fill ED5 and ED95 if available
                        if ed5_column_name:
                            temp_to_ed5 = df_ed.groupby('Temperature')[ed5_column_name].first().to_dict()
                            df_combined['Colony.ed5'] = df_combined.apply(
                                lambda row: temp_to_ed5.get(row['Temperature']) if pd.isna(row.get('Colony.ed5', pd.NA)) else row.get('Colony.ed5'),
                                axis=1
                            )
                        if ed95_column_name:
                            temp_to_ed95 = df_ed.groupby('Temperature')[ed95_column_name].first().to_dict()
                            df_combined['Colony.ed95'] = df_combined.apply(
                                lambda row: temp_to_ed95.get(row['Temperature']) if pd.isna(row.get('Colony.ed95', pd.NA)) else row.get('Colony.ed95'),
                                axis=1
                            )
                        
                        missing_after_fill = df_combined['Colony.ed50'].isna().sum()
                        print(f"ℹ️ Missing ED50 after temperature fill: {missing_after_fill}")
                else:
                    # Fallback: align by row order length multiple (e.g., 10×)
                    factor = len(df_main) // len(df_ed) if len(df_ed) > 0 else 0
                    if factor * len(df_ed) == len(df_main):
                        print(f"🔗 Replicating each ED row {factor}× to match main rows")
                        repeated_ed = df_ed.loc[df_ed.index.repeat(factor)].reset_index(drop=True)
                        df_combined = df_main.copy()
                        df_combined['Colony.ed50'] = repeated_ed[ed50_column_name].values
                        if ed5_column_name:
                            df_combined['Colony.ed5'] = repeated_ed[ed5_column_name].values
                        if ed95_column_name:
                            df_combined['Colony.ed95'] = repeated_ed[ed95_column_name].values
                    else:
                        return Response({
                            'error': 'ED50 file row count does not match main CSV and unable to merge on common keys.'
                        }, status=status.HTTP_400_BAD_REQUEST)
            else:
                df_combined = df_main  # already contains ED50 (now standardised)

            # -------------------------------------------------------------
            # Verify that every row now has ED50 and save merged CSV to /tmp
            # -------------------------------------------------------------
            if 'Colony.ed50' not in df_combined.columns:
                return Response({'error': 'Merge failed – Colony.ed50 column missing after processing.'}, status=status.HTTP_400_BAD_REQUEST)

            missing_final = df_combined['Colony.ed50'].isna().sum()
            if missing_final > 0:
                return Response({'error': f'Merge incomplete – {missing_final} rows still missing ED50 after merge.'}, status=status.HTTP_400_BAD_REQUEST)

            # Save merged CSV to tmp for manual inspection
            merged_filename = f"merged_{csv_file.name}"
            merged_path = os.path.join(tempfile.gettempdir(), merged_filename)
            try:
                df_combined.to_csv(merged_path, index=False)
                print(f"📝 Merged CSV saved for audit: {merged_path}")
            except Exception as save_exc:
                print(f"⚠️ Could not save merged CSV for audit: {save_exc}")

            # -----------------------------------------------------------------
            # Save combined dataframe to a temporary CSV file for populate_db
            # -----------------------------------------------------------------
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as temp_csv:
                df_combined.to_csv(temp_csv.name, index=False)
                temp_file_path = temp_csv.name
            print(f"💾 Temp combined CSV saved to {temp_file_path}")

            # Build command args for populate_db
            command_args = [
                '--csv_path', temp_file_path,
                '--owner', request.user.username,
            ]
            if no_pam:
                command_args.append('--no-pam')

            print(f"🚀 Running command: populate_db {' '.join(command_args)}")
            call_command('populate_db', *command_args)
            print("✅ populate_db completed successfully")
            
            # Automatically assign MMM values and recalculate rel numbers
            print("🚀 Running command: assign_mmm")
            call_command('assign_mmm')
            print("✅ assign_mmm completed successfully")

            return Response({
                'message': 'CSV data uploaded and processed successfully',
                'filename': csv_file.name,
                'ed50_source': 'inline' if has_ed50 else ed50_file.name
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"❌ Error during upload processing: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Failed to process CSV file: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        finally:
            # Clean up temporary file
            if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                print(f"🗑️ Temp combined CSV deleted: {temp_file_path}")


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
    This endpoint allows to operate with user cart.
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_cart, created = UserCart.objects.get_or_create(owner=request.user)
        items = user_cart.items.all()
        serializer = ColonySerializer(items, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        Example: {"colony_ids": [1,2]}
        """
        # Extract colony IDs from request data (assuming they are provided as a list)
        colony_ids = request.data.get('colony_ids', [])

        # Initialize an empty list to store successfully added colonies
        added_colonies = []

        for colony_id in colony_ids:
            try:
                # Retrieve the Colonies object with the specified ID
                colony = Colony.objects.get(id=colony_id)
                # Add the colony to the user's cart
                user_cart, created = UserCart.objects.get_or_create(
                    owner=request.user)
                user_cart.items.add(colony)
                added_colonies.append(colony_id)
            except Colony.DoesNotExist:
                pass  # Ignore samples that don't exist

        if added_colonies:
            return Response({
                'message': f'Colonies {added_colonies} added to cart successfully'})
        else:
            return Response({'error': 'No valid colonies found'},
                            status=status.HTTP_404_NOT_FOUND)

    def delete(self, request):
        user_cart, created = UserCart.objects.get_or_create(owner=request.user)
        user_cart.items.clear()
        return Response({'message': 'Cart cleaned successfully'})


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
