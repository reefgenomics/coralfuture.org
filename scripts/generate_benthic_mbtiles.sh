#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/generate_benthic_mbtiles.sh <input.geojson> [output.mbtiles] [layer_name]

Examples:
  scripts/generate_benthic_mbtiles.sh /home/coralfuture-server/MapData/benthic/benthic_from_gpkg.geojson
  scripts/generate_benthic_mbtiles.sh /home/coralfuture-server/MapData/benthic/benthic_from_gpkg.geojson ./shared_data/benthic/benthic_from_gpkg.mbtiles benthic
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

INPUT_GEOJSON="$1"
OUTPUT_MBTILES="${2:-${INPUT_GEOJSON%.*}.mbtiles}"
LAYER_NAME="${3:-benthic}"

if [[ ! -f "$INPUT_GEOJSON" ]]; then
  echo "Input GeoJSON not found: $INPUT_GEOJSON" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_MBTILES")"

docker run --rm \
  -v "$(dirname "$INPUT_GEOJSON"):/input:ro" \
  -v "$(dirname "$OUTPUT_MBTILES"):/output" \
  klokantech/tippecanoe:latest \
  tippecanoe \
    -o "/output/$(basename "$OUTPUT_MBTILES")" \
    -l "$LAYER_NAME" \
    -zg \
    --drop-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --force \
    "/input/$(basename "$INPUT_GEOJSON")"

echo "Generated $OUTPUT_MBTILES with vector layer '$LAYER_NAME'"
