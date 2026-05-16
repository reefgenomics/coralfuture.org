#!/usr/bin/env bash
# Build reef-extent MBTiles from MapData/Downloaded_data (see atlas_regions.tsv).
# Archives without Reef-Extent/reefextent.gpkg are skipped.
set -euo pipefail

MAXZOOM="${1:-16}"
MAX_PARALLEL="${MAX_PARALLEL:-4}"
SKIP_EXISTING_OUTPUTS="${SKIP_EXISTING_OUTPUTS:-0}"
ROOT="/home/coralfuture-server"
OUT="$ROOT/MapData/reef_extent"
DL="$ROOT/MapData/Downloaded_data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/atlas_regions.tsv"

mkdir -p "$OUT"

throttle_jobs() {
  while [[ "$(jobs -rp | wc -l)" -ge "$MAX_PARALLEL" ]]; do
    wait -n || true
  done
}

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
  if [[ "$SKIP_EXISTING_OUTPUTS" == "1" && -s "$out_mb" ]]; then
    echo "[reef extent] skip (already exists): $out_base" >&2
    return 0
  fi
  if ! zip_has_reef_gpkg "$zp"; then
    echo "[reef extent] skip (no Reef-Extent/reefextent.gpkg): $zip_rel" >&2
    return 0
  fi
  throttle_jobs
  bash "$SCRIPT_DIR/generate_reef_extent_region_mbtiles.sh" \
    "/vsizip//$zp/Reef-Extent/reefextent.gpkg" "$layer" "$out_mb" "$MAXZOOM" &
}

while IFS=$'\t' read -r rid zip layer; do
  [[ -z "${rid:-}" || "${rid:0:1}" == "#" ]] && continue
  run_reef_region "$zip" "$layer" "reef_extent_${rid}.mbtiles"
done < "$MANIFEST"

wait
echo "Reef extent MBTiles finished (skipped zips without reef layer). maxzoom=$MAXZOOM -> $OUT"
