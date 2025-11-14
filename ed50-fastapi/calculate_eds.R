#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 4) {
  stop("Insufficient arguments. Usage: Rscript calculate_eds.R <input_csv> <output_csv> <grouping_properties> <drm_formula> [condition] [faceting] [faceting_model] [size_text] [size_points] [boxplot_path] [temp_curve_path] [model_curve_path]")
}

get_arg <- function(index, default = NA_character_) {
  if (length(args) >= index && nzchar(args[index])) {
    return(args[index])
  }
  return(default)
}

input_csv <- args[1]
output_csv <- args[2]
grouping_properties <- args[3]
drm_formula <- args[4]
condition_column <- get_arg(5, "Condition")
faceting_formula <- get_arg(6, "~ Site")
faceting_model_formula <- get_arg(7, "Species ~ Site ~ Condition")
size_text <- as.numeric(get_arg(8, "12"))
size_points <- as.numeric(get_arg(9, "2.5"))
boxplot_path <- get_arg(10)
temp_curve_path <- get_arg(11)
model_curve_path <- get_arg(12)

cat("[INFO] Starting ED calculation\n")
flush.console()
cat(paste0("[INFO] Input file: ", input_csv, "\n"))
flush.console()
cat(paste0("[INFO] Output file: ", output_csv, "\n"))
flush.console()
cat(paste0("[INFO] Grouping properties: ", grouping_properties, "\n"))
flush.console()
cat(paste0("[INFO] DRM formula: ", drm_formula, "\n"))
flush.console()

cat("[INFO] Loading CBASSED50 package...\n")
flush.console()
if (!require("CBASSED50", character.only = TRUE)) {
  stop("CBASSED50 package is not installed. Please install it before use.")
}
cat("[INFO] CBASSED50 package loaded successfully\n")
flush.console()

cat("[INFO] Loading helper packages...\n")
flush.console()
for (pkg in c("dplyr", "readr", "ggplot2")) {
  if (!require(pkg, character.only = TRUE)) {
    cat(paste0("[ERROR] Package ", pkg, " is not installed. It should be pre-installed in Docker container.\n"))
    flush.console()
    stop(paste0("Required package ", pkg, " is missing. Please rebuild Docker image."))
  } else {
    cat(paste0("[INFO] Package ", pkg, " loaded successfully\n"))
    flush.console()
  }
}

cat("[INFO] Parsing grouping properties...\n")
flush.console()
grouping_props <- trimws(strsplit(grouping_properties, ",")[[1]])
cat(paste0("[INFO] Grouping properties: ", paste(grouping_props, collapse = ", "), "\n"))
flush.console()

cat("[INFO] Reading input data...\n")
flush.console()
raw_dataset <- NULL
tryCatch({
  dataset <- CBASSED50::read_data(input_csv)
  raw_dataset <<- dataset
  cat(paste0("[INFO] Data loaded successfully. Rows: ", nrow(dataset), ", Columns: ", ncol(dataset), "\n"))
  flush.console()
}, error = function(e) {
  cat(paste0("[WARN] CBASSED50::read_data failed, trying readr::read_csv: ", e$message, "\n"))
  flush.console()
  dataset <<- readr::read_csv(input_csv, show_col_types = FALSE)
  raw_dataset <<- dataset
  cat(paste0("[INFO] Data loaded via readr. Rows: ", nrow(dataset), ", Columns: ", ncol(dataset), "\n"))
  flush.console()
})

cat("[INFO] Preprocessing dataset...\n")
flush.console()
dataset <- CBASSED50::preprocess_dataset(dataset)
cat("[INFO] Dataset preprocessed successfully\n")
cat(paste0("[INFO] Preprocessed data: ", nrow(dataset), " rows, ", ncol(dataset), " columns\n"))
flush.console()

cat("[INFO] Processing dataset...\n")
flush.console()
dataset <- CBASSED50::process_dataset(dataset, grouping_properties = grouping_props)
cat("[INFO] Dataset processed successfully\n")
cat(paste0("[INFO] Processed data: ", nrow(dataset), " rows, ", ncol(dataset), " columns\n"))
flush.console()

cat("[INFO] Calculating EDs...\n")
flush.console()

groups <- dataset %>% dplyr::group_by(across(all_of(grouping_props))) %>% dplyr::summarise(n = n(), .groups = "drop")
cat(paste0("[INFO] Number of groups to process: ", nrow(groups), "\n"))
flush.console()
cat("[INFO] This may take some time depending on data size...\n")
flush.console()

cat("[INFO] Starting ED calculation for each group...\n")
flush.console()

eds_df <- dataset %>%
  CBASSED50::calculate_eds(grouping_properties = grouping_props, drm_formula = drm_formula)

cat(paste0("[INFO] ED calculation completed. Results: ", nrow(eds_df), " rows\n"))
cat(paste0("[INFO] Result columns: ", paste(colnames(eds_df), collapse = ", "), "\n"))
flush.console()

cat("[INFO] Checking result columns...\n")
cat(paste0("[INFO] Columns in result: ", paste(colnames(eds_df), collapse = ", "), "\n"))
flush.console()

