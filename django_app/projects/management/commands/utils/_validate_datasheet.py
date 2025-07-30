import pandas as pd


def check_unique_ed50_values(df):
    """
    Checks if all ED50 values for individual colony are the same.

    Args:
        df (pandas.DataFrame): Input DataFrame.

    Raises:
        ValueError: If any colony has more than one unique ED50 value.

    Returns:
        None
    """
    # Ensure all timepoint values are strings for consistent grouping
    if 'Observation.timepoint' in df.columns:
        df['Observation.timepoint'] = df['Observation.timepoint'].astype(str)
        
    for colony, group in df.groupby(
            ['Colony.name', 'Colony.species', 'Observation.condition', 'Observation.timepoint']):
        unique_values = group['Colony.ed50_value'].nunique()
        if unique_values != 1:
            raise ValueError(
                f"Colony '{colony}' has {unique_values} unique ed50 values. Must be only one.")


def validate_file_structure(df):
    """Validate basic CSV file structure and content."""
    if df.empty:
        raise ValueError("CSV file is empty - no data rows found")
    
    if len(df.columns) == 0:
        raise ValueError("CSV file has no columns")
    
    print(f"✅ File structure: {len(df)} rows, {len(df.columns)} columns")


def validate_required_columns(df):
    """Validate that all required columns are present."""
    required_columns = [
        'Project.name',
        'Colony.ed50_value',
        'BioSample.name',
        'BioSample.collection_date',
        'Observation.condition',
        'Observation.temperature',
        'Observation.timepoint',
        'Observation.pam_value',
        'Publication.title',
        'Publication.year',
        'Publication.doi'
    ]
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
    
    print(f"✅ Required columns: All {len(required_columns)} columns present")
    
    # Check for optional ED5 and ED95 columns
    optional_columns = ['Colony.ed5', 'Colony.ed95']
    present_optional = [col for col in optional_columns if col in df.columns]
    if present_optional:
        print(f"✅ Optional columns present: {', '.join(present_optional)}")


def validate_data_content(df):
    """Validate data content and formats."""
    # Check for completely empty rows
    empty_rows = df.isnull().all(axis=1).sum()
    if empty_rows > 0:
        print(f"⚠️ Warning: {empty_rows} completely empty rows found")
    
    # Check critical fields are not empty
    critical_fields = ['Project.name', 'Colony.ed50_value', 'BioSample.name']
    for field in critical_fields:
        if field in df.columns:
            empty_count = df[field].isnull().sum()
            if empty_count > 0:
                raise ValueError(f"Critical field '{field}' has {empty_count} empty values")
    
    # Check numeric fields
    numeric_fields = ['Colony.ed50_value', 'Observation.temperature']
    for field in numeric_fields:
        if field in df.columns:
            non_numeric = pd.to_numeric(df[field], errors='coerce').isnull().sum()
            if non_numeric > 0:
                raise ValueError(f"Field '{field}' has {non_numeric} non-numeric values")
    
    # Check optional numeric fields
    optional_numeric_fields = ['Colony.ed5', 'Colony.ed95']
    for field in optional_numeric_fields:
        if field in df.columns:
            non_numeric = pd.to_numeric(df[field], errors='coerce').isnull().sum()
            if non_numeric > 0:
                print(f"⚠️ Warning: Field '{field}' has {non_numeric} non-numeric values")
    
    print(f"✅ Data content: Validation passed for {len(df)} rows")


def validate_datasheet(df):
    """Main validation function."""
    print("🔍 Starting CSV validation...")
    
    try:
        validate_file_structure(df)
        validate_required_columns(df)
        validate_data_content(df)
        
        # Only run ed50 validation if needed (currently disabled)
        # check_unique_ed50_values(df)
        
        print("✅ CSV validation completed successfully")
        
    except Exception as e:
        print(f"❌ CSV validation failed: {str(e)}")
        raise
