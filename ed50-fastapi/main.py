from fastapi import FastAPI, File, UploadFile, Request, Form
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import pandas as pd
import subprocess
import io
from pathlib import Path
import tempfile
import os
import shutil
import logging
import sys
from typing import Optional, Tuple
import base64

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="CBASS ED50 Calculator",
    description="FastAPI application for ED50 calculations using R",
    root_path="/shiny"
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

R_SCRIPT_PATH = Path(__file__).parent / "calculate_eds.R"

# Defaults: match user's working settings (Grouping Site,Condition,Species,Timepoint; Text size 10; Point size 1)
ED_CALCULATOR_DEFAULTS = {
    "grouping_properties": "Site,Condition,Species,Timepoint",
    "drm_formula": "Pam_value ~ Temperature",
    "condition": "Condition",
    "faceting": " ~ Species",
    "faceting_model": "Species ~ Site ~ Condition",
    "size_text": 10.0,
    "size_points": 1.0,
}

# Get shared data path from environment variable, default to /shared_data
SHARED_DATA_PATH = Path(os.getenv("SHARED_DATA_PATH", "/shared_data"))

# Log shared data path configuration at startup
logger.info(f"📁 Shared data path configured: {SHARED_DATA_PATH}")
if SHARED_DATA_PATH.exists():
    logger.info(f"✅ Shared data directory exists: {SHARED_DATA_PATH}")
else:
    logger.warning(f"⚠️  Shared data directory does not exist yet: {SHARED_DATA_PATH} (will be created when needed)")


def parse_checkbox(value: Optional[str]) -> bool:
    if value is None:
        return False
    normalized = value.strip().lower()
    return normalized in {"true", "1", "on", "yes"}


def write_dataframe_to_temp_csv(df: pd.DataFrame) -> str:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp_file:
        df.to_csv(tmp_file.name, index=False)
        return tmp_file.name


async def materialize_uploaded_file(upload: UploadFile) -> str:
    filename = upload.filename or ""
    suffix = Path(filename).suffix.lower()
    file_bytes = await upload.read()

    with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as tmp_file:
        if suffix == ".xlsx":
            dataframe = pd.read_excel(io.BytesIO(file_bytes))
            dataframe.to_csv(tmp_file.name, index=False)
        elif suffix == ".csv":
            tmp_file.write(file_bytes)
        else:
            raise ValueError("Unsupported file format. Please upload a CSV or Excel file.")

        return tmp_file.name


def create_temp_csv_file() -> str:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp_file:
        return tmp_file.name


def create_temp_png_file() -> str:
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".png", delete=False) as tmp_file:
        return tmp_file.name


def base64_from_file(file_path: Optional[str]) -> str:
    if not file_path or not os.path.exists(file_path):
        return ""
    with open(file_path, "rb") as file:
        return base64.b64encode(file.read()).decode("utf-8")


def load_example_data():
    possible_paths = [
        Path("data/examples/cbass_dataset.csv"),
        Path("../ed50-calculator/examples/cbass_dataset.csv"),
        Path("/app/data/examples/cbass_dataset.csv"),
    ]
    
    for example_path in possible_paths:
        logger.info(f"Checking example data path: {example_path}")
        if example_path.exists():
            logger.info(f"Found example file: {example_path}")
            return pd.read_csv(example_path)
    
    logger.error(f"Example data not found. Checked paths: {possible_paths}")
    return None

