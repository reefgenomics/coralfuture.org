#!/usr/bin/env bash
# Build benthic MBTiles from MapData/Downloaded_data regional zips (see atlas_regions.tsv).
# Archives without Benthic-Map/benthic.gpkg are skipped.
set -euo pipefail

MAXZOOM="${1:-16}"
MAX_PARALLEL="${MAX_PARALLEL:-4}"
# Set SKIP_EXISTING_OUTPUTS=1 to avoid rebuilding MBTiles that already exist (add new regions only).
SKIP_EXISTING_OUTPUTS="${SKIP_EXISTING_OUTPUTS:-0}"
ROOT="/home/coralfuture-server"
OUT="$ROOT/MapData/benthic"
DL="$ROOT/MapData/Downloaded_data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/atlas_regions.tsv"

mkdir -p "$OUT"

throttle_jobs() {
  while [[ "$(jobs -rp | wc -l)" -ge "$MAX_PARALLEL" ]]; do
    wait -n || true
  done
}

zip_has_benthic_gpkg() {
  local zp="$1"
  [[ -f "$zp" ]] || return 1
  python3 -c "
import zipfile, sys
with zipfile.ZipFile(sys.argv[1]) as z:
    raise SystemExit(0 if 'Benthic-Map/benthic.gpkg' in z.namelist() else 1)
" "$zp"
}

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
  if [[ "$SKIP_EXISTING_OUTPUTS" == "1" && -s "$out_mb" ]]; then
    echo "[benthic] skip (already exists): $out_base" >&2
    return 0
  fi
  if ! zip_has_benthic_gpkg "$zp"; then
    echo "[benthic] skip (no Benthic-Map/benthic.gpkg): $zip_rel" >&2
    return 0
  fi
  throttle_jobs
  bash "$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
    "/vsizip//$zp/Benthic-Map/benthic.gpkg" "$layer" "$out_mb" "$MAXZOOM" &
}

throttle_jobs
if [[ "$SKIP_EXISTING_OUTPUTS" == "1" && -s "$OUT/benthic_cio.mbtiles" ]]; then
  echo "[benthic] skip CIO (already exists): benthic_cio.mbtiles" >&2
else
  bash "$SCRIPT_DIR/generate_benthic_region_mbtiles.sh" \
    "$ROOT/MapData/benthic/benthic.gpkg" \
    "Central Indian Ocean" \
    "$OUT/benthic_cio.mbtiles" \
    "$MAXZOOM" &
fi

while IFS=$'\t' read -r rid zip layer; do
  [[ -z "${rid:-}" || "${rid:0:1}" == "#" ]] && continue
  run_benthic_region "$zip" "$layer" "benthic_${rid}.mbtiles"
done < "$MANIFEST"

wait
echo "Benthic MBTiles finished (skipped zips without benthic layer). maxzoom=$MAXZOOM -> $OUT"
