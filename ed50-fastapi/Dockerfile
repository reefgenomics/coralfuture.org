FROM python:3.11-slim

WORKDIR /app

# install system deps including R (cached if unchanged)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    pkg-config \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# copy conda from existing image (cached)
COPY --from=continuumio/miniconda3:4.12.0 /opt/conda /opt/conda

ENV PATH=/opt/conda/bin:$PATH

# install R packages via conda (cached if package list unchanged)
RUN set -ex && \
    conda config --set always_yes yes --set changeps1 no && \
    conda config --add channels conda-forge && \
    conda install --quiet --freeze-installed -c conda-forge \
        r-bslib r-colourpicker r-pbkrtest r-reshape2 r-drc r-RcppEigen \
        r-base r-DT r-shiny r-dplyr r-tidyr r-ggplot2 r-readxl \
        r-rstudioapi r-rcolorbrewer r-shinycssloaders r-shinyjs \
        r-devtools r-usethis r-pkgdown r-roxygen2 r-rversions \
        r-urlchecker r-readr && \
    conda clean -afy

# copy only install_packages.R (cached if file unchanged)
COPY install_packages.R /tmp/install_packages.R

# install R packages via Rscript (cached if install_packages.R unchanged)
RUN chmod +x /tmp/install_packages.R && \
    Rscript /tmp/install_packages.R

# copy only requirements.txt (cached if file unchanged)
COPY requirements.txt .

# install python deps (cached if requirements.txt unchanged)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# create uploads dir (cached)
RUN mkdir -p uploads

# copy app code last (changes most often)
COPY . .

# make R script executable
RUN chmod +x calculate_eds.R

# expose port
EXPOSE 8001

# run app with logging
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--log-level", "info", "--access-log"]
