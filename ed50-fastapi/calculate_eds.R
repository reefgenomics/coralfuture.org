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

#sorry for this all logs, i need them because R is not very verbose and i need to know what is going on.
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

# Universal function to clean dataset from empty/invalid columns
clean_dataset <- function(df) {
  if (is.null(df) || nrow(df) == 0) {
    return(df)
  }
  
  original_cols <- ncol(df)
  
  # Remove columns that are completely empty (all NA)
  empty_cols <- colnames(df)[colSums(!is.na(df)) == 0]
  
  # Remove columns with "Unnamed" prefix that are empty or have no useful data
  unnamed_cols <- colnames(df)[grepl("^Unnamed", colnames(df), ignore.case = TRUE)]
  unnamed_empty <- unnamed_cols[colSums(!is.na(df[, unnamed_cols, drop = FALSE])) == 0]
  
  # Remove columns with empty names that are empty
  empty_names <- colnames(df)[nchar(trimws(colnames(df))) == 0]
  empty_names_empty <- empty_names[colSums(!is.na(df[, empty_names, drop = FALSE])) == 0]
  
  # Combine all columns to remove
  cols_to_remove <- unique(c(empty_cols, unnamed_empty, empty_names_empty))
  
  if (length(cols_to_remove) > 0) {
    cat(paste0("[INFO] Removing ", length(cols_to_remove), " empty/invalid columns: ", paste(cols_to_remove, collapse = ", "), "\n"))
    flush.console()
    df <- df[, !colnames(df) %in% cols_to_remove, drop = FALSE]
  }
  
  if (ncol(df) < original_cols) {
    cat(paste0("[INFO] Dataset cleaned: ", original_cols, " -> ", ncol(df), " columns\n"))
    flush.console()
  }
  
  return(df)
}

cat("[INFO] Reading input data...\n")
flush.console()
raw_dataset <- NULL
tryCatch({
  dataset <- CBASSED50::read_data(input_csv)
  cat(paste0("[INFO] Data loaded via CBASSED50::read_data. Rows: ", nrow(dataset), ", Columns: ", ncol(dataset), "\n"))
  flush.console()
}, error = function(e) {
  cat(paste0("[WARN] CBASSED50::read_data failed, trying readr::read_csv: ", e$message, "\n"))
  flush.console()
  dataset <<- readr::read_csv(input_csv, show_col_types = FALSE)
  cat(paste0("[INFO] Data loaded via readr. Rows: ", nrow(dataset), ", Columns: ", ncol(dataset), "\n"))
  flush.console()
})

# Clean dataset from empty/invalid columns
dataset <- clean_dataset(dataset)
raw_dataset <- dataset

cat(paste0("[INFO] Final dataset: ", nrow(dataset), " rows, ", ncol(dataset), " columns\n"))
cat(paste0("[INFO] Column names: ", paste(colnames(dataset), collapse = ", "), "\n"))
if ("Temperature" %in% colnames(dataset)) {
  cat(paste0("[INFO] Temperature column found. Unique values: ", length(unique(dataset$Temperature)), "\n"))
  if (nrow(dataset) > 0) {
    cat(paste0("[INFO] Temperature range: ", min(dataset$Temperature, na.rm = TRUE), " - ", max(dataset$Temperature, na.rm = TRUE), "\n"))
  }
} else {
  cat("[WARN] Temperature column not found in dataset!\n")
}
flush.console()

cat("[INFO] Preprocessing dataset...\n")
cat(paste0("[INFO] Before preprocessing: ", nrow(dataset), " rows, ", ncol(dataset), " columns\n"))
if ("Temperature" %in% colnames(dataset)) {
  cat(paste0("[INFO] Temperature column found. Unique values: ", length(unique(dataset$Temperature)), "\n"))
  cat(paste0("[INFO] Temperature values: ", paste(sort(unique(dataset$Temperature)), collapse = ", "), "\n"))
}
flush.console()
dataset <- CBASSED50::preprocess_dataset(dataset)
cat("[INFO] Dataset preprocessed successfully\n")
cat(paste0("[INFO] Preprocessed data: ", nrow(dataset), " rows, ", ncol(dataset), " columns\n"))
if ("Temperature" %in% colnames(dataset)) {
  cat(paste0("[INFO] After preprocessing - Unique temperature values: ", length(unique(dataset$Temperature)), "\n"))
}
flush.console()