def run_r_script(
    input_csv: str,
    output_csv: str,
    grouping_properties: str,
    drm_formula: str,
    condition: str,
    faceting: str,
    faceting_model: str,
    size_text: float,
    size_points: float,
    boxplot_path: str,
    temp_curve_path: str,
    model_curve_path: str,
) -> Tuple[bool, str]:
    try:
        logger.info(f"Running R script: {R_SCRIPT_PATH}")
        logger.info(f"Input file: {input_csv}")
        logger.info(f"Output file: {output_csv}")
        logger.info(f"Grouping: {grouping_properties}")
        logger.info(f"Formula: {drm_formula}")
        
        r_check = subprocess.run(
            ["which", "Rscript"],
            capture_output=True,
            text=True
        )
        
        if r_check.returncode != 0:
            logger.error("Rscript not found in PATH")
            return False, "R is not installed. Please ensure R and Rscript are available."
        
        logger.info(f"Rscript found: {r_check.stdout.strip()}")
        logger.info("Executing R script...")
        
        process = subprocess.Popen(
            [
                "Rscript",
                str(R_SCRIPT_PATH),
                input_csv,
                output_csv,
                grouping_properties,
                drm_formula,
                condition or "",
                faceting or "",
                faceting_model or "",
                str(size_text),
                str(size_points),
                boxplot_path or "",
                temp_curve_path or "",
                model_curve_path or "",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        output_lines = []
        for line in process.stdout:
            line = line.strip()
            if line:
                logger.info(f"[R] {line}")
                output_lines.append(line)
        
        process.wait()
        
        logger.info(f"R script finished with code: {process.returncode}")
        result_stdout = "\n".join(output_lines)
        
        if process.returncode != 0:
            error_msg = result_stdout if result_stdout else "Unknown error"
            logger.error(f"R script error: {error_msg}")
            return False, f"R script execution error: {error_msg}"
        
        if not os.path.exists(output_csv):
            logger.error(f"Output file not created: {output_csv}")
            return False, "R script completed but output file was not created."
        
        logger.info(f"Results saved successfully: {output_csv}")
        return True, ""
        
    except subprocess.TimeoutExpired:
        logger.error("R script execution timeout")
        return False, "R script execution timeout (exceeded 5 minutes)"
    except Exception as e:
        logger.exception(f"Exception while running R script: {e}")
        return False, f"Error running R script: {str(e)}"

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    logger.info(f"GET request to home page from {request.client.host if request.client else 'unknown'}")
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/calculate-csv")
async def calculate_csv(
    request: Request,
    file: UploadFile = File(...),
    grouping_properties: str = Form(ED_CALCULATOR_DEFAULTS["grouping_properties"]),
    drm_formula: str = Form(ED_CALCULATOR_DEFAULTS["drm_formula"]),
    condition: str = Form(ED_CALCULATOR_DEFAULTS["condition"]),
    faceting: str = Form(ED_CALCULATOR_DEFAULTS["faceting"]),
    faceting_model: str = Form(ED_CALCULATOR_DEFAULTS["faceting_model"]),
    size_text: float = Form(ED_CALCULATOR_DEFAULTS["size_text"]),
    size_points: float = Form(ED_CALCULATOR_DEFAULTS["size_points"]),
    save_to: Optional[str] = Form(None),
):
    """Calculate EDs and return CSV directly. If save_to is provided, save plots and statistics."""
    input_file: Optional[str] = None
    output_file: Optional[str] = None
    boxplot_file: Optional[str] = None
    temp_curve_file: Optional[str] = None
    model_curve_file: Optional[str] = None

    try:
        logger.info(f"📊 CSV calculation request for {file.filename}")
        logger.info(f"📤 Received save_to parameter: {save_to}")
        
        # Save uploaded file
        input_file = await materialize_uploaded_file(file)
        output_file = create_temp_csv_file()

        # Create plot files if saving
        if save_to:
            boxplot_file = create_temp_png_file()
            temp_curve_file = create_temp_png_file()
            model_curve_file = create_temp_png_file()
        else:
            boxplot_file = temp_curve_file = model_curve_file = ""

        # Run R script with same defaults as ED calculator form (index.html)
        success, error_message = run_r_script(
            input_file,
            output_file,
            grouping_properties,
            drm_formula,
            condition,
            faceting,
            faceting_model,
            size_text,
            size_points,
            boxplot_file or "",
            temp_curve_file or "",
            model_curve_file or "",
        )

        if not success:
            return JSONResponse(
                content={"error": error_message},
                status_code=500
            )

        # Read individual ED values (handle file with separator)
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split file by separator: individual first, then aggregated
        from io import StringIO
        individual_csv = content
        if '#AGGREGATED_STATISTICS' in content:
            parts = content.split('#AGGREGATED_STATISTICS', 1)
            individual_csv = parts[0].strip()
        
        # Parse individual CSV
        eds_df = pd.read_csv(StringIO(individual_csv))
        
        # Save files to shared path if save_to provided
        if save_to:
            # Always prepend shared_data_path to ensure files are saved in shared volume
            # This works for both relative paths (e.g., "attachments/dataset") and 
            # absolute paths that should be relative to shared_data (e.g., "/shared_data/attachments/dataset")
            save_to_clean = str(save_to).strip()
            
            # Remove leading /shared_data if present to avoid duplication
            if save_to_clean.startswith('/shared_data/'):
                save_to_clean = save_to_clean.replace('/shared_data/', '', 1)
            elif save_to_clean.startswith('/shared_data'):
                save_to_clean = save_to_clean.replace('/shared_data', '', 1)
            
            # Remove leading slash if present (to make it relative)
            if save_to_clean.startswith('/'):
                save_to_clean = save_to_clean[1:]
            
            # Build final path relative to shared_data
            save_path = SHARED_DATA_PATH / save_to_clean
            
            logger.info(f"🔍 Processing save_to: '{save_to}'")
            logger.info(f"🔍 Cleaned path: '{save_to_clean}'")
            logger.info(f"🔍 SHARED_DATA_PATH: {SHARED_DATA_PATH}")
            logger.info(f"🔍 Final save_path: {save_path}")
            
            # Ensure the directory exists
            try:
                save_path.mkdir(parents=True, exist_ok=True)
                logger.info(f"✅ Directory created/exists: {save_path}")
            except Exception as e:
                logger.error(f"❌ Failed to create directory {save_path}: {e}")
                raise
            
            logger.info(f"💾 Saving files to shared path: {save_path}")
            
            # Save individual ED results
            eds_df.to_csv(save_path / "eds_results.csv", index=False)
            logger.info(f"✅ Saved eds_results.csv to {save_path / 'eds_results.csv'}")
            
            # Copy aggregated statistics if exists
            aggregated_file = output_file.replace('.csv', '_aggregated.csv')
            if os.path.exists(aggregated_file):
                shutil.copy(aggregated_file, save_path / "statistics.csv")
                logger.info(f"✅ Saved statistics.csv to {save_path / 'statistics.csv'}")
            
            # Copy plot files if they exist
            if boxplot_file and os.path.exists(boxplot_file):
                shutil.copy(boxplot_file, save_path / "boxplot.png")
                logger.info(f"✅ Saved boxplot.png to {save_path / 'boxplot.png'}")
            if temp_curve_file and os.path.exists(temp_curve_file):
                shutil.copy(temp_curve_file, save_path / "temp_curve.png")
                logger.info(f"✅ Saved temp_curve.png to {save_path / 'temp_curve.png'}")
            if model_curve_file and os.path.exists(model_curve_file):
                shutil.copy(model_curve_file, save_path / "model_curve.png")
                logger.info(f"✅ Saved model_curve.png to {save_path / 'model_curve.png'}")
            
            logger.info(f"💾 All files saved successfully to: {save_path}")
        
        # Return only individual values for CSV endpoint
        csv_data = eds_df.to_csv(index=False)
        
        logger.info(f"✅ Calculated {len(eds_df)} ED rows")
        
        from fastapi.responses import Response
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=eds_results.csv"
            }
        )

    except Exception as exc:
        logger.exception(f"❌ Error calculating EDs: {exc}")
        return JSONResponse(
            content={"error": f"ED calculation failed: {str(exc)}"},
            status_code=500
        )
    finally:
        # Clean up temp files (but not if saved)
        for tmp_path in [input_file, output_file, boxplot_file, temp_curve_file, model_curve_file]:
            if tmp_path and os.path.exists(tmp_path) and (not save_to or tmp_path not in [boxplot_file, temp_curve_file, model_curve_file]):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    logger.warning(f"Failed to remove temporary file: {tmp_path}")
        # Also clean up aggregated file if it exists and not saved
        aggregated_file = output_file.replace('.csv', '_aggregated.csv') if output_file else None
        if aggregated_file and os.path.exists(aggregated_file) and not save_to:
            try:
                os.unlink(aggregated_file)
            except OSError:
                logger.warning(f"Failed to remove temporary aggregated file: {aggregated_file}")


