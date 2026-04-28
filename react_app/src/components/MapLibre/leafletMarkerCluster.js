import leafletMarkerIconUrl from 'leaflet/dist/images/marker-icon.png';
import leafletMarkerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

export const COLONIES_SOURCE = 'colonies';
export const CLUSTERS_OUTER_LAYER = 'colonies-clusters-outer';
export const CLUSTERS_LAYER = 'colonies-clusters';
export const CLUSTER_COUNT_LAYER = 'colonies-cluster-count';
export const UNCLUSTERED_MARKERS_LAYER = 'colonies-unclustered';
export const UNCLUSTERED_SHADOWS_LAYER = 'colonies-unclustered-shadows';
export const SPIDER_POINTS_SOURCE = 'colonies-spider-points';
export const SPIDER_LEGS_SOURCE = 'colonies-spider-legs';
export const SPIDER_POINTS_LAYER = 'colonies-spider-points';
export const SPIDER_SHADOWS_LAYER = 'colonies-spider-shadows';
export const SPIDER_LEGS_LAYER = 'colonies-spider-legs';

const LEAFLET_MARKER_ICON = 'leaflet-marker-icon';
const LEAFLET_MARKER_SHADOW = 'leaflet-marker-shadow';
const COLONIES_CLUSTER_MAX_ZOOM = 20;
const COLONIES_CLUSTER_RADIUS = 80;
const LEAFLET_ANIMATION_DURATION_MS = 300;

const TWO_PI = Math.PI * 2;
const CIRCLE_FOOT_SEPARATION = 25;
const CIRCLE_START_ANGLE = 0;
const SPIRAL_FOOT_SEPARATION = 28;
const SPIRAL_LENGTH_START = 11;
const SPIRAL_LENGTH_FACTOR = 5;
const CIRCLE_SPIRAL_SWITCHOVER = 9;
const SPIDERFY_DISTANCE_MULTIPLIER = 1;

const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

export const coloniesToGeoJson = (colonies = []) => ({
  type: 'FeatureCollection',
  features: (Array.isArray(colonies) ? colonies : [])
    .filter((c) => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude))
    .map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
      properties: {
        id: c.id,
        name: c.name,
      },
    })),
});

export const addLeafletClusterSourcesAndLayers = (sources, layers) => {
  sources[COLONIES_SOURCE] = {
    type: 'geojson',
    data: coloniesToGeoJson([]),
    cluster: true,
    clusterMaxZoom: COLONIES_CLUSTER_MAX_ZOOM,
    clusterRadius: COLONIES_CLUSTER_RADIUS,
    maxzoom: COLONIES_CLUSTER_MAX_ZOOM + 1,
  };
  sources[SPIDER_POINTS_SOURCE] = { type: 'geojson', data: emptyFC() };
  sources[SPIDER_LEGS_SOURCE] = { type: 'geojson', data: emptyFC() };

  layers.push(
    {
      id: CLUSTERS_OUTER_LAYER,
      type: 'circle',
      source: COLONIES_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          'rgba(181, 226, 140, 0.6)',
          100,
          'rgba(241, 211, 87, 0.6)',
          1000,
          'rgba(253, 156, 115, 0.6)',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 20, 100, 22, 1000, 24],
      },
    },
    {
      id: CLUSTERS_LAYER,
      type: 'circle',
      source: COLONIES_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          'rgba(110, 204, 57, 0.6)',
          100,
          'rgba(240, 194, 12, 0.6)',
          1000,
          'rgba(241, 128, 23, 0.6)',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 15, 100, 17, 1000, 19],
      },
    },
    {
      id: CLUSTER_COUNT_LAYER,
      type: 'symbol',
      source: COLONIES_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#111827',
      },
    },
    {
      id: UNCLUSTERED_SHADOWS_LAYER,
      type: 'symbol',
      source: COLONIES_SOURCE,
      filter: ['!', ['has', 'point_count']],
      layout: leafletShadowLayout(),
    },
    {
      id: UNCLUSTERED_MARKERS_LAYER,
      type: 'symbol',
      source: COLONIES_SOURCE,
      filter: ['!', ['has', 'point_count']],
      layout: leafletMarkerLayout(),
    },
    {
      id: SPIDER_LEGS_LAYER,
      type: 'line',
      source: SPIDER_LEGS_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#222222',
        'line-opacity': 0.5,
        'line-width': 1.5,
      },
    },
    {
      id: SPIDER_SHADOWS_LAYER,
      type: 'symbol',
      source: SPIDER_POINTS_SOURCE,
      layout: {
        ...leafletShadowLayout(),
        visibility: 'none',
      },
    },
    {
      id: SPIDER_POINTS_LAYER,
      type: 'symbol',
      source: SPIDER_POINTS_SOURCE,
      layout: {
        ...leafletMarkerLayout(),
        visibility: 'none',
      },
    },
  );
};

