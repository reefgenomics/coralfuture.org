"""
Utility for automatically mapping arbitrary CSV column names to the CoralFuture
standard schema using an LLM (DeepSeek / OpenAI-compatible API).

The general workflow is:
1. Feed the model the list of column names + a few example rows.
2. Ask it to output a JSON payload that maps each *required* standard column
   name to either an existing column name or an *expression* describing how to
   construct it (e.g. concatenations, date formatting).
3. Parse the model response and create a transformed `pandas.DataFrame`
   containing **exactly** the standard columns, performing simple operations
   (renaming, re-formatting, concatenation) when they are described in a simple
   declarative syntax.

This module purposefully keeps the instruction set very small; complex logic is
still expected to be implemented manually once the mapping has been inspected.
"""

from __future__ import annotations

import json
import os
import re
from typing import Dict, Tuple, List, Any
from datetime import datetime

import pandas as pd

try:
    # The regular OpenAI client also works for DeepSeek if we override the base_url
    from openai import OpenAI  # type: ignore
except ImportError:  # pragma: no cover
    OpenAI = None  # noqa: N816 – fallback handled later

# ---------------------------------------------------------------------------
# Configuration
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

LLM_MODEL: str = os.getenv("COLUMN_MAPPER_MODEL", "deepseek-chat")
LLM_API_KEY_ENV: str = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY") or "sk-83c963f820ea49cf9d85a74c2c05bf43"
LLM_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def map_and_transform_dataframe(
    df: pd.DataFrame, *, preview_rows: int = 3, return_instructions: bool = False
) -> pd.DataFrame | tuple[pd.DataFrame, dict]:
    """Return a *new* DataFrame whose columns follow the STANDARD_COLUMNS order.

    The function will:
    1. Query an LLM to obtain a mapping & simple formatting instructions.
    2. Apply those instructions.

    For safety, the original ``df`` is not modified.
    """

    if OpenAI is None:
        raise RuntimeError(
            "openai package not installed – add `openai` to requirements.txt"
        )
    if not LLM_API_KEY_ENV:
        raise RuntimeError(
            "Environment variable DEEPSEEK_API_KEY or OPENAI_API_KEY must be set"
        )

    client = OpenAI(api_key=LLM_API_KEY_ENV, base_url=LLM_BASE_URL)

    # Compose prompt
    header_list = df.columns.tolist()
    preview_dicts: List[Dict[str, Any]] = df.head(preview_rows).to_dict(orient="records")

    prompt = (
        "You are given a list of column names and a short preview of a dataset.\n"
        "Your task is to map those columns to the *standard* CoralFuture schema.\n\n"
        "STANDARD SCHEMA COLUMNS (18):\n"
        + "\n".join(STANDARD_COLUMNS)
        + "\n\n"
        "Return a JSON object with **two** top-level keys: `mapping` and `formatting`.\n"
        "`mapping` must be a dictionary where *every* standard column is a key.\n"
        "Each value is either: (1) the *exact* name of one of the *SOURCE* columns listed above "
        "(case-sensitive!) or (2) a short Python-like expression referencing those source columns "
        "short Python-like expression describing how to derive the value (e.g.\n"
        " `Date` or `f\"{Date}_{Country}\"`).\n\n"
        "`formatting` is another dict where each key (standard column) has a short"
        " instruction on how to post-process the value, e.g. 'date:%Y%m%d→%Y-%m-%d',"
        " 'float:comma→dot'. Leave empty string if no special formatting needed.\n\n"
        "IMPORTANT:\n"
        "• Always output **valid JSON**.\n"
        "• You *must* map every standard column if it can be derived. A plain synonym such as 'date'"
        " must be used for 'Experiment.date' / 'BioSample.collection_date'.\n"
        "• If absolutely impossible, set the mapping value to null.\n"
        "• Do **not** add comments or additional keys.\n\n"
        "EXTRA HEURISTICS (use only when a direct mapping is impossible):\n"
        "• If 'Project.name' is missing, construct it as f\"{Experiment.date}_{Colony.country}_{Site}\" (if 'Site' column exists).\n"
        "• If 'Colony.name' is missing, construct it as f\"{Site}_{Colony.species}_{Genotype}\" (replace *all* spaces with '_' so the final name contains no spaces; requires 'Site' & 'Genotype' columns).\n"
        "• If 'Experiment.name' is missing, construct it as f\"{Site}\"\n"
        "• If 'BioSample.name' is missing, construct it as f\"{Experiment.date}_{Colony.country}_{Site}_{Colony.species}_{Genotype}_{Observation.temperature}_{Observation.timepoint}\".\n"
        "The expressions above may reference any SOURCE columns exactly as they are named (case-sensitive).\n\n"
        f"SOURCE COLUMNS: {header_list}\n"
        f"PREVIEW ROWS (truncated):\n{json.dumps(preview_dicts, indent=2)[:2000]}"
    )

    # Call the model
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    content = response.choices[0].message.content.strip()

    # --------------------------------------------------------------
    # 1. Extract JSON body (tolerates Markdown formatting, code fences)
    # --------------------------------------------------------------
    json_text = None
    # a) Look for fenced block ```json ... ```
    fenced_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", content, re.IGNORECASE)
    if fenced_match:
        json_text = fenced_match.group(1)
    else:
        # b) Look for the first '{' and last '}'
        first_curly = content.find('{')
        last_curly = content.rfind('}')
        if first_curly != -1 and last_curly != -1 and last_curly > first_curly:
            json_text = content[first_curly:last_curly + 1]

    if json_text is None:
        raise ValueError(f"LLM response does not contain JSON: {content}")

    try:
        instructions = json.loads(json_text)
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise ValueError(f"LLM returned invalid JSON block: {json_text}") from exc

    mapping: Dict[str, str | None] = instructions.get("mapping", {})
    formatting: Dict[str, str] = instructions.get("formatting", {})

    # ---------------------------------------------------------------------
    # Apply mapping to build a new DataFrame
    # ---------------------------------------------------------------------
    print(f"🔍 DEBUG: Original DataFrame columns: {df.columns.tolist()}")
    print(f"🔍 DEBUG: Mapping instructions: {mapping}")
    print(f"🔍 DEBUG: Formatting instructions: {formatting}")

    transformed = pd.DataFrame()
    for std_col in STANDARD_COLUMNS:
        source_spec = mapping.get(std_col)
        fmt_instr = formatting.get(std_col, "").strip()

        print(f"🔍 DEBUG: Processing {std_col} -> source: '{source_spec}', format: '{fmt_instr}'")

        if source_spec in (None, "", "null"):
            # Heuristic fallback using common synonyms / case-insensitive match
            fallback_map = {
                "Experiment.date": ["date", "Date", "experiment_date"],
                "BioSample.collection_date": ["collection_date", "Collection_date", "collection", "sample_date"],
                "Colony.ed5": ["Colony.ed5_value", "ed5", "ED5"],
                "Colony.ed50": ["Colony.ed50_value", "ed50", "ED50"],
                "Colony.ed95": ["Colony.ed95_value", "ed95", "ED95"],
            }
            posible_cols = fallback_map.get(std_col, [])
            found = next((c for c in posible_cols if c in df.columns), None)
            if found:
                source_spec = found
            else:
                # Default for Publication.year -> current year
                if std_col == "Publication.year":
                    transformed[std_col] = datetime.now().year
                else:
                    transformed[std_col] = pd.NA
                continue

        if re.match(r"^[A-Za-z0-9_ .]+$", source_spec) and source_spec in df.columns:
            # Simple rename / copy
            series = df[source_spec].copy()
            print(f"✅ DEBUG: Direct copy from '{source_spec}' -> {series.head(2).tolist()}")
        else:
            # Evaluate simple python expression in a restricted namespace
            series = _evaluate_expression(df, source_spec)
            print(f"✅ DEBUG: Expression '{source_spec}' -> {series.head(2).tolist()}")

        series = _apply_formatting(series, fmt_instr)
        print(f"✅ DEBUG: After formatting '{fmt_instr}' -> {series.head(2).tolist()}")
        transformed[std_col] = series

    if return_instructions:
        # -----------------------------------------------------------------
        # Post-processing: ensure critical fields filled & consistent
        # -----------------------------------------------------------------

        # normalize spaces in colony name
        if 'Colony.name' in transformed.columns:
            transformed['Colony.name'] = transformed['Colony.name'].astype(str).str.replace(' ', '_')

        # use site if experiment name empty
        if 'Experiment.name' in transformed.columns:
            exp_empty = transformed['Experiment.name'].isna() | (transformed['Experiment.name'].astype(str).str.strip() == '')
            if exp_empty.any():
                transformed.loc[exp_empty, 'Experiment.name'] = transformed.loc[exp_empty, 'Site'].fillna('Unknown')

        # 3) Replace missing publication info with placeholders
        def _fill_default(series, default):
            return series.apply(lambda v: default if (pd.isna(v) or str(v).strip().upper() in {'', 'NA', 'N/A'}) else v)

        if 'Publication.title' in transformed.columns:
            transformed['Publication.title'] = _fill_default(transformed['Publication.title'], 'No publications available')

        if 'Publication.doi' in transformed.columns:
            transformed['Publication.doi'] = _fill_default(transformed['Publication.doi'], 'No doi available')

        return transformed, instructions  # type: ignore[return-value]

    return transformed

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _evaluate_expression(df: pd.DataFrame, expr: str) -> pd.Series:
    """Evaluate a very small subset of python f-string / concatenation syntax."""
    # Simple f-string evaluation: ignore any chained methods, they'll be handled later.
    if expr.startswith("f\""):
        # Extract content between the first f" and the next "
        end_quote = expr.find("\"", 2)
        pattern = expr[2:end_quote] if end_quote != -1 else expr[2:-1]

        def _format_row(row):
            result = pattern
            for col in df.columns:
                result = result.replace(f"{{{col}}}", str(row[col]))
            return result.replace(" ", "_")  # normalize spaces

        return df.apply(_format_row, axis=1)

    # Fallback – try direct column reference
    if expr in df.columns:
        return df[expr]

    raise ValueError(f"Unsupported mapping expression: {expr}")


def _apply_formatting(series: pd.Series, instr: str) -> pd.Series:
    """Handle a few common formatting instructions produced by the LLM."""
    instr = instr.lower()
    if not instr:
        return series

    # Date conversion: fuck the arrows, just convert YYYYMMDD to YYYY-MM-DD
    if instr.startswith("date:"):
        def convert_date(val):
            if pd.isna(val):
                return None
            
            # Convert to string if numeric
            if isinstance(val, (int, float)):
                val_str = str(int(val)).zfill(8)
            else:
                val_str = str(val).strip()
            
            # If it's 8 digits, format as YYYY-MM-DD
            if len(val_str) == 8 and val_str.isdigit():
                return f"{val_str[0:4]}-{val_str[4:6]}-{val_str[6:8]}"
            
            # Return as-is if already formatted or invalid
            return val_str
        
        return series.apply(convert_date)

    # Float comma to dot: 'float:comma→dot'
    if instr.startswith("float") and "comma" in instr and "dot" in instr:
        try:
            return series.astype(str).str.replace(",", ".").astype(float)
        except Exception as e:
            print(f"⚠️ Float formatting failed for {instr}: {e}")
            return series

    # Add other simple formatting rules as needed.
    return series