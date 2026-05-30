"""
Column mapper for CoralFuture standard schema.

Maps CSV columns to standard schema using direct column name matching
and computed fields based on template expressions.
"""

from __future__ import annotations

import os
import re
from typing import Dict, List
from datetime import datetime

import pandas as pd


# ---------------------------------------------------------------------------
# Standard Schema Definition
# ---------------------------------------------------------------------------

STANDARD_COLUMNS: List[str] = [
    "Project.name",
    "Experiment.name",
    "Experiment.date",
    "Colony.name",
    "Colony.country",
    "Colony.latitude",
    "Colony.longitude",
    "Colony.species",
    "Colony.ed5",
    "Colony.ed50",
    "Colony.ed95",
    "BioSample.name",
    "BioSample.collection_date",
    "Observation.condition",
    "Observation.temperature",
    "Observation.timepoint",
    "Observation.pam_value",
    "Publication.title",
    "Publication.year",
    "Publication.doi",
]


# ---------------------------------------------------------------------------
# Direct Column Mapping
# ---------------------------------------------------------------------------

DIRECT_MAPPING: Dict[str, str] = {
    "Project": "Project.name",
    "Site": "Experiment.name",
    "Date": "Experiment.date",
    "Country": "Colony.country",
    "Latitude": "Colony.latitude",
    "Longitude": "Colony.longitude",
    "Species": "Colony.species",
    "Condition": "Observation.condition",
    "Temperature": "Observation.temperature",
    "Timepoint": "Observation.timepoint",
    "Pam_value": "Observation.pam_value",
}


def _find_temperature_input_column(df: pd.DataFrame) -> str | None:
    for col in df.columns:
        if str(col).strip().lower() == "temperature":
            return col
    return None


def _parse_single_temperature_token(segment: str, *, full_cell: str) -> float:
    t = segment.strip()
    t = re.sub(r"°?\s*[CcFf]\s*$", "", t).strip()
    t = t.replace(",", ".")
    if not re.fullmatch(r"-?\d+\.?\d*", t):
        raise ValueError(
            f"Invalid temperature segment {segment!r} in {full_cell!r}. "
            "Use '/' only between numeric temperatures, e.g. 28/32/36/40."
        )
    return float(t)


def expand_slash_separated_temperature_column(df: pd.DataFrame) -> pd.DataFrame:
    """
    Assay temperatures in column ``Temperature``:

    - Four values in one cell: ``28/32/36/40`` → one output row per value
      (ED columns duplicated).
    - One value per row already: ``28.0`` or ``28`` (e.g. after a prior expand and
      ``to_csv``) → left as a single numeric row (same pipeline runs twice on upload).
    """
    col = _find_temperature_input_column(df)
    if col is None:
        raise ValueError('Missing column "Temperature" (required for upload).')

    out_rows: List[dict] = []
    for i, (_, row) in enumerate(df.iterrows()):
        line_no = i + 2  # 1-based file line: header + data offset
        val = row[col]
        if pd.isna(val) or (isinstance(val, str) and not str(val).strip()):
            raise ValueError(f"Row {line_no}: Temperature is empty.")

        if isinstance(val, (int, float)) and not isinstance(val, bool):
            d = row.to_dict()
            d[col] = float(val)
            out_rows.append(d)
            continue

        s = str(val).strip()
        if "/" in s:
            parts = [p.strip() for p in s.split("/") if p.strip()]
            if len(parts) != 4:
                raise ValueError(
                    f'Row {line_no}: Temperature must list 4 assay values in one column, '
                    f'separated by slashes (e.g. 28/32/36/40); got {len(parts)} value(s): {val!r}.'
                )
            nums = [_parse_single_temperature_token(p, full_cell=s) for p in parts]
            for t in nums:
                d = row.to_dict()
                d[col] = t
                out_rows.append(d)
            continue

        t = _parse_single_temperature_token(s, full_cell=s)
        d = row.to_dict()
        d[col] = t
        out_rows.append(d)

    return pd.DataFrame(out_rows, columns=df.columns)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def map_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform a DataFrame to use standard column names.
    
    Args:
        df: Input DataFrame with column names matching DIRECT_MAPPING keys
        
    Returns:
        DataFrame with standard column names
    """
    df = expand_slash_separated_temperature_column(df.copy())

    # Apply direct mapping
    df_mapped = df.rename(columns=DIRECT_MAPPING)
    
    # Create computed fields
    df_standard = _create_computed_fields(df_mapped)
    
    # Add missing standard columns
    df_standard = _add_missing_columns(df_standard)
    
    # Apply data transformations
    df_standard = _transform_data(df_standard)
    
    # Save mapping result to static folder
    _save_mapping_result(df_standard)
    
    return df_standard


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _create_computed_fields(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create computed fields based on template expressions.
    """
    # Project.name: use "Project" column if available, otherwise compute from "{Date}_{Country}_{Site}"
    if "Project.name" not in df.columns:
        if "Experiment.date" in df.columns and "Colony.country" in df.columns and "Experiment.name" in df.columns:
            df["Project.name"] = (
                df["Experiment.date"].astype(str) + "_" +
                df["Colony.country"].astype(str) + "_" +
                df["Experiment.name"].astype(str)
            )
    
    # Colony.name: f"{Site}_{Species}_{Genotype}"
    if "Experiment.name" in df.columns and "Colony.species" in df.columns:
        def build_colony_name(row):
            parts = [str(row.get("Experiment.name", ""))]
            if "Colony.species" in df.columns and pd.notna(row.get("Colony.species")):
                parts.append(str(row["Colony.species"]))
            if "Genotype" in df.columns and pd.notna(row.get("Genotype")):
                parts.append(str(row["Genotype"]))
            return "_".join(parts)
        
        df["Colony.name"] = df.apply(build_colony_name, axis=1)
    
    # BioSample.name: "{Date}_{Country}_{Site}_{Species}_{Genotype}_{Temperature}_{Timepoint}"
    if all(col in df.columns for col in ["Experiment.date", "Colony.country", "Experiment.name", 
                                          "Colony.species", "Observation.temperature", "Observation.timepoint"]):
        def build_biosample_name(row):
            parts = [
                str(row.get("Experiment.date", "")),
                str(row.get("Colony.country", "")),
                str(row.get("Experiment.name", "")),
                str(row.get("Colony.species", "")),
            ]
            if "Genotype" in df.columns and pd.notna(row.get("Genotype")):
                parts.append(str(row["Genotype"]))
            parts.extend([
                str(row.get("Observation.temperature", "")),
                str(row.get("Observation.timepoint", ""))
            ])
            return "_".join(parts)
        
        df["BioSample.name"] = df.apply(build_biosample_name, axis=1)
    
    # BioSample.collection_date: "{Date}"
    if "Experiment.date" in df.columns:
        df["BioSample.collection_date"] = df["Experiment.date"]
    
    return df