const leafletMarkerLayout = () => ({
  'icon-image': LEAFLET_MARKER_ICON,
  'icon-size': 1,
  'icon-offset': [0, -20.5],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
});

const leafletShadowLayout = () => ({
  'icon-image': LEAFLET_MARKER_SHADOW,
  'icon-size': 1,
  'icon-offset': [8.5, -20.5],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
});

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

export const ensureLeafletMarkerImages = async (map) => {
  const loadAndAdd = async (id, src) => {
    if (map.hasImage(id)) return;
    const image = await loadImageElement(src);
    if (!map.hasImage(id)) map.addImage(id, image);
  };

  await Promise.all([
    loadAndAdd(LEAFLET_MARKER_ICON, leafletMarkerIconUrl),
    loadAndAdd(LEAFLET_MARKER_SHADOW, leafletMarkerShadowUrl),
  ]);
};

const getClusterExpansionZoom = async (source, clusterId) => {
  if (!source?.getClusterExpansionZoom) return null;
  const result = source.getClusterExpansionZoom(clusterId);
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve, reject) => {
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) reject(err);
      else resolve(zoom);
    });
  });
};

const getClusterLeaves = async (source, clusterId, limit = 255, offset = 0) => {
  if (!source?.getClusterLeaves) return [];
  const result = source.getClusterLeaves(clusterId, limit, offset);
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve, reject) => {
    source.getClusterLeaves(clusterId, limit, offset, (err, leaves) => {
      if (err) reject(err);
      else resolve(leaves || []);
    });
  });
};

const generateLeafletCirclePoints = (count, centerPt) => {
  const circumference = SPIDERFY_DISTANCE_MULTIPLIER * CIRCLE_FOOT_SEPARATION * (2 + count);
  const legLength = Math.max(circumference / TWO_PI, 35);
  const angleStep = TWO_PI / count;
  const result = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = CIRCLE_START_ANGLE + i * angleStep;
    result[i] = {
      x: Math.round(centerPt.x + legLength * Math.cos(angle)),
      y: Math.round(centerPt.y + legLength * Math.sin(angle)),
    };
  }
  return result;
};

const generateLeafletSpiralPoints = (count, centerPt) => {
  let legLength = SPIDERFY_DISTANCE_MULTIPLIER * SPIRAL_LENGTH_START;
  const separation = SPIDERFY_DISTANCE_MULTIPLIER * SPIRAL_FOOT_SEPARATION;
  const lengthFactor = SPIDERFY_DISTANCE_MULTIPLIER * SPIRAL_LENGTH_FACTOR * TWO_PI;
  let angle = 0;
  const result = new Array(count);

  for (let i = count; i >= 0; i -= 1) {
    if (i < count) {
      result[i] = {
        x: Math.round(centerPt.x + legLength * Math.cos(angle)),
        y: Math.round(centerPt.y + legLength * Math.sin(angle)),
      };
    }
    angle += separation / legLength + i * 0.0005;
    legLength += lengthFactor / angle;
  }
  return result;
};

const easeOut = (t) => 1 - ((1 - t) ** 3);

const buildLeafletSpider = (map, centerLngLat, leafFeatures, progress = 1) => {
  const count = leafFeatures.length;
  const centerPt = map.project({ lng: centerLngLat[0], lat: centerLngLat[1] });
  const targetPoints = count >= CIRCLE_SPIRAL_SWITCHOVER
    ? generateLeafletSpiralPoints(count, centerPt)
    : generateLeafletCirclePoints(count, { x: centerPt.x, y: centerPt.y + 10 });

  const points = [];
  const legs = [];

  for (let i = 0; i < count; i += 1) {
    const target = targetPoints[i];
    const current = {
      x: centerPt.x + ((target.x - centerPt.x) * progress),
      y: centerPt.y + ((target.y - centerPt.y) * progress),
    };
    const lngLat = map.unproject(current);
    const coordinates = [lngLat.lng, lngLat.lat];
    const feature = leafFeatures[i];

    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates },
      properties: { ...(feature.properties || {}) },
    });
    legs.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [centerLngLat, coordinates] },
      properties: {},
    });
  }

  return {
    points: { type: 'FeatureCollection', features: points },
    legs: { type: 'FeatureCollection', features: legs },
  };
};