if ("GroupingProperty" %in% colnames(eds_df)) {
  cat("[INFO] Extracting grouping properties from GroupingProperty column...\n")
  flush.console()
  
  gp_lookup <- dataset %>%
    dplyr::select(all_of(grouping_props)) %>%
    dplyr::distinct()
  
  for (gp in grouping_props) {
    gp_lookup[[gp]] <- as.character(gp_lookup[[gp]])
  }
  
  gp_lookup$GroupingProperty <- do.call(paste, c(gp_lookup[, grouping_props, drop = FALSE], sep = "_"))
  
  cat(paste0("[INFO] Lookup table created with ", nrow(gp_lookup), " unique groups\n"))
  flush.console()
  
  missing_props <- setdiff(grouping_props, colnames(eds_df))
  na_props <- grouping_props[grouping_props %in% colnames(eds_df) & 
                              sapply(grouping_props, function(gp) all(is.na(eds_df[[gp]])))]
  all_missing_props <- unique(c(missing_props, na_props))
  
  if (length(all_missing_props) > 0) {
    cat(paste0("[INFO] Missing or empty grouping properties: ", paste(all_missing_props, collapse = ", "), "\n"))
    flush.console()
    
    eds_df <- eds_df %>%
      dplyr::left_join(gp_lookup, by = "GroupingProperty", suffix = c("", ".new"))
    
    for (gp in all_missing_props) {
      gp_new <- paste0(gp, ".new")
      if (gp_new %in% colnames(eds_df)) {
        if (gp %in% colnames(eds_df)) {
          eds_df[[gp]][is.na(eds_df[[gp]])] <- eds_df[[gp_new]][is.na(eds_df[[gp]])]
        } else {
          eds_df[[gp]] <- eds_df[[gp_new]]
        }
        eds_df[[gp_new]] <- NULL
      }
    }
    
    cat(paste0("[INFO] After join, columns: ", paste(colnames(eds_df), collapse = ", "), "\n"))
    
    for (gp in all_missing_props) {
      if (gp %in% colnames(eds_df)) {
        non_na_count <- sum(!is.na(eds_df[[gp]]))
        cat(paste0("[INFO] Column ", gp, " updated. Non-NA values: ", non_na_count, " of ", nrow(eds_df), "\n"))
      }
    }
    flush.console()
  } else {
    cat("[INFO] All grouping properties already present with values\n")
    flush.console()
  }
}

cols_order <- c("ED5", "ED50", "ED95", "GroupingProperty")
cols_order <- c(cols_order, setdiff(grouping_props, cols_order))
cols_order <- c(cols_order, setdiff(colnames(eds_df), cols_order))
eds_df <- eds_df[, cols_order, drop = FALSE]

cat(paste0("[INFO] Final result columns: ", paste(colnames(eds_df), collapse = ", "), "\n"))
flush.console()

cat(paste0("[INFO] Saving results to: ", output_csv, "\n"))
flush.console()
write.csv(eds_df, output_csv, row.names = FALSE)

cat(paste0("[INFO] Calculations completed successfully. Results saved to: ", output_csv, "\n"))
flush.console()

safe_numeric <- function(value, fallback) {
  if (is.na(value) || !is.finite(value)) {
    return(fallback)
  }
  return(value)
}

size_text <- safe_numeric(size_text, 12)
size_points <- safe_numeric(size_points, 2.5)

save_plot_if_requested <- function(plot_fn, output_path, description) {
  if (is.na(output_path) || !nzchar(output_path)) {
    return(invisible(NULL))
  }
  
  cat(paste0("[INFO] Generating ", description, "...\n"))
  flush.console()
  tryCatch({
    plot_obj <- plot_fn()
    ggplot2::ggsave(output_path, plot = plot_obj, width = 12, height = 8, dpi = 300)
    cat(paste0("[INFO] ", description, " saved to ", output_path, "\n"))
  }, error = function(e) {
    cat(paste0("[WARN] Failed to generate ", description, ": ", e$message, "\n"))
  })
  flush.console()
}

save_plot_if_requested(
  function() {
    CBASSED50::plot_ED50_box(
      raw_dataset,
      grouping_properties = grouping_props,
      drm_formula = drm_formula,
      Condition = condition_column,
      faceting = faceting_formula,
      size_text = size_text,
      size_points = size_points
    )
  },
  boxplot_path,
  "ED50 boxplot"
)

save_plot_if_requested(
  function() {
    CBASSED50::exploratory_tr_curve(
      raw_dataset,
      grouping_properties = grouping_props,
      faceting = faceting_formula,
      size_text = size_text,
      size_points = size_points
    )
  },
  temp_curve_path,
  "exploratory temperature response curve"
)

save_plot_if_requested(
  function() {
    CBASSED50::plot_model_curve(
      raw_dataset,
      grouping_properties = grouping_props,
      drm_formula = drm_formula,
      faceting_model = faceting_model_formula,
      size_text = size_text,
      size_points = size_points
    )
  },
  model_curve_path,
  "model curve plot"
)
