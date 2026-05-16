#!/usr/bin/env Rscript
# Pre-calculated ED uploads (no PAM): aggregate statistics + ED50 boxplot.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 3) {
  stop("Usage: Rscript no_pam_attachments.R <input_csv> <statistics_csv> <boxplot_png> [grouping_properties] [condition] [faceting] [size_text] [size_points]")
}

get_arg <- function(index, default = NA_character_) {
  if (length(args) >= index && nzchar(args[index])) args[index] else default
}

input_csv <- args[1]
statistics_csv <- args[2]
boxplot_path <- args[3]
grouping_properties <- get_arg(4, "Site,Condition,Species,Timepoint")
condition_column <- get_arg(5, "Condition")
faceting_formula <- get_arg(6, " ~ Species")
size_text <- as.numeric(get_arg(7, "10"))
size_points <- as.numeric(get_arg(8, "1"))

for (pkg in c("dplyr", "readr", "ggplot2")) {
  if (!require(pkg, character.only = TRUE)) {
    stop(paste("Required package missing:", pkg))
  }
}

rename_to_canonical <- function(df) {
  canon <- c(
    "site" = "Site", "condition" = "Condition", "species" = "Species",
    "timepoint" = "Timepoint", "genotype" = "Genotype",
    "ed5" = "ED5", "ed50" = "ED50", "ed95" = "ED95"
  )
  nm <- colnames(df)
  for (i in seq_along(nm)) {
    key <- tolower(trimws(nm[i]))
    if (key %in% names(canon)) nm[i] <- canon[[key]]
  }
  colnames(df) <- nm
  df
}

calc_se <- function(x) {
  n <- sum(!is.na(x))
  if (n > 1) {
    sd_val <- sd(x, na.rm = TRUE)
    if (!is.na(sd_val) && sd_val > 0) return(sd_val / sqrt(n))
  }
  NA_real_
}

calc_conf_int <- function(x) {
  n <- sum(!is.na(x))
  if (n > 1) {
    sd_val <- sd(x, na.rm = TRUE)
    if (!is.na(sd_val) && sd_val > 0) {
      se <- sd_val / sqrt(n)
      df <- n - 1
      if (df > 0) {
        t_val <- tryCatch(qt(0.975, df = df), error = function(e) NA_real_)
        if (!is.na(t_val)) return(t_val * se)
      }
    }
  }
  NA_real_
}

plot_ED50_box_unlimited <- function(cbass_dataset, grouping_properties, drm_formula, Condition, faceting, size_text, size_points) {
  if (!require("CBASSED50", character.only = TRUE)) {
    stop("CBASSED50 package is not installed")
  }
  plot_obj <- CBASSED50::plot_ED50_box(
    cbass_dataset, grouping_properties, drm_formula, Condition, faceting, size_text, size_points
  )
  if (Condition %in% colnames(cbass_dataset)) {
    n_colors <- length(unique(cbass_dataset[[Condition]]))
    plot_obj <- plot_obj + ggplot2::scale_color_manual(values = grDevices::rainbow(n_colors))
  }
  plot_obj
}

plot_ED50_box_from_precalculated <- function(df_distinct, condition_column, faceting_formula, size_text, size_points) {
  if (!condition_column %in% colnames(df_distinct) || !"ED50" %in% colnames(df_distinct)) {
    stop("Missing Condition or ED50 for boxplot")
  }
  n_colors <- length(unique(df_distinct[[condition_column]]))
  ggplot2::ggplot(
    df_distinct,
    ggplot2::aes(
      x = .data[[condition_column]],
      y = ED50,
      color = .data[[condition_column]],
      fill = .data[[condition_column]]
    )
  ) +
    ggplot2::geom_boxplot(outlier.shape = NA, alpha = 0.35) +
    ggplot2::geom_jitter(width = 0.12, size = size_points) +
    ggplot2::facet_wrap(stats::as.formula(faceting_formula)) +
    ggplot2::theme_bw(base_size = size_text) +
    ggplot2::labs(x = condition_column, y = "ED50") +
    ggplot2::scale_color_manual(values = grDevices::rainbow(n_colors)) +
    ggplot2::scale_fill_manual(values = grDevices::rainbow(n_colors))
}

cat("[INFO] no-PAM attachments: reading input\n")
df <- readr::read_csv(input_csv, show_col_types = FALSE)
df <- rename_to_canonical(df)

grouping_props <- trimws(strsplit(grouping_properties, ",")[[1]])
ed_cols <- c("ED5", "ED50", "ED95")
required <- c(grouping_props, "Genotype", ed_cols)
missing <- setdiff(required, colnames(df))
if (length(missing) > 0) {
  stop(paste("Missing columns:", paste(missing, collapse = ", ")))
}

# One row per genotype × timepoint (ED constant across temperature replicates).
distinct_cols <- c(grouping_props, "Genotype", ed_cols)
df_distinct <- df %>% dplyr::distinct(dplyr::across(dplyr::all_of(distinct_cols)), .keep_all = TRUE)

cat(paste0("[INFO] Rows after distinct: ", nrow(df_distinct), " (from ", nrow(df), ")\n"))

grouping_cols <- intersect(grouping_props, colnames(df_distinct))
aggregated_df <- df_distinct %>%
  dplyr::group_by(dplyr::across(dplyr::all_of(grouping_cols))) %>%
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
  )

readr::write_csv(aggregated_df, statistics_csv)
cat(paste0("[INFO] Statistics written: ", statistics_csv, " (", nrow(aggregated_df), " rows)\n"))

if (!is.na(boxplot_path) && nzchar(boxplot_path)) {
  cat("[INFO] Generating ED50 boxplot\n")
  plot_obj <- NULL
  if (require("CBASSED50", quietly = TRUE)) {
    plot_input <- df %>%
      dplyr::mutate(Pam_value = ED50)
    tryCatch({
      plot_obj <- plot_ED50_box_unlimited(
        plot_input,
        grouping_properties = grouping_props,
        drm_formula = "Pam_value ~ Temperature",
        Condition = condition_column,
        faceting = faceting_formula,
        size_text = size_text,
        size_points = size_points
      )
      cat("[INFO] Boxplot via CBASSED50::plot_ED50_box\n")
    }, error = function(e) {
      cat(paste0("[WARN] CBASSED50 boxplot failed: ", e$message, "; using pre-calculated ED50 plot\n"))
    })
  }
  if (is.null(plot_obj)) {
    plot_obj <- plot_ED50_box_from_precalculated(
      df_distinct, condition_column, faceting_formula, size_text, size_points
    )
    cat("[INFO] Boxplot from pre-calculated ED50 values\n")
  }
  ggplot2::ggsave(boxplot_path, plot = plot_obj, width = 12, height = 8, dpi = 300)
  cat(paste0("[INFO] Boxplot saved: ", boxplot_path, "\n"))
}

cat("[INFO] no-PAM attachments finished\n")