export const createLeafletClusterController = ({
  map,
  getColonies,
  openPopup,
}) => {
  let spiderState = null;
  let animationFrame = null;
  const handlers = [];

  const source = (id) => map.getSource(id);

  const setSpiderVisibility = (visibility) => {
    [SPIDER_POINTS_LAYER, SPIDER_SHADOWS_LAYER, SPIDER_LEGS_LAYER].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  };

  const renderSpider = (progress = 1) => {
    if (!spiderState) return;
    const { center, leaves } = spiderState;
    const { points, legs } = buildLeafletSpider(map, center, leaves, progress);
    const pointsSource = source(SPIDER_POINTS_SOURCE);
    const legsSource = source(SPIDER_LEGS_SOURCE);
    if (pointsSource?.setData) pointsSource.setData(points);
    if (legsSource?.setData) legsSource.setData(legs);
    setSpiderVisibility('visible');
  };

  const clearSpider = () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    spiderState = null;
    source(SPIDER_POINTS_SOURCE)?.setData?.(emptyFC());
    source(SPIDER_LEGS_SOURCE)?.setData?.(emptyFC());
    setSpiderVisibility('none');
  };

  const animateSpider = () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    const start = performance.now();
    const step = (now) => {
      const rawProgress = Math.min((now - start) / LEAFLET_ANIMATION_DURATION_MS, 1);
      renderSpider(easeOut(rawProgress));
      if (rawProgress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        animationFrame = null;
      }
    };
    renderSpider(0);
    animationFrame = window.requestAnimationFrame(step);
  };

  const colonyByFeature = (feature) => {
    const id = Number(feature?.properties?.id);
    return (Array.isArray(getColonies()) ? getColonies() : []).find((colony) => colony.id === id);
  };

  const spiderfyCluster = async (feature) => {
    const clusterId = Number(feature?.properties?.cluster_id);
    if (!Number.isFinite(clusterId)) return;
    const coloniesSource = source(COLONIES_SOURCE);
    if (!coloniesSource?.getClusterLeaves) return;

    try {
      const leaves = await getClusterLeaves(coloniesSource, clusterId, 255, 0);
      if (!leaves?.length) return;
      spiderState = { center: feature.geometry.coordinates, leaves };
      animateSpider();
    } catch (_) {
      // ignore
    }
  };

  const handleClusterClick = async (feature) => {
    const clusterId = Number(feature?.properties?.cluster_id);
    if (!Number.isFinite(clusterId)) return;
    const coloniesSource = source(COLONIES_SOURCE);
    if (!coloniesSource?.getClusterExpansionZoom) return;

    try {
      const expansionZoom = await getClusterExpansionZoom(coloniesSource, clusterId);
      const targetZoom = Number(expansionZoom);
      const currentZoom = map.getZoom();
      const maxZoom = map.getMaxZoom();
      const center = feature.geometry.coordinates;

      if (
        Number.isFinite(targetZoom) &&
        targetZoom > currentZoom &&
        targetZoom <= maxZoom &&
        targetZoom <= COLONIES_CLUSTER_MAX_ZOOM
      ) {
        clearSpider();
        map.easeTo({ center, zoom: targetZoom, duration: 300 });
        return;
      }
      spiderfyCluster(feature);
    } catch (_) {
      // ignore
    }
  };

  const on = (eventName, layerOrHandler, maybeHandler) => {
    if (maybeHandler) {
      map.on(eventName, layerOrHandler, maybeHandler);
      handlers.push([eventName, layerOrHandler, maybeHandler]);
    } else {
      map.on(eventName, layerOrHandler);
      handlers.push([eventName, layerOrHandler]);
    }
  };

  const unregisterInteractions = () => {
    while (handlers.length) {
      const [eventName, layerOrHandler, maybeHandler] = handlers.pop();
      try {
        if (maybeHandler) map.off(eventName, layerOrHandler, maybeHandler);
        else map.off(eventName, layerOrHandler);
      } catch (_) {
        // Style reloads can remove layer ids before their handlers are detached.
      }
    }
  };

  const registerInteractions = () => {
    unregisterInteractions();

    on('click', (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [SPIDER_POINTS_LAYER, UNCLUSTERED_MARKERS_LAYER, CLUSTERS_LAYER, CLUSTERS_OUTER_LAYER],
      });
      if (!features?.length) clearSpider();
    });

    const onClusterClick = (event) => {
      const feature = event.features?.[0];
      if (feature) handleClusterClick(feature);
    };
    on('click', CLUSTERS_LAYER, onClusterClick);
    on('click', CLUSTERS_OUTER_LAYER, onClusterClick);

    const onMarkerClick = (event) => {
      const feature = event.features?.[0];
      const colony = colonyByFeature(feature);
      if (colony) openPopup(colony, feature.geometry.coordinates);
    };
    on('click', UNCLUSTERED_MARKERS_LAYER, onMarkerClick);
    on('click', SPIDER_POINTS_LAYER, onMarkerClick);

    [CLUSTERS_LAYER, CLUSTERS_OUTER_LAYER, UNCLUSTERED_MARKERS_LAYER, SPIDER_POINTS_LAYER].forEach((layerId) => {
      on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });
  };

  return {
    clearSpider,
    renderSpider,
    registerInteractions,
    unregisterInteractions,
    dispose: () => {
      unregisterInteractions();
      clearSpider();
    },
  };
};