cat("[INFO] Processing dataset...\n")
cat(paste0("[INFO] Before processing: ", nrow(dataset), " rows\n"))
if ("Temperature" %in% colnames(dataset)) {
  cat(paste0("[INFO] Before processing - Unique temperature values: ", length(unique(dataset$Temperature)), "\n"))
}
flush.console()
dataset <- CBASSED50::process_dataset(dataset, grouping_properties = grouping_props)
cat("[INFO] Dataset processed successfully\n")
cat(paste0("[INFO] Processed data: ", nrow(dataset), " rows, ", ncol(dataset), " columns\n"))
if ("Temperature" %in% colnames(dataset)) {
  cat(paste0("[INFO] After processing - Unique temperature values: ", length(unique(dataset$Temperature)), "\n"))
  if (nrow(dataset) > 0) {
    # Check temperature distribution by groups
    groups_check <- dataset %>% 
      dplyr::group_by(across(all_of(grouping_props))) %>% 
      dplyr::summarise(
        n_rows = n(),
        n_temps = length(unique(Temperature)),
        temps = paste(sort(unique(Temperature)), collapse = ", "),
        .groups = "drop"
      )
    cat(paste0("[INFO] Number of groups after processing: ", nrow(groups_check), "\n"))
    if (nrow(groups_check) > 0) {
      cat(paste0("[INFO] Groups with < 4 temps: ", sum(groups_check$n_temps < 4), "\n"))
      if (sum(groups_check$n_temps < 4) > 0) {
        cat("[INFO] Sample groups with < 4 temps:\n")
        print(head(groups_check[groups_check$n_temps < 4, ], 3))
      }
    }
  } else {
    cat("[ERROR] Dataset is empty after processing!\n")
  }
} else {
  cat("[ERROR] Temperature column missing after processing!\n")
}
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

# Calculate aggregated statistics (Mean, SD, SE, Conf_Int) for each ED value
cat("[INFO] Calculating aggregated statistics...\n")
flush.console()

# Ensure grouping properties are present for aggregation
grouping_cols <- intersect(grouping_props, colnames(eds_df))
if (length(grouping_cols) == 0) {
  cat("[WARN] No grouping columns found for aggregation. Using GroupingProperty if available.\n")
  flush.console()
  if ("GroupingProperty" %in% colnames(eds_df)) {
    grouping_cols <- "GroupingProperty"
  }
}

if (length(grouping_cols) > 0 && all(c("ED5", "ED50", "ED95") %in% colnames(eds_df))) {
  # Helper function to calculate SE and Conf_Int safely
  calc_se <- function(x) {
    n <- sum(!is.na(x))
    if (n > 1) {
      sd_val <- sd(x, na.rm = TRUE)
      if (!is.na(sd_val) && sd_val > 0) {
        return(sd_val / sqrt(n))
      }
    }
    return(NA)
  }
  
  calc_conf_int <- function(x) {
    n <- sum(!is.na(x))
    if (n > 1) {
      sd_val <- sd(x, na.rm = TRUE)
      if (!is.na(sd_val) && sd_val > 0) {
        se <- sd_val / sqrt(n)
        df <- n - 1
        if (df > 0) {
          t_val <- tryCatch(qt(0.975, df = df), error = function(e) NA)
          if (!is.na(t_val)) {
            return(t_val * se)
          }
        }
      }
    }
    return(NA)
  }
  
  # Calculate statistics for each group
  aggregated_df <- eds_df %>%
    dplyr::group_by(across(all_of(grouping_cols))) %>%
    dplyr::summarise(
      Mean_ED5 = mean(ED5, na.rm = TRUE),
      SD_ED5 = sd(ED5, na.rm = TRUE),
      SE_ED5 = calc_se(ED5),
      Conf_Int_5 = calc_conf_int(ED5),
      Mean_ED50 = mean(ED50, na.rm = TRUE),
      SD_ED50 = sd(ED50, na.rm = TRUE),
      SE_ED50 = calc_se(ED50),
      Conf_Int_50 = calc_conf_int(ED50),
      Mean_ED95 = mean(ED95, na.rm = TRUE),
      SD_ED95 = sd(ED95, na.rm = TRUE),
      SE_ED95 = calc_se(ED95),
      Conf_Int_95 = calc_conf_int(ED95),
      .groups = "drop"
    ) %>%
    dplyr::mutate(
      # Replace NaN and Inf with NA
      across(where(is.numeric), ~ ifelse(is.nan(.) | is.infinite(.), NA, .))
    )
  
  cat(paste0("[INFO] Aggregated statistics calculated. Rows: ", nrow(aggregated_df), "\n"))
  cat(paste0("[INFO] Aggregated columns: ", paste(colnames(aggregated_df), collapse = ", "), "\n"))
  flush.console()
  
  # Combine individual ED values with aggregated statistics
  # First, save individual values
  individual_df <- eds_df
  
  # Reorder aggregated columns to match expected format
  expected_agg_cols <- c(grouping_cols, 
                        "Mean_ED5", "SD_ED5", "SE_ED5", "Conf_Int_5",
                        "Mean_ED50", "SD_ED50", "SE_ED50", "Conf_Int_50",
                        "Mean_ED95", "SD_ED95", "SE_ED95", "Conf_Int_95")
  available_agg_cols <- intersect(expected_agg_cols, colnames(aggregated_df))
  other_agg_cols <- setdiff(colnames(aggregated_df), expected_agg_cols)
  aggregated_df <- aggregated_df[, c(available_agg_cols, other_agg_cols), drop = FALSE]
  
  # Save aggregated statistics to separate file
  aggregated_csv <- sub("\\.csv$", "_aggregated.csv", output_csv)
  cat(paste0("[INFO] Saving aggregated statistics to: ", aggregated_csv, "\n"))
  flush.console()
  write.csv(aggregated_df, aggregated_csv, row.names = FALSE)
  cat(paste0("[INFO] Aggregated statistics saved: ", nrow(aggregated_df), " rows\n"))
  flush.console()
  
  # Save individual values to main output file
  cat(paste0("[INFO] Saving individual ED values to: ", output_csv, "\n"))
  flush.console()
  write.csv(individual_df, output_csv, row.names = FALSE)
  
  # Append aggregated statistics to main file
  cat("\n#AGGREGATED_STATISTICS\n", file = output_csv, append = TRUE)
  write.table(aggregated_df, output_csv, sep = ",", row.names = FALSE, col.names = TRUE, append = TRUE)
  
  cat(paste0("[INFO] Calculations completed successfully.\n"))
  cat(paste0("[INFO] Individual ED values saved to: ", output_csv, " (", nrow(individual_df), " rows)\n"))
  cat(paste0("[INFO] Aggregated statistics saved to: ", aggregated_csv, " (", nrow(aggregated_df), " rows)\n"))
  flush.console()
} else {
  cat("[WARN] Cannot calculate aggregated statistics. Missing required columns or grouping properties.\n")
  flush.console()
  cat(paste0("[INFO] Saving results to: ", output_csv, "\n"))
  flush.console()
  write.csv(eds_df, output_csv, row.names = FALSE)
  cat(paste0("[INFO] Calculations completed successfully. Results saved to: ", output_csv, "\n"))
  flush.console()
}

