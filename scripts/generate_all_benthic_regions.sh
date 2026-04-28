#!/usr/bin/env bash
set -euo pipefail

MAXZOOM="${1:-16}"
ROOT="/home/coralfuture-server"
OUT="$ROOT/MapData/benthic"
DL="$ROOT/MapData/Downloaded_data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
  "$ROOT/MapData/benthic/benthic.gpkg" \
  "Central Indian Ocean" \
  "$OUT/benthic_cio.mbtiles" \
  "$MAXZOOM" &

"$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
  "/vsizip//$DL/Northern-Caribbean--Florida---Bahamas-20230310014129.zip/Benthic-Map/benthic.gpkg" \
  "Northern Caribbean, Florida & Bahamas" \
  "$OUT/benthic_caribbean.mbtiles" \
  "$MAXZOOM" &

"$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
  "/vsizip//$DL/Northwestern-Arabian-Sea-20230310014334.zip/Benthic-Map/benthic.gpkg" \
  "Northwestern Arabian Sea" \
  "$OUT/benthic_arabian.mbtiles" \
  "$MAXZOOM" &

"$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
  "/vsizip//$DL/Red-Sea---Gulf-of-Aden-20230310014131.zip/Benthic-Map/benthic.gpkg" \
  "Red Sea & Gulf of Aden" \
  "$OUT/benthic_redsea.mbtiles" \
  "$MAXZOOM" &

wait
echo "Generated all benthic region MBTiles with maxzoom $MAXZOOM"