def _add_missing_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add any missing standard columns with default values.
    """
    for std_col in STANDARD_COLUMNS:
        if std_col not in df.columns:
            if std_col == "Publication.year":
                df[std_col] = datetime.now().year
            elif std_col == "Publication.title":
                df[std_col] = "No publications available"
            elif std_col == "Publication.doi":
                df[std_col] = "No doi available"
            else:
                df[std_col] = pd.NA
    
    # Reorder columns to match standard order
    df = df[STANDARD_COLUMNS]
    
    return df


def _transform_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply data transformations to ensure consistent formatting.
    """
    # Transform date columns
    date_columns = ["Experiment.date", "BioSample.collection_date"]
    for col in date_columns:
        if col in df.columns:
            df[col] = df[col].apply(_normalize_date)
    
    # Normalize colony names (replace spaces with underscores)
    if "Colony.name" in df.columns:
        df["Colony.name"] = df["Colony.name"].astype(str).str.replace(" ", "_")
    
    # Normalize country code to 3 uppercase letters
    if "Colony.country" in df.columns:
        df["Colony.country"] = df["Colony.country"].astype(str).str[:3].str.upper()
    
    # Ensure numeric columns are proper types
    numeric_cols = ["Colony.latitude", "Colony.longitude", "Colony.ed5", "Colony.ed50",
                    "Colony.ed95", "Observation.pam_value"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = _clean_and_convert_to_numeric(df[col])

    if "Observation.temperature" in df.columns:
        df["Observation.temperature"] = pd.to_numeric(
            df["Observation.temperature"], errors="raise"
        )

    return df


def _clean_and_convert_to_numeric(series: pd.Series) -> pd.Series:
    """
    Clean and convert a pandas Series to numeric type.
    """
    def clean_value(val):
        if pd.isna(val):
            return val
        
        if isinstance(val, (int, float)):
            return float(val)
        
        val_str = str(val).strip()
        val_str = re.sub(r'°?[CcFf]', '', val_str).strip()
        val_str = val_str.replace(',', '.')
        
        match = re.search(r'-?\d+\.?\d*', val_str)
        if match:
            try:
                return float(match.group(0))
            except (ValueError, TypeError):
                return pd.NA
        
        try:
            return float(val_str)
        except (ValueError, TypeError):
            return pd.NA
    
    cleaned_series = series.apply(clean_value)
    return pd.to_numeric(cleaned_series, errors="coerce")


def _normalize_date(val) -> str:
    """
    Normalize date values to YYYY-MM-DD format.
    """
    if pd.isna(val):
        return None
    
    if isinstance(val, (int, float)):
        val_str = str(int(val)).zfill(8)
    else:
        val_str = str(val).strip()
    
    if len(val_str) == 8 and val_str.isdigit():
        return f"{val_str[0:4]}-{val_str[4:6]}-{val_str[6:8]}"
    
    return val_str


def _save_mapping_result(df: pd.DataFrame) -> None:
    """
    Save mapping result to static folder for inspection.
    """
    try:
        # Get Django settings to find static directory
        from django.conf import settings
        static_dir = os.path.join(settings.BASE_DIR, 'static')
    except Exception:
        # Fallback: calculate path relative to this file
        # This file is in: django_app/projects/management/commands/utils/column_mapper.py
        # Static is in: django_app/static
        current_file = os.path.abspath(__file__)
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file))))), 'static')
    
    # Ensure static directory exists
    os.makedirs(static_dir, exist_ok=True)
    
    # Create filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"mapped_result_{timestamp}.csv"
    filepath = os.path.join(static_dir, filename)
    
    # Save DataFrame to CSV
    df.to_csv(filepath, index=False)


# ---------------------------------------------------------------------------
# Compatibility with old AI mapper interface
# ---------------------------------------------------------------------------

def map_and_transform_dataframe(
    df: pd.DataFrame, *, preview_rows: int = 3, return_instructions: bool = False
) -> pd.DataFrame | tuple[pd.DataFrame, dict]:
    """
    Compatibility wrapper for old AI mapper interface.
    """
    df_transformed = map_columns(df)
    
    if return_instructions:
        # Return mapping info for audit
        instructions = {
            "mapping": DIRECT_MAPPING,
            "formatting": {},
            "note": "Direct column mapping"
        }
        return df_transformed, instructions
    
    return df_transformed
