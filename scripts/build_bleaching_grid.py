#!/usr/bin/env python3
"""
Build 1 km grid polygons + observation points from BleachingDataBase.csv for MBTiles / map layers.

Grid cells use Web Mercator (EPSG:3857) 1000 m squares. Severity per (cell, year) is the
maximum valid code (1–3); if only -1 exists, cell severity is -1.
"""
from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

CELL_SIZE_M = 1000
ORIGIN_SHIFT = 20037508.342789244

SEVERITY_LABELS = {
    -1: "Unknown",
    0: "No bleaching",
    1: "Mild (1–10%)",
    2: "Moderate (11–50%)",
    3: "Severe (>50%)",
}


def lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = lon * ORIGIN_SHIFT / 180.0
    y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    y = y * ORIGIN_SHIFT / 180.0
    return x, y


def mercator_to_lonlat(x: float, y: float) -> tuple[float, float]:
    lon = (x / ORIGIN_SHIFT) * 180.0
    lat = (y / ORIGIN_SHIFT) * 180.0
    lat = 180.0 / math.pi * (2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
    return lon, lat


def cell_key(lon: float, lat: float) -> tuple[int, int]:
    x, y = lonlat_to_mercator(lon, lat)
    return int(math.floor(x / CELL_SIZE_M)), int(math.floor(y / CELL_SIZE_M))


def cell_polygon_wgs84(cx: int, cy: int) -> list[list[float]]:
    x0 = cx * CELL_SIZE_M
    y0 = cy * CELL_SIZE_M
    x1 = x0 + CELL_SIZE_M
    y1 = y0 + CELL_SIZE_M
    ring = []
    for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)):
        lon, lat = mercator_to_lonlat(x, y)
        ring.append([lon, lat])
    return ring


def parse_severity(raw: str) -> int | None:
    raw = (raw or "").strip()
    if not raw or raw.upper() == "NA":
        return None
    try:
        return int(float(raw))
    except ValueError:
        return None


def parse_year(raw: str) -> int | None:
    raw = (raw or "").strip()
    if not raw or raw.upper() == "NA":
        return None
    try:
        return int(float(raw))
    except ValueError:
        return None


def aggregate_severity(codes: list[int]) -> int | None:
    valid = [c for c in codes if c is not None and c >= 1]
    if valid:
        return max(valid)
    if any(c == -1 for c in codes if c is not None):
        return -1
    if any(c == 0 for c in codes if c is not None):
        return 0
    return None


def load_rows(csv_path: Path) -> list[dict]:
    rows = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            lat = (row.get("LATITUDE") or "").strip()
            lon = (row.get("LONGITUDE") or "").strip()
            if not lat or not lon or lat.upper() == "NA" or lon.upper() == "NA":
                continue
            try:
                la, lo = float(lat), float(lon)
            except ValueError:
                continue
            year = parse_year(row.get("YEAR", ""))
            if year is None:
                continue
            severity = parse_severity(row.get("SEVERITY_CODE", ""))
            rows.append(
                {
                    "lat": la,
                    "lon": lo,
                    "year": year,
                    "severity": severity,
                    "props": {k: (v or "").strip() for k, v in row.items()},
                }
            )
    return rows


def build_grid_features(rows: list[dict]) -> list[dict]:
    buckets: dict[tuple[int, int, int], list[int]] = defaultdict(list)
    meta: dict[tuple[int, int, int], dict] = {}

    for r in rows:
        cx, cy = cell_key(r["lon"], r["lat"])
        key = (cx, cy, r["year"])
        if r["severity"] is not None:
            buckets[key].append(r["severity"])
        if key not in meta:
            meta[key] = {"n_obs": 0, "countries": set()}
        meta[key]["n_obs"] += 1
        country = r["props"].get("COUNTRY", "")
        if country:
            meta[key]["countries"].add(country)

    features = []
    for (cx, cy, year), codes in buckets.items():
        severity = aggregate_severity(codes)
        if severity is None:
            continue
        m = meta[(cx, cy, year)]
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [cell_polygon_wgs84(cx, cy)]},
                "properties": {
                    "year": year,
                    "severity": severity,
                    "severity_label": SEVERITY_LABELS.get(severity, str(severity)),
                    "n_obs": m["n_obs"],
                    "countries": ", ".join(sorted(m["countries"])[:5]),
                },
            }
        )
    return features


def build_observation_features(rows: list[dict]) -> list[dict]:
    features = []
    for i, r in enumerate(rows):
        sev = r["severity"]
        props = dict(r["props"])
        props["year"] = r["year"]
        props["severity"] = sev if sev is not None else -999
        props["severity_label"] = SEVERITY_LABELS.get(sev, "") if sev is not None else ""
        props["obs_id"] = i
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
                "properties": props,
            }
        )
    return features


def main() -> int:
    root = Path("/home/coralfuture-server")
    csv_path = root / "MapData/BleachingData/BleachingDataBase.csv"
    out_dir = root / "MapData/bleaching"
    if len(sys.argv) > 1:
        csv_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        out_dir = Path(sys.argv[2])

    if not csv_path.is_file():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    rows = load_rows(csv_path)
    grid_fc = {"type": "FeatureCollection", "features": build_grid_features(rows)}
    obs_fc = {"type": "FeatureCollection", "features": build_observation_features(rows)}

    grid_path = out_dir / "bleaching_grid.geojson"
    obs_path = out_dir / "bleaching_observations.geojson"
    years_path = out_dir / "bleaching_years.json"

    years = sorted({r["year"] for r in rows})

    grid_path.write_text(json.dumps(grid_fc), encoding="utf-8")
    obs_path.write_text(json.dumps(obs_fc), encoding="utf-8")
    years_path.write_text(json.dumps({"years": years, "min": years[0], "max": years[-1]}), encoding="utf-8")

    print(f"Observations: {len(rows)} -> {obs_path}")
    print(f"Grid cells: {len(grid_fc['features'])} -> {grid_path}")
    print(f"Years: {years[0]}–{years[-1]} ({len(years)} years)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
