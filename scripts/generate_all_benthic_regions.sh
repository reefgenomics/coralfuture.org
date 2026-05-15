#!/usr/bin/env bash
# Build benthic MBTiles from MapData/Downloaded_data regional zips.
# Archives without Benthic-Map/benthic.gpkg (reef-only or other products) are skipped with a log line.
set -euo pipefail

MAXZOOM="${1:-16}"
ROOT="/home/coralfuture-server"
OUT="$ROOT/MapData/benthic"
DL="$ROOT/MapData/Downloaded_data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$OUT"

zip_has_benthic_gpkg() {
  local zp="$1"
  [[ -f "$zp" ]] || return 1
  python3 -c "
import zipfile, sys
with zipfile.ZipFile(sys.argv[1]) as z:
    raise SystemExit(0 if 'Benthic-Map/benthic.gpkg' in z.namelist() else 1)
" "$zp"
}

# $1 = zip filename under Downloaded_data, $2 = layer name inside gpkg, $3 = output mbtiles basename
run_benthic_region() {
  local zip_rel="$1"
  local layer="$2"
  local out_base="$3"
  local zp="$DL/$zip_rel"
  local out_mb="$OUT/$out_base"
  if [[ ! -f "$zp" ]]; then
    echo "[benthic] skip (missing zip): $zip_rel" >&2
    return 0
  fi
  if ! zip_has_benthic_gpkg "$zp"; then
    echo "[benthic] skip (no Benthic-Map/benthic.gpkg): $zip_rel" >&2
    return 0
  fi
  bash "$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
    "/vsizip//$zp/Benthic-Map/benthic.gpkg" "$layer" "$out_mb" "$MAXZOOM" &
}

bash "$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
  "$ROOT/MapData/benthic/benthic.gpkg" \
  "Central Indian Ocean" \
  "$OUT/benthic_cio.mbtiles" \
  "$MAXZOOM" &

run_benthic_region "Northern-Caribbean--Florida---Bahamas-20230310014129.zip" "Northern Caribbean, Florida & Bahamas" "benthic_caribbean.mbtiles"
run_benthic_region "Northwestern-Arabian-Sea-20230310014334.zip" "Northwestern Arabian Sea" "benthic_arabian.mbtiles"
run_benthic_region "Red-Sea---Gulf-of-Aden-20230310014131.zip" "Red Sea & Gulf of Aden" "benthic_redsea.mbtiles"
run_benthic_region "Western-Micronesia-20230310012947.zip" "Western Micronesia" "benthic_micronesia.mbtiles"
run_benthic_region "Southwestern-Pacific-20230309235258.zip" "Southwestern Pacific" "benthic_sw_pacific.mbtiles"

wait
echo "Benthic MBTiles finished (skipped zips without benthic layer). maxzoom=$MAXZOOM -> $OUT"
