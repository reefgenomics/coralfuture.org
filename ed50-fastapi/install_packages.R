# Ensure required libraries are installed
# Install missing dependencies for devtools

required_packages <- c("shiny", "bslib", "dplyr", "tidyr", "ggplot2", "readxl", "rstudioapi", "RColorBrewer", "shinycssloaders", "shinyjs", "devtools", "bslib", "DT", "drc", "colourpicker", "readr")

for (pkg in required_packages) {
    if (!require(pkg, character.only = TRUE)) {
        cat(paste0("Installing package: ", pkg, "\n"))
        install.packages(pkg, dependencies = TRUE, repos='https://cloud.r-project.org', quiet = TRUE)
        library(pkg, character.only = TRUE)
        cat(paste0("Package ", pkg, " installed and loaded\n"))
    }
}

# Try to install CBASSED50 from different sources
if (!require("CBASSED50", character.only = TRUE)) {
    # Try from CRAN first
    try({
        install.packages("CBASSED50", repos='https://cloud.r-project.org')
        library("CBASSED50")
    }, silent = TRUE)
    
    # If not available, try from GitHub
    if (!require("CBASSED50", character.only = TRUE)) {
        try({
            devtools::install_github("ColinL1/CBASSED50")
            library("CBASSED50")
        }, silent = TRUE)
    }
}

