/**
 * Compute map center and zoom from colony coordinates for deep-linking to /map.
 */
export function getColoniesMapView(colonies) {
  const points = (Array.isArray(colonies) ? colonies : []).filter(
    (c) => Number.isFinite(c?.longitude) && Number.isFinite(c?.latitude),
  );
  if (!points.length) return null;

  if (points.length === 1) {
    return {
      lng: points[0].longitude,
      lat: points[0].latitude,
      zoom: 12,
    };
  }

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

  const lng = (minLng + maxLng) / 2;
  const lat = (minLat + maxLat) / 2;
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const span = Math.max(lngSpan, latSpan);
  const zoom = Math.min(14, Math.max(4, Math.round(Math.log2(360 / span) - 1)));

  return { lng, lat, zoom };
}

export function buildGlobalMapLink({ colonies, projectName, bleachingYear }) {
  const view = getColoniesMapView(colonies);
  if (!view) return '/map';

  const params = new URLSearchParams({
    lng: String(Number(view.lng.toFixed(6))),
    lat: String(Number(view.lat.toFixed(6))),
    zoom: String(view.zoom),
  });

  if (projectName) {
    params.set('project', projectName);
  }

  if (Number.isFinite(bleachingYear)) {
    params.set('bleachingYear', String(bleachingYear));
  }

  return `/map?${params.toString()}`;
}
