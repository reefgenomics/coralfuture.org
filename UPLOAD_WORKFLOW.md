# Clean Upload Workflow Documentation

## Overview
The system now uses a **clean, reliable workflow** that automatically handles ED calculation and AI-powered column mapping.

## Workflow Steps

```
User Upload CSV → Check for EDs → Calculate if Missing → AI Mapping → Database Import
```

### Step 1: User Uploads Raw CSV
- **Frontend**: Single file upload (`UploadDataPage.js`)
- **Endpoint**: `POST /api/auth/upload-csv/`
- **Required**: CSV file with coral research data (PAM values, temperature, etc.)
- **Optional**: ED values (ED5, ED50, ED95) can be pre-calculated or will be auto-calculated

### Step 2: Backend Checks for ED Values
**File**: `django_app/api/views.py` → `UploadCSVApiView`

```python
# Check if ED columns exist
ed_patterns = ['ed50', 'ed5', 'ed95']
has_ed_columns = any(pattern in col.lower() for col in df.columns)
```

### Step 3: Auto-Calculate EDs (if missing)
**Service**: `ed50-fastapi` service

```python
# Call ED50 calculator service
ed50_service_url = 'http://ed50-fastapi:8001/calculate-csv'
response = requests.post(ed50_service_url, files=files, data=params)

# Returns CSV with ED5, ED50, ED95 columns
df_eds = pd.read_csv(response.text)

# Merge EDs back into raw data
df_with_eds = df_raw.merge(df_eds, on=['Site', 'Condition', 'Species', 'Timepoint'])
```

**New Endpoint**: `/calculate-csv` returns CSV directly (not HTML)

### Step 4: Normalize ED Column Names
```python
# Standardize to: Colony.ed5, Colony.ed50, Colony.ed95
ed_mapping = {}
for col in df.columns:
    if 'ed50' in col.lower():
        ed_mapping[col] = 'Colony.ed50'
    elif 'ed5' in col.lower():
        ed_mapping[col] = 'Colony.ed5'
    elif 'ed95' in col.lower():
        ed_mapping[col] = 'Colony.ed95'

df.rename(columns=ed_mapping, inplace=True)
```

### Step 5: AI-Powered Column Mapping
**File**: `django_app/projects/management/commands/populate_db.py`

```python
# AI mapper transforms arbitrary columns to standard schema
from projects.management.commands.utils.column_auto_mapper import map_and_transform_dataframe

df_std, mapping_instructions = map_and_transform_dataframe(df_with_eds, return_instructions=True)
```

**Standard Schema**:
- `Project.name`
- `Experiment.name`, `Experiment.date`
- `Colony.name`, `Colony.species`, `Colony.country`, `Colony.latitude`, `Colony.longitude`
- `Colony.ed5`, `Colony.ed50`, `Colony.ed95`
- `BioSample.name`, `BioSample.collection_date`
- `Observation.condition`, `Observation.temperature`, `Observation.timepoint`, `Observation.pam_value`
- `Publication.title`, `Publication.year`, `Publication.doi`

### Step 6: Database Population
**Command**: `populate_db`

```python
# Create Django model instances
call_command('populate_db', '--csv_path', temp_file, '--owner', username)

# Objects created in order:
# 1. Project
# 2. Experiment
# 3. Colony
# 4. ThermalTolerance (ED50)
# 5. BreakpointTemperature (ED5)
# 6. ThermalLimit (ED95)
# 7. BioSample
# 8. Observation
# 9. Publication
```

### Step 7: Assign MMM Values
```python
# Calculate relative metrics based on MMM (Maximum Monthly Mean temperature)
call_command('assign_mmm')
```

## Key Features

### ✅ Reliable
- Single file upload (no confusion)
- Automatic ED calculation if missing
- AI handles column variations
- Comprehensive error handling

### ✅ Clean Code
- Clear separation of concerns
- Each step has single responsibility
- Well-documented functions
- Proper cleanup of temp files

### ✅ User-Friendly
- Upload one file
- System handles complexity
- Clear progress indication
- Helpful error messages

## Frontend Changes

### Before
- Two file uploads (main data + ED50 file)
- Manual ED calculation required
- Complex merge logic

### After
```javascript
// Single file upload
const formData = new FormData();
formData.append('csv_file', file);

// Backend handles everything
await axios.post('/api/auth/upload-csv/', formData);
```

## Error Handling

### ED Service Unavailable
```
Error: ED50 calculation service is not available. 
Please pre-calculate EDs and include them in your upload.
```

### No ED Values Found
```
Error: No ED50 values found after processing. 
Please ensure your data contains ED50 values.
```

### AI Mapping Failed
```
Error: Column auto-mapping failed: [details]
```

## Configuration

### Environment Variables
```bash
# ED50 service URL
ED50_SERVICE_URL=http://ed50-fastapi:8001/calculate-csv

# AI mapping (DeepSeek/OpenAI)
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
COLUMN_MAPPER_MODEL=deepseek-chat
```

## Testing Checklist

- [ ] Upload CSV with pre-calculated EDs → Should skip calculation
- [ ] Upload CSV without EDs → Should auto-calculate
- [ ] Various column name formats → AI should map correctly
- [ ] Large files (1000+ rows) → Should process without timeout
- [ ] Invalid data → Should show clear error message
- [ ] Service unavailable → Should provide fallback message

## Files Modified

### Backend
- `django_app/api/views.py` - Simplified upload endpoint
- `ed50-fastapi/main.py` - Added `/calculate-csv` endpoint
- `ed50-fastapi/templates/index.html` - Removed example data toggle

### Frontend
- `react_app/src/pages/Upload/UploadDataPage.js` - Single file upload UI

### Core Logic (Unchanged)
- `column_auto_mapper.py` - AI mapping logic
- `populate_db.py` - Database population
- `_create_objects.py` - Model creation

## Summary

The new workflow is:
1. **Simple**: One file upload
2. **Smart**: Auto-calculates EDs if needed
3. **Flexible**: AI handles column variations
4. **Reliable**: Comprehensive error handling
5. **Clean**: Well-structured code

Users no longer need to:
- Calculate EDs separately
- Upload multiple files
- Match column names exactly
- Understand technical details






