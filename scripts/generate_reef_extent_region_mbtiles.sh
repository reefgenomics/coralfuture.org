#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/generate_reef_extent_region_mbtiles.sh <datasource> <layer_name> <output.mbtiles> [maxzoom]

Vector tile layer name in PBFs is fixed to "reef_extent" (-lco NAME=reef_extent).

Examples:
  scripts/generate_reef_extent_region_mbtiles.sh \
    "/vsizip//home/coralfuture-server/MapData/Downloaded_data/Red-Sea---Gulf-of-Aden-20230310014131.zip/Reef-Extent/reefextent.gpkg" \
    "Red Sea & Gulf of Aden" \
    /home/coralfuture-server/MapData/reef_extent/reef_extent_redsea.mbtiles \
    16
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 3 ]]; then
  usage
  exit 0
fi

DATASOURCE="$1"
LAYER_NAME="$2"
OUTPUT_MBTILES="$3"
MAXZOOM="${4:-16}"

mkdir -p "$(dirname "$OUTPUT_MBTILES")"
rm -f "$OUTPUT_MBTILES"

ogr2ogr -progress \
  -f MVT "$OUTPUT_MBTILES" \
  "$DATASOURCE" "$LAYER_NAME" \
  -dsco FORMAT=MBTILES \
  -dsco NAME="$(basename "$OUTPUT_MBTILES" .mbtiles)" \
  -dsco MINZOOM=0 \
  -dsco MAXZOOM="$MAXZOOM" \
  -dsco MAX_SIZE=5000000 \
  -dsco MAX_FEATURES=1000000 \
  -dsco COMPRESS=YES \
  -lco NAME=reef_extent

echo "Generated $OUTPUT_MBTILES from layer '$LAYER_NAME' with maxzoom $MAXZOOM (source-layer reef_extent)"
