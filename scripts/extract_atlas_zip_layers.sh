#!/usr/bin/env bash
# Extracts benthic.gpkg or reefextent.gpkg from Allen Coral Atlas regional ZIP archives.
# Pass multiple ZIP paths; each archive is processed in parallel (background jobs within one run).
#
# Examples:
#   ./scripts/extract_atlas_zip_layers.sh --benthic --out ~/MapData/out \
#     /path/a.zip /path/b.zip
#
#   ./scripts/extract_atlas_zip_layers.sh --reef-extent --out ~/MapData/out \
#     /path/a.zip
#
#   Run the whole invocation under nohup (PID on stdout, log file):
#   ./scripts/extract_atlas_zip_layers.sh --detach --log ~/MapData/extract-master.log \
#     --reef-extent --out ~/MapData/out /path/*.zip
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_OUT="$(cd "$SCRIPT_DIR/../.." && pwd)/MapData/Extracted_layers"

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \?//'
}

KIND=""
OUT_BASE=""
MASTER_LOG=""
DETACH=0
ZIPFILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --benthic)
      KIND=benthic
      shift
      ;;
    --reef-extent|--reef|--reef_extent)
      KIND=reef
      shift
      ;;
    --out)
      OUT_BASE="${2:-}"
      shift 2
      ;;
    --log|--master-log)
      MASTER_LOG="${2:-}"
      shift 2
      ;;
    --detach)
      DETACH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ZIPFILES+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$KIND" ]]; then
  echo "Specify --benthic or --reef-extent" >&2
  usage >&2
  exit 1
fi

if [[ ${#ZIPFILES[@]} -eq 0 ]]; then
  echo "No ZIP files passed (append paths at the end of the command)" >&2
  exit 1
fi

if [[ -z "$OUT_BASE" ]]; then
  OUT_BASE="$DEFAULT_OUT"
fi

if [[ "$KIND" == benthic ]]; then
  MEMBER="Benthic-Map/benthic.gpkg"
else
  MEMBER="Reef-Extent/reefextent.gpkg"
fi

if [[ "$DETACH" -eq 1 ]]; then
  if [[ -z "$MASTER_LOG" ]]; then
    mkdir -p "$OUT_BASE"
    MASTER_LOG="$OUT_BASE/extract-atlas-$(date +%Y%m%d%H%M%S).log"
  fi
  mkdir -p "$(dirname "$MASTER_LOG")"
  if [[ "$KIND" == benthic ]]; then
    _pass=(--benthic)
  else
    _pass=(--reef-extent)
  fi
  # shellcheck disable=SC2068
  nohup bash "$0" "${_pass[@]}" --out "$OUT_BASE" ${ZIPFILES[@]+"${ZIPFILES[@]}"} \
    >>"$MASTER_LOG" 2>&1 &
  echo "Background PID $!, log: $MASTER_LOG"
  exit 0
fi

mkdir -p "$OUT_BASE"

extract_one_zip() {
  local zip_path="$1"
  local stem
  stem="$(basename "$zip_path" .zip)"
  stem="${stem//[^A-Za-z0-9._-]/_}"
  local dest="$OUT_BASE/$stem"
  local job_log="$OUT_BASE/$stem.extract.log"

  if [[ ! -f "$zip_path" ]]; then
    mkdir -p "$OUT_BASE"
    echo "[FAIL] file not found: $zip_path" >>"$job_log"
    return 1
  fi

  {
    echo "=== $(date -Is) start $zip_path -> $dest ($MEMBER)"
    mkdir -p "$dest"
    python3 - "$zip_path" "$MEMBER" "$dest" <<'PY'
import sys, zipfile
zpath, member, dest_root = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(zpath) as zf:
    names = zf.namelist()
    if member not in names:
        print("ERROR: archive has no member", repr(member), file=sys.stderr)
        print("present:", *names[:15], "..." if len(names) > 15 else "", file=sys.stderr)
        sys.exit(2)
    zf.extract(member, dest_root)
print("OK:", dest_root + "/" + member)
PY
    echo "=== $(date -Is) done $stem"
  } >>"$job_log" 2>&1
}

pids=()
for z in "${ZIPFILES[@]}"; do
  extract_one_zip "$z" &
  pids+=("$!")
done

fail=0
for p in "${pids[@]}"; do
  if ! wait "$p"; then
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "One or more jobs failed; see $OUT_BASE/*.extract.log" >&2
  exit 1
fi

echo "Done. Output: $OUT_BASE (per-zip logs: *.extract.log)"
