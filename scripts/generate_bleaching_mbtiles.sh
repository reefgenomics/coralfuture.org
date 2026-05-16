#!/usr/bin/env bash
# Build bleaching 1 km grid MBTiles from GeoJSON (run build_bleaching_grid.py first).
set -euo pipefail

ROOT="/home/coralfuture-server"
GEOJSON="$ROOT/MapData/bleaching/bleaching_grid.geojson"
OUTPUT="$ROOT/MapData/bleaching/bleaching_grid.mbtiles"
MAXZOOM="${1:-14}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$GEOJSON" ]]; then
  echo "Running build_bleaching_grid.py ..." >&2
  python3 "$SCRIPT_DIR/build_bleaching_grid.py"
fi

if [[ ! -f "$GEOJSON" ]]; then
  echo "Missing $GEOJSON" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT"

ogr2ogr -progress \
  -f MVT "$OUTPUT" \
  "$GEOJSON" \
  -dsco FORMAT=MBTILES \
  -dsco NAME=bleaching_grid \
  -dsco MINZOOM=0 \
  -dsco MAXZOOM="$MAXZOOM" \
  -dsco MAX_SIZE=5000000 \
  -dsco MAX_FEATURES=500000 \
  -dsco COMPRESS=YES \
  -lco NAME=bleaching

echo "Generated $OUTPUT (source-layer: bleaching, maxzoom=$MAXZOOM)"
