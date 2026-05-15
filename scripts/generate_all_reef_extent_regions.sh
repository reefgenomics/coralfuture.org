#!/usr/bin/env bash
# Build reef-extent MBTiles from MapData/Downloaded_data. Skips zips without Reef-Extent/reefextent.gpkg.
set -euo pipefail

MAXZOOM="${1:-16}"
ROOT="/home/coralfuture-server"
OUT="$ROOT/MapData/reef_extent"
DL="$ROOT/MapData/Downloaded_data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$OUT"

zip_has_reef_gpkg() {
  local zp="$1"
  [[ -f "$zp" ]] || return 1
  python3 -c "
import zipfile, sys
with zipfile.ZipFile(sys.argv[1]) as z:
    raise SystemExit(0 if 'Reef-Extent/reefextent.gpkg' in z.namelist() else 1)
" "$zp"
}

run_reef_region() {
  local zip_rel="$1"
  local layer="$2"
  local out_base="$3"
  local zp="$DL/$zip_rel"
  local out_mb="$OUT/$out_base"
  if [[ ! -f "$zp" ]]; then
    echo "[reef extent] skip (missing zip): $zip_rel" >&2
    return 0
  fi
  if ! zip_has_reef_gpkg "$zp"; then
    echo "[reef extent] skip (no Reef-Extent/reefextent.gpkg): $zip_rel" >&2
    return 0
  fi
  bash "$SCRIPT_DIR/generate_reef_extent_region_mbtiles.sh" \
    "/vsizip//$zp/Reef-Extent/reefextent.gpkg" "$layer" "$out_mb" "$MAXZOOM" &
}

run_reef_region "Northern-Caribbean--Florida---Bahamas-20230310014129.zip" "Northern Caribbean, Florida & Bahamas" "reef_extent_caribbean.mbtiles"
run_reef_region "Northwestern-Arabian-Sea-20230310014334.zip" "Northwestern Arabian Sea" "reef_extent_arabian.mbtiles"
run_reef_region "Red-Sea---Gulf-of-Aden-20230310014131.zip" "Red Sea & Gulf of Aden" "reef_extent_redsea.mbtiles"
run_reef_region "Western-Micronesia-20230310012947.zip" "Western Micronesia" "reef_extent_micronesia.mbtiles"
run_reef_region "Southwestern-Pacific-20230309235258.zip" "Southwestern Pacific" "reef_extent_sw_pacific.mbtiles"

wait
echo "Reef extent MBTiles finished (skipped zips without reef layer). maxzoom=$MAXZOOM -> $OUT"
