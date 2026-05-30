"""Bleaching survey data helpers for CoralFuture chat tools."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from django.conf import settings

SEVERITY_LABELS = {
    -1: 'Unknown',
    0: 'No bleaching',
    1: 'Mild (1–10%)',
    2: 'Moderate (11–50%)',
    3: 'Severe (>50%)',
}

# Colony country labels that are regions, not BleachingDataBase COUNTRY values.
REGION_BLEACHING_COUNTRIES = {
    'persian arabian gulf': [
        'Bahrain', 'United Arab Emirates', 'Oman', 'Iran', 'Kuwait', 'Saudi Arabia', 'Qatar',
    ],
    'persian gulf': [
        'Bahrain', 'United Arab Emirates', 'Oman', 'Iran', 'Kuwait', 'Saudi Arabia', 'Qatar',
    ],
    'arabian gulf': [
        'Bahrain', 'United Arab Emirates', 'Oman', 'Iran', 'Kuwait', 'Saudi Arabia', 'Qatar',
    ],
    'gulf': [
        'Bahrain', 'United Arab Emirates', 'Oman', 'Iran', 'Kuwait', 'Saudi Arabia', 'Qatar',
    ],
    'red sea': [
        'Egypt', 'Sudan', 'Saudi Arabia', 'Jordan', 'Israel', 'Yemen', 'Djibouti', 'Eritrea',
    ],
}

_CACHE: dict = {
    'obs_path': None,
    'obs_mtime': None,
    'features': None,
    'years_path': None,
    'years_mtime': None,
    'years': None,
}


def _observations_path() -> Path | None:
    path = getattr(settings, 'BLEACHING_OBSERVATIONS_GEOJSON_PATH', '') or ''
    if not path:
        return None
    resolved = Path(path)
    return resolved if resolved.is_file() else None


def _years_path() -> Path | None:
    path = getattr(settings, 'BLEACHING_YEARS_JSON_PATH', '') or ''
    if not path:
        return None
    resolved = Path(path)
    return resolved if resolved.is_file() else None


def load_bleaching_features():
    """Load observation point features with simple mtime-based cache."""
    path = _observations_path()
    if path is None:
        return []

    mtime = path.stat().st_mtime
    if _CACHE['obs_path'] == str(path) and _CACHE['obs_mtime'] == mtime and _CACHE['features'] is not None:
        return _CACHE['features']

    with path.open(encoding='utf-8') as handle:
        payload = json.load(handle)
    features = payload.get('features') if isinstance(payload, dict) else []
    if not isinstance(features, list):
        features = []

    _CACHE['obs_path'] = str(path)
    _CACHE['obs_mtime'] = mtime
    _CACHE['features'] = features
    return features


def load_bleaching_years():
    path = _years_path()
    if path is None:
        return []

    mtime = path.stat().st_mtime
    if _CACHE['years_path'] == str(path) and _CACHE['years_mtime'] == mtime and _CACHE['years'] is not None:
        return _CACHE['years']

    with path.open(encoding='utf-8') as handle:
        payload = json.load(handle)
    years = payload.get('years') if isinstance(payload, dict) else []
    if not isinstance(years, list):
        years = []

    _CACHE['years_path'] = str(path)
    _CACHE['years_mtime'] = mtime
    _CACHE['years'] = years
    return years


def resolve_bleaching_country_names(project_countries):
    """Map project colony country labels to BleachingDataBase COUNTRY names."""
    resolved = []
    seen = set()
    for raw in project_countries or []:
        label = (raw or '').strip()
        if not label:
            continue
        key = label.lower()
        if key in REGION_BLEACHING_COUNTRIES:
            for name in REGION_BLEACHING_COUNTRIES[key]:
                lk = name.lower()
                if lk not in seen:
                    seen.add(lk)
                    resolved.append(name)
        else:
            if key not in seen:
                seen.add(key)
                resolved.append(label)
    return resolved


def _observation_key(obs):
    return (
        obs['year'],
        round(obs['lng'], 4),
        round(obs['lat'], 4),
        (obs.get('site') or '')[:40],
    )


def merge_observation_lists(*lists):
    merged = []
    seen = set()
    for observations in lists:
        for obs in observations or []:
            key = _observation_key(obs)
            if key in seen:
                continue
            seen.add(key)
            merged.append(obs)
    return merged


def filter_observations_by_countries(country_names, features=None):
    """Match BleachingDataBase COUNTRY (exact or substring, case-insensitive)."""
    names = [n.strip().lower() for n in (country_names or []) if n and str(n).strip()]
    if not names:
        return []

    features = features if features is not None else load_bleaching_features()
    matched = []
    for feature in features:
        props = feature.get('properties') or {}
        obs_country = (props.get('COUNTRY') or props.get('country') or '').strip()
        if not obs_country:
            continue
        oc_lower = obs_country.lower()
        if not any(n == oc_lower or n in oc_lower or oc_lower in n for n in names):
            continue
        year = _parse_year(props)
        if year is None:
            continue
        coords = (feature.get('geometry') or {}).get('coordinates') or []
        try:
            lng = float(coords[0]) if len(coords) > 1 else 0.0
            lat = float(coords[1]) if len(coords) > 1 else 0.0
        except (TypeError, ValueError):
            lng, lat = 0.0, 0.0
        matched.append({
            'year': year,
            'severity': _parse_severity(props),
            'country': obs_country,
            'site': (props.get('SITE_NAME') or props.get('LOCATION') or '').strip(),
            'lng': lng,
            'lat': lat,
        })
    return matched


def collect_bleaching_near_colonies(geolocated_colonies, project_countries=None, padding_deg=0.5):
    """
    Union of bbox filter + country/region filter for bleaching surveys near a project.
    """
    features = load_bleaching_features()
    if not features:
        return {
            'boundingBox': None,
            'byBoundingBox': [],
            'byCountries': [],
            'combined': [],
            'resolvedCountries': [],
        }

    bounds = get_colonies_bounds(geolocated_colonies, padding_deg=padding_deg)
    by_bbox = filter_observations_in_bounds(bounds, features) if bounds else []

    countries = resolve_bleaching_country_names(project_countries or [])
    by_countries = filter_observations_by_countries(countries, features) if countries else []

    combined = merge_observation_lists(by_bbox, by_countries)
    return {
        'boundingBox': bounds,
        'byBoundingBox': by_bbox,
        'byCountries': by_countries,
        'combined': combined,
        'resolvedCountries': countries,
        'boundingBoxCount': len(by_bbox),
        'countryFilterCount': len(by_countries),
    }


def get_colonies_bounds(colonies, padding_deg=0.25):
    points = [
        c for c in colonies
        if c.latitude is not None and c.longitude is not None
    ]
    if not points:
        return None

    min_lng = min(c.longitude for c in points)
    max_lng = max(c.longitude for c in points)
    min_lat = min(c.latitude for c in points)
    max_lat = max(c.latitude for c in points)

    lng_span = max_lng - min_lng
    lat_span = max_lat - min_lat
    pad = max(padding_deg, max(lng_span, lat_span) * 0.5, 0.75)

    return {
        'minLng': min_lng - pad,
        'maxLng': max_lng + pad,
        'minLat': min_lat - pad,
        'maxLat': max_lat + pad,
    }


def _point_in_bounds(lng, lat, bounds):
    return (
        bounds['minLng'] <= lng <= bounds['maxLng']
        and bounds['minLat'] <= lat <= bounds['maxLat']
    )


def _parse_severity(props):
    raw = props.get('severity')
    if raw is None:
        raw = props.get('SEVERITY_CODE')
    try:
        if raw is None or str(raw).strip() in ('', 'NA', '-999'):
            return None
        return int(float(raw))
    except (TypeError, ValueError):
        return None


def _parse_year(props):
    raw = props.get('year')
    if raw is None:
        raw = props.get('YEAR')
    try:
        if raw is None or str(raw).strip() in ('', 'NA'):
            return None
        return int(float(raw))
    except (TypeError, ValueError):
        return None


def filter_observations_in_bounds(bounds, features=None):
    if bounds is None:
        return []
    features = features if features is not None else load_bleaching_features()
    matched = []
    for feature in features:
        coords = (feature.get('geometry') or {}).get('coordinates')
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        try:
            lng, lat = float(coords[0]), float(coords[1])
        except (TypeError, ValueError):
            continue
        if not _point_in_bounds(lng, lat, bounds):
            continue
        props = feature.get('properties') or {}
        year = _parse_year(props)
        if year is None:
            continue
        severity = _parse_severity(props)
        matched.append({
            'year': year,
            'severity': severity,
            'country': (props.get('COUNTRY') or props.get('country') or '').strip(),
            'site': (props.get('SITE_NAME') or props.get('LOCATION') or '').strip(),
            'lng': lng,
            'lat': lat,
        })
    return matched


def aggregate_bleaching_observations(observations):
    if not observations:
        return {
            'totalObservations': 0,
            'yearsWithData': 0,
            'yearRange': None,
            'byYear': [],
            'severityTotals': {},
            'countriesInBleachingData': [],
        }

    by_year = defaultdict(lambda: {'count': 0, 'severity': Counter()})
    severity_totals = Counter()
    countries = Counter()

    for obs in observations:
        year = obs['year']
        by_year[year]['count'] += 1
        countries[obs['country'] or 'Unknown'] += 1
        sev = obs['severity']
        if sev is not None:
            by_year[year]['severity'][sev] += 1
            severity_totals[sev] += 1

    year_rows = []
    for year in sorted(by_year):
        sev_counter = by_year[year]['severity']
        year_rows.append({
            'year': year,
            'count': by_year[year]['count'],
            'severityBreakdown': {
                SEVERITY_LABELS.get(code, str(code)): sev_counter[code]
                for code in sorted(sev_counter)
            },
        })

    years = [row['year'] for row in year_rows]
    return {
        'totalObservations': len(observations),
        'yearsWithData': len(year_rows),
        'yearRange': [years[0], years[-1]] if years else None,
        'byYear': year_rows,
        'severityTotals': {
            SEVERITY_LABELS.get(code, str(code)): severity_totals[code]
            for code in sorted(severity_totals)
        },
        'countriesInBleachingData': [
            {'country': country, 'count': count}
            for country, count in countries.most_common(8)
        ],
    }


def global_bleaching_overview():
    features = load_bleaching_features()
    years_meta = load_bleaching_years()
    observations = []
    for feature in features:
        props = feature.get('properties') or {}
        year = _parse_year(props)
        if year is None:
            continue
        observations.append({
            'year': year,
            'severity': _parse_severity(props),
            'country': (props.get('COUNTRY') or '').strip(),
            'site': '',
            'lng': 0,
            'lat': 0,
        })
    summary = aggregate_bleaching_observations(observations)
    summary['availableYears'] = years_meta or [row['year'] for row in summary['byYear']]
    summary['dataSource'] = 'BleachingDataBase.csv (ReefBase / Allen Coral Atlas severity codes)'
    return summary


def regional_bleaching_summary(country='', min_lat=None, max_lat=None, min_lng=None, max_lng=None):
    bounds = None
    if all(v is not None for v in (min_lat, max_lat, min_lng, max_lng)):
        bounds = {
            'minLat': float(min_lat),
            'maxLat': float(max_lat),
            'minLng': float(min_lng),
            'maxLng': float(max_lng),
        }

    features = load_bleaching_features()
    if bounds is None and country:
        country_lower = country.strip().lower()
        observations = []
        for feature in features:
            props = feature.get('properties') or {}
            obs_country = (props.get('COUNTRY') or props.get('country') or '').strip()
            if obs_country.lower() != country_lower:
                continue
            year = _parse_year(props)
            if year is None:
                continue
            coords = (feature.get('geometry') or {}).get('coordinates') or []
            observations.append({
                'year': year,
                'severity': _parse_severity(props),
                'country': obs_country,
                'site': (props.get('SITE_NAME') or '').strip(),
                'lng': float(coords[0]) if len(coords) > 1 else 0,
                'lat': float(coords[1]) if len(coords) > 1 else 0,
            })
    else:
        if bounds is None:
            return {'error': 'Provide country or a bounding box (min_lat, max_lat, min_lng, max_lng).'}
        observations = filter_observations_in_bounds(bounds, features)

    summary = aggregate_bleaching_observations(observations)
    summary['filter'] = {'country': country or None, 'bounds': bounds}
    return summary