safe_numeric <- function(value, fallback) {
  if (is.na(value) || !is.finite(value)) {
    return(fallback)
  }
  return(value)
}

size_text <- safe_numeric(size_text, 12)
size_points <- safe_numeric(size_points, 2.5)

# Переопределение функций графиков для обхода ограничения в 12 цветов
plot_ED50_box_unlimited <- function(cbass_dataset, grouping_properties, drm_formula, Condition, faceting, size_text, size_points) {
  plot_obj <- CBASSED50::plot_ED50_box(cbass_dataset, grouping_properties, drm_formula, Condition, faceting, size_text, size_points)
  n_colors <- length(unique(cbass_dataset[[Condition]]))
  if (n_colors > 8) {
    plot_obj <- plot_obj + ggplot2::scale_color_manual(values = grDevices::rainbow(n_colors))
  }
  return(plot_obj)
}

exploratory_tr_curve_unlimited <- function(cbass_dataset, grouping_properties, faceting, size_text, size_points) {
  plot_obj <- CBASSED50::exploratory_tr_curve(cbass_dataset, grouping_properties, faceting, size_text, size_points)
  n_colors <- length(unique(cbass_dataset$Genotype))
  if (n_colors > 12) {
    plot_obj <- plot_obj + ggplot2::scale_color_manual(values = grDevices::rainbow(n_colors))
  }
  return(plot_obj)
}

plot_model_curve_unlimited <- function(cbass_dataset, grouping_properties, drm_formula, faceting_model, size_text, size_points, condition_col = "Condition") {
  plot_obj <- CBASSED50::plot_model_curve(cbass_dataset, grouping_properties, drm_formula, faceting_model, size_text, size_points)
  if (condition_col %in% colnames(cbass_dataset)) {
    n_colors <- length(unique(cbass_dataset[[condition_col]]))
    if (n_colors > 8) {
      plot_obj <- plot_obj + 
        ggplot2::scale_color_manual(values = grDevices::rainbow(n_colors)) +
        ggplot2::scale_fill_manual(values = grDevices::rainbow(n_colors))
    }
  }
  return(plot_obj)
}

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
    plot_ED50_box_unlimited(
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
    exploratory_tr_curve_unlimited(
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
    plot_model_curve_unlimited(
      raw_dataset,
      grouping_properties = grouping_props,
      drm_formula = drm_formula,
      faceting_model = faceting_model_formula,
      size_text = size_text,
      size_points = size_points,
      condition_col = condition_column
    )
  },
  model_curve_path,
  "model curve plot"
)