@app.post("/process")
async def process_data(
    request: Request,
    file: Optional[UploadFile] = File(None),
    grouping_properties: str = Form(ED_CALCULATOR_DEFAULTS["grouping_properties"]),
    faceting_model: str = Form(ED_CALCULATOR_DEFAULTS["faceting_model"]),
    faceting: str = Form(ED_CALCULATOR_DEFAULTS["faceting"]),
    condition: str = Form(ED_CALCULATOR_DEFAULTS["condition"]),
    drm_formula: str = Form(ED_CALCULATOR_DEFAULTS["drm_formula"]),
    size_text: float = Form(ED_CALCULATOR_DEFAULTS["size_text"]),
    size_points: float = Form(ED_CALCULATOR_DEFAULTS["size_points"]),
):
    # Force example data OFF to always require user input table
    use_example_flag = False
    logger.info(
        "POST /process request: use_example=%s, grouping=%s, drm_formula=%s",
        use_example_flag,
        grouping_properties,
        drm_formula,
    )

    input_file: Optional[str] = None
    output_file: Optional[str] = None
    boxplot_file: Optional[str] = None
    temp_curve_file: Optional[str] = None
    model_curve_file: Optional[str] = None

    try:
        if file is None:
            logger.warning("No file uploaded")
            return templates.TemplateResponse(
                "error.html",
                {"request": request, "error": "No file uploaded"},
            )

        try:
            input_file = await materialize_uploaded_file(file)
        except ValueError as exc:
            logger.warning("File upload error: %s", exc)
            return templates.TemplateResponse(
                "error.html",
                {"request": request, "error": str(exc)},
            )

        output_file = create_temp_csv_file()
        boxplot_file = create_temp_png_file()
        temp_curve_file = create_temp_png_file()
        model_curve_file = create_temp_png_file()

        success, error_message = run_r_script(
            input_file,
            output_file,
            grouping_properties,
            drm_formula,
            condition,
            faceting,
            faceting_model,
            size_text,
            size_points,
            boxplot_file,
            temp_curve_file,
            model_curve_file,
        )

        if not success:
            return templates.TemplateResponse(
                "error.html",
                {"request": request, "error": error_message},
            )

        # Try to read aggregated statistics from separate file first
        aggregated_file = output_file.replace('.csv', '_aggregated.csv')
        aggregated_df = None
        if os.path.exists(aggregated_file):
            try:
                aggregated_df = pd.read_csv(aggregated_file)
                logger.info(f"✅ Loaded aggregated statistics from separate file: {len(aggregated_df)} rows")
            except Exception as e:
                logger.warning(f"Failed to read aggregated file: {e}")
        
        # Read individual ED values (handle file with separator)
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split file by separator: individual first, then aggregated
        from io import StringIO
        individual_csv = content
        if '#AGGREGATED_STATISTICS' in content:
            parts = content.split('#AGGREGATED_STATISTICS', 1)
            individual_csv = parts[0].strip()
            # If we don't have aggregated from separate file, try to parse from main file
            if aggregated_df is None and len(parts) > 1:
                aggregated_csv = parts[1].strip()
                try:
                    aggregated_df = pd.read_csv(StringIO(aggregated_csv))
                    logger.info(f"✅ Loaded aggregated statistics from main file: {len(aggregated_df)} rows")
                except Exception as e:
                    logger.warning(f"Failed to parse aggregated data from main file: {e}")
        
        # Parse individual CSV
        try:
            eds_df = pd.read_csv(StringIO(individual_csv))
        except Exception as e:
            logger.error(f"Failed to parse individual CSV: {e}")
            raise
        
        # Combine CSV data: individual first, then aggregated
        csv_data = eds_df.to_csv(index=False)
        if aggregated_df is not None and len(aggregated_df) > 0:
            csv_data += "\n#AGGREGATED_STATISTICS\n"
            csv_data += aggregated_df.to_csv(index=False)
        
        # Create HTML table (show individual values by default)
        eds_table_html = eds_df.to_html(
            classes="table table-striped",
            table_id="eds-table",
            index=False,
        )

        boxplot_img = base64_from_file(boxplot_file)
        temp_curve_img = base64_from_file(temp_curve_file)
        model_curve_img = base64_from_file(model_curve_file)

        return templates.TemplateResponse(
            "results.html",
            {
                "request": request,
                "eds_table": eds_table_html,
                "boxplot_img": boxplot_img,
                "temp_curve_img": temp_curve_img,
                "model_curve_img": model_curve_img,
                "csv_data": csv_data,
                "row_count": len(eds_df),
            },
        )

    except Exception as exc:
        logger.exception("Unhandled error while processing data: %s", exc)
        return templates.TemplateResponse(
            "error.html",
            {"request": request, "error": f"Data processing error: {exc}"},
        )
    finally:
        if input_file and os.path.exists(input_file):
            try:
                os.unlink(input_file)
            except OSError:
                logger.warning("Failed to remove temporary input file: %s", input_file)
        for tmp_path in (output_file, boxplot_file, temp_curve_file, model_curve_file):
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    logger.warning("Failed to remove temporary output file: %s", tmp_path)
        # Also clean up aggregated file if it exists
        aggregated_file = output_file.replace('.csv', '_aggregated.csv') if output_file else None
        if aggregated_file and os.path.exists(aggregated_file):
            try:
                os.unlink(aggregated_file)
            except OSError:
                logger.warning("Failed to remove temporary aggregated file: %s", aggregated_file)

@app.get("/download-csv")
async def download_csv(csv_data: str):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
        tmp_file.write(csv_data)
        tmp_file_path = tmp_file.name
    
    return FileResponse(
        tmp_file_path,
        media_type='text/csv',
        filename=f'EDsdf-results.csv'
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
