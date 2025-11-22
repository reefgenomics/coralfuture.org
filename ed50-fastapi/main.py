from fastapi import FastAPI, File, UploadFile, Request, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import pandas as pd
import subprocess
import io
from pathlib import Path
import tempfile
import os
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

app = FastAPI(title="CBASS ED50 Calculator", description="FastAPI application for ED50 calculations using R")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

R_SCRIPT_PATH = Path(__file__).parent / "calculate_eds.R"


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
    grouping_properties: str = Form("Site,Condition,Species,Timepoint"),
    drm_formula: str = Form("Pam_value ~ Temperature"),
    condition: str = Form("Condition"),
    faceting: str = Form(" ~ Species"),
    faceting_model: str = Form("Species ~ Site ~ Condition"),
):
    """Calculate EDs and return CSV directly (no HTML)"""
    input_file: Optional[str] = None
    output_file: Optional[str] = None

    try:
        logger.info(f"📊 CSV calculation request for {file.filename}")
        
        # Save uploaded file
        input_file = await materialize_uploaded_file(file)
        output_file = create_temp_csv_file()

        # Run R script (no plots needed for CSV endpoint)
        success, error_message = run_r_script(
            input_file,
            output_file,
            grouping_properties,
            drm_formula,
            condition,
            faceting,
            faceting_model,
            12,  # default text size
            2.5,  # default point size
            "",  # no boxplot
            "",  # no temp curve
            "",  # no model curve
        )

        if not success:
            return JSONResponse(
                content={"error": error_message},
                status_code=500
            )

        # Read and return CSV
        eds_df = pd.read_csv(output_file)
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
        for tmp_path in [input_file, output_file]:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    logger.warning(f"Failed to remove temporary file: {tmp_path}")


@app.post("/process")
async def process_data(
    request: Request,
    file: Optional[UploadFile] = File(None),
    grouping_properties: str = Form("Site,Condition,Species,Timepoint"),
    faceting_model: str = Form("Species ~ Site ~ Condition"),
    faceting: str = Form(" ~ Species"),
    condition: str = Form("Condition"),
    drm_formula: str = Form("Pam_value ~ Temperature"),
    size_text: float = Form(12),
    size_points: float = Form(2.5)
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

        eds_df = pd.read_csv(output_file)
        eds_table_html = eds_df.to_html(
            classes="table table-striped",
            table_id="eds-table",
            index=False,
        )
        csv_data = eds_df.to_csv(index=False)

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
