/** Bounding box around project colonies (degrees). */
export function getColoniesBounds(colonies, paddingDeg = 0.25) {
  const points = (Array.isArray(colonies) ? colonies : []).filter(
    (c) => Number.isFinite(c?.longitude) && Number.isFinite(c?.latitude),
  );
  if (!points.length) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const { longitude, latitude } of points) {
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
  }

  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;
  const pad = Math.max(paddingDeg, Math.max(lngSpan, latSpan) * 0.35);

  return {
    minLng: minLng - pad,
    maxLng: maxLng + pad,
    minLat: minLat - pad,
    maxLat: maxLat + pad,
  };
}

function pointInBounds(lng, lat, bounds) {
  return (
    lng >= bounds.minLng
    && lng <= bounds.maxLng
    && lat >= bounds.minLat
    && lat <= bounds.maxLat
  );
}

/**
 * Count bleaching observation points inside bounds, grouped by survey year.
 */
export function computeBleachingStatsByYear(geojson, bounds) {
  if (!geojson?.features?.length || !bounds) {
    return { total: 0, byYear: [], yearCount: 0 };
  }

  const counts = new Map();

  for (const feature of geojson.features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!pointInBounds(lng, lat, bounds)) continue;

    const props = feature.properties || {};
    const year = Number(props.YEAR ?? props.year);
    if (!Number.isFinite(year)) continue;

    counts.set(year, (counts.get(year) || 0) + 1);
  }

  const byYear = [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  const total = byYear.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    byYear,
    yearCount: byYear.length,
  };
}
