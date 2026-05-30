import React, { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAPS } from 'components/Tiles/basemaps';
import {
  BENTHIC_TILESETS,
  DEFAULT_BENTHIC_CLASS_COLORS,
} from 'components/Tiles/BenthicTileLayer';
import {
  REEF_EXTENT_TILESETS,
  DEFAULT_REEF_EXTENT_CLASS_COLORS,
} from 'components/Tiles/ReefExtentTileLayer';
import {
  buildBleachingSeverityColorExpression,
  buildBleachingYearFilter,
} from 'components/Bleaching/bleachingSeverity';
import ColonyPopupContent from 'components/ColonyPopup/ColonyPopupContent';
import {
  COLONIES_SOURCE,
  addLeafletClusterSourcesAndLayers,
  coloniesToGeoJson,
  createLeafletClusterController,
  ensureLeafletMarkerImages,
} from './leafletMarkerCluster';

const BENTHIC_SOURCE_LAYER = process.env.REACT_APP_BENTHIC_VECTOR_LAYER || 'benthic';
const BENTHIC_MIN_ZOOM = Number(process.env.REACT_APP_BENTHIC_MIN_ZOOM || 5);
const CAPTIONS_SOURCE = 'map-captions';
const CAPTIONS_LAYER = 'map-captions';
const DEFAULT_CAPTIONS_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const OCEAN_CAPTIONS_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}';

const toAbsoluteTileUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `${window.location.protocol}${url}`;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return `${window.location.origin}/${url}`;
};

const sourceIdFor = (tilesetId) => `benthic-${tilesetId}`;
const fillLayerIdFor = (tilesetId) => `benthic-${tilesetId}-fill`;
const lineLayerIdFor = (tilesetId) => `benthic-${tilesetId}-line`;

const reefSourceIdFor = (tilesetId) => `reef-extent-${tilesetId}`;
const reefFillLayerIdFor = (tilesetId) => `reef-extent-${tilesetId}-fill`;
const reefLineLayerIdFor = (tilesetId) => `reef-extent-${tilesetId}-line`;

const BLEACHING_SOURCE = 'bleaching-grid';
const BLEACHING_LAYER = 'bleaching-grid-fill';
const BLEACHING_OBS_SOURCE = 'bleaching-observations';
const BLEACHING_OBS_LAYER = 'bleaching-observations-circles';
const BLEACHING_SOURCE_LAYER = process.env.REACT_APP_BLEACHING_VECTOR_LAYER || 'bleaching';
const DEFAULT_BLEACHING_YEAR = 2005;

const captionsUrlFor = (basemap) => (basemap === 'ocean' ? OCEAN_CAPTIONS_URL : DEFAULT_CAPTIONS_URL);

const isBenthicTileError = (error) => {
  const url = error?.url || error?.message || '';
  return typeof url === 'string' && url.includes('/benthic-tiles/');
};

const isReefExtentTileError = (error) => {
  const url = error?.url || error?.message || '';
  return typeof url === 'string' && url.includes('/reef-extent-tiles/');
};

const isBleachingTileError = (error) => {
  const url = error?.url || error?.message || '';
  return typeof url === 'string' && url.includes('/bleaching-tiles/');
};

const buildColorMatchExpression = (classSettings = {}) => {
  const entries = Object.entries(DEFAULT_BENTHIC_CLASS_COLORS);
  const match = ['match', ['get', 'class']];
  for (const [className, defaultColor] of entries) {
    const c = classSettings[className]?.color || defaultColor;
    match.push(className, c);
  }
  match.push('#14b8a6');
  return match;
};

const buildVisibleClassFilter = (classSettings = {}) => {
  const visible = Object.entries(DEFAULT_BENTHIC_CLASS_COLORS)
    .filter(([className]) => classSettings[className]?.visible !== false)
    .map(([className]) => className);
  return ['in', ['get', 'class'], ['literal', visible]];
};

const buildReefExtentColorMatchExpression = (classSettings = {}) => {
  const entries = Object.entries(DEFAULT_REEF_EXTENT_CLASS_COLORS);
  const match = ['match', ['get', 'class']];
  for (const [className, defaultColor] of entries) {
    const c = classSettings[className]?.color || defaultColor;
    match.push(className, c);
  }
  match.push('#34d399');
  return match;
};

const buildVisibleReefExtentFilter = (classSettings = {}) => {
  const visible = Object.entries(DEFAULT_REEF_EXTENT_CLASS_COLORS)
    .filter(([className]) => classSettings[className]?.visible !== false)
    .map(([className]) => className);
  return ['in', ['get', 'class'], ['literal', visible]];
};

const REEF_EXTENT_SOURCE_LAYER =
  process.env.REACT_APP_REEF_EXTENT_VECTOR_LAYER || 'reef_extent';

const getMaplibreActiveTilesetIds = (map, tilesets) => {
  const getCenter = () => {
    const c = map.getCenter();
    return {
      lat: c.lat,
      lng: c.lng,
      distanceTo: (other) => {
        const R = 6371000;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(other.lat - c.lat);
        const dLng = toRad(other.lng - c.lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(c.lat)) * Math.cos(toRad(other.lat)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
      },
    };
  };

  const z = map.getZoom();
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const pad = 0.06;
  const swp = { lat: sw.lat - (ne.lat - sw.lat) * pad, lng: sw.lng - (ne.lng - sw.lng) * pad };
  const nep = { lat: ne.lat + (ne.lat - sw.lat) * pad, lng: ne.lng + (ne.lng - sw.lng) * pad };

  const hits = tilesets.filter((t) => t.bounds).filter((t) => {
    const [[s, w], [n, e]] = t.bounds;
    const intersects =
      e >= swp.lng && w <= nep.lng && n >= swp.lat && s <= nep.lat;
    return intersects;
  });

  if (hits.length === 0) return [];
  const strictZoom = Number(process.env.REACT_APP_BENTHIC_ZOOM_STRICT_REGION || 5);
  if (z < strictZoom && hits.length > 1) {
    const center = getCenter();
    const best = hits.reduce((acc, t) => {
      const [[s, w], [n, e]] = t.bounds;
      const c = { lat: (s + n) / 2, lng: (w + e) / 2 };
      const d = center.distanceTo(c);
      if (!acc || d < acc.d) return { id: t.id, d };
      return acc;
    }, null);
    return best ? [best.id] : [];
  }
  return hits.map((t) => t.id);
};

const getMaplibreActiveBenthicTilesetIds = (map) => getMaplibreActiveTilesetIds(map, BENTHIC_TILESETS);
const getMaplibreActiveReefExtentTilesetIds = (map) =>
  getMaplibreActiveTilesetIds(map, REEF_EXTENT_TILESETS);

export default function CustomerMapLibreMap({
  basemap = 'imagery',
  captionsVisible = true,
  benthicVisible = true,
  benthicClasses = {},
  reefExtentVisible = false,
  reefExtentClasses = {},
  bleachingVisible = false,
  bleachingYear = DEFAULT_BLEACHING_YEAR,
  bleachingObservationsGeoJson = null,
  onBleachingObservationClick,
  colonies = [],
  focusTarget = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const clusterControllerRef = useRef(null);
  const basemapRef = useRef(basemap);
  const captionsVisibleRef = useRef(captionsVisible);
  const bleachingVisibleRef = useRef(bleachingVisible);
  const onBleachingClickRef = useRef(onBleachingObservationClick);
  const bleachingObsRef = useRef(bleachingObservationsGeoJson);
  const focusHandledKeyRef = useRef(null);

  const style = useMemo(() => {
    const bm = BASEMAPS[basemap] || BASEMAPS.imagery;

    // MapLibre expects {x}/{y}/{z}; some of our providers use {s} and/or {r}.
    // Keep the existing URLs; MapLibre supports {x}/{y}/{z} but not {s}.
    // For providers with {s}, we replace with 'a' as a simple default.
    const rasterUrl = bm.url.replace('{s}', 'a').replace('{r}', '');

    const sources = {
      basemap: {
        type: 'raster',
        tiles: [rasterUrl],
        tileSize: 256,
      },
      [CAPTIONS_SOURCE]: {
        type: 'raster',
        tiles: [captionsUrlFor(basemap)],
        tileSize: 256,
      },
    };

    const layers = [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ];

    for (const t of REEF_EXTENT_TILESETS) {
      sources[reefSourceIdFor(t.id)] = {
        type: 'vector',
        tiles: [toAbsoluteTileUrl(t.url)],
        minzoom: BENTHIC_MIN_ZOOM,
        maxzoom: Number(process.env.REACT_APP_REEF_EXTENT_MAX_NATIVE_ZOOM || 16),
      };
      layers.push(
        {
          id: reefFillLayerIdFor(t.id),
          type: 'fill',
          source: reefSourceIdFor(t.id),
          'source-layer': REEF_EXTENT_SOURCE_LAYER,
          layout: { visibility: 'none' },
          minzoom: BENTHIC_MIN_ZOOM,
          paint: {
            'fill-color': buildReefExtentColorMatchExpression({}),
            'fill-opacity': 0.55,
          },
          filter: buildVisibleReefExtentFilter({}),
        },
        {
          id: reefLineLayerIdFor(t.id),
          type: 'line',
          source: reefSourceIdFor(t.id),
          'source-layer': REEF_EXTENT_SOURCE_LAYER,
          layout: { visibility: 'none' },
          minzoom: BENTHIC_MIN_ZOOM,
          paint: {
            'line-color': buildReefExtentColorMatchExpression({}),
            'line-opacity': 0.35,
            'line-width': 0.5,
          },
          filter: buildVisibleReefExtentFilter({}),
        },
      );
    }

    for (const t of BENTHIC_TILESETS) {
      sources[sourceIdFor(t.id)] = {
        type: 'vector',
        tiles: [toAbsoluteTileUrl(t.url)],
        minzoom: BENTHIC_MIN_ZOOM,
        maxzoom: Number(process.env.REACT_APP_BENTHIC_MAX_NATIVE_ZOOM || 16),
      };
      layers.push(
        {
          id: fillLayerIdFor(t.id),
          type: 'fill',
          source: sourceIdFor(t.id),
          'source-layer': BENTHIC_SOURCE_LAYER,
          layout: { visibility: 'none' },
          minzoom: BENTHIC_MIN_ZOOM,
          paint: {
            'fill-color': buildColorMatchExpression({}),
            'fill-opacity': 0.88,
          },
          filter: buildVisibleClassFilter({}),
        },
        {
          id: lineLayerIdFor(t.id),
          type: 'line',
          source: sourceIdFor(t.id),
          'source-layer': BENTHIC_SOURCE_LAYER,
          layout: { visibility: 'none' },
          minzoom: BENTHIC_MIN_ZOOM,
          paint: {
            'line-color': buildColorMatchExpression({}),
            'line-opacity': 0.5,
            'line-width': 0.6,
          },
          filter: buildVisibleClassFilter({}),
        },
      );
    }

    sources[BLEACHING_SOURCE] = {
      type: 'vector',
      tiles: [toAbsoluteTileUrl('/api/public/bleaching-tiles/{z}/{x}/{y}.pbf')],
      minzoom: 2,
      maxzoom: 14,
    };
    layers.push({
      id: BLEACHING_LAYER,
      type: 'fill',
      source: BLEACHING_SOURCE,
      'source-layer': BLEACHING_SOURCE_LAYER,
      layout: { visibility: 'none' },
      minzoom: 2,
      paint: {
        'fill-color': buildBleachingSeverityColorExpression(),
        'fill-opacity': 0.82,
        'fill-outline-color': 'rgba(0,0,0,0.12)',
      },
      filter: buildBleachingYearFilter(DEFAULT_BLEACHING_YEAR),
    });

    sources[BLEACHING_OBS_SOURCE] = {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    };
    layers.push({
      id: BLEACHING_OBS_LAYER,
      type: 'circle',
      source: BLEACHING_OBS_SOURCE,
      layout: { visibility: 'none' },
      minzoom: 4,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 7, 14, 10],
        'circle-color': buildBleachingSeverityColorExpression(),
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#1f2937',
        'circle-opacity': 0.95,
      },
      filter: buildBleachingYearFilter(DEFAULT_BLEACHING_YEAR),
    });

    layers.push({
      id: CAPTIONS_LAYER,
      type: 'raster',
      source: CAPTIONS_SOURCE,
      layout: { visibility: 'none' },
    });

    addLeafletClusterSourcesAndLayers(sources, layers);

    return {
      version: 8,
      name: 'Customer map',
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources,
      layers,
    };
  }, [basemap]);

  const coloniesRef = useRef(colonies);
  useEffect(() => {
    captionsVisibleRef.current = captionsVisible;
  }, [captionsVisible]);

  useEffect(() => {
    bleachingVisibleRef.current = bleachingVisible;
  }, [bleachingVisible]);

  useEffect(() => {
    onBleachingClickRef.current = onBleachingObservationClick;
  }, [onBleachingObservationClick]);

  useEffect(() => {
    bleachingObsRef.current = bleachingObservationsGeoJson;
  }, [bleachingObservationsGeoJson]);

  useEffect(() => {
    coloniesRef.current = colonies;
  }, [colonies]);

  const applyBenthicVisibility = (map) => {
    const activeIds = benthicVisible ? getMaplibreActiveBenthicTilesetIds(map) : [];
    for (const t of BENTHIC_TILESETS) {
      const vis = activeIds.includes(t.id) ? 'visible' : 'none';
      const fillId = fillLayerIdFor(t.id);
      const lineId = lineLayerIdFor(t.id);
      if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis);
      if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', vis);
    }
  };

  const applyBenthicStyling = (map) => {
    const colorExpr = buildColorMatchExpression(benthicClasses);
    const classFilter = buildVisibleClassFilter(benthicClasses);
    for (const t of BENTHIC_TILESETS) {
      const fillId = fillLayerIdFor(t.id);
      const lineId = lineLayerIdFor(t.id);
      if (map.getLayer(fillId)) {
        map.setPaintProperty(fillId, 'fill-color', colorExpr);
        map.setFilter(fillId, classFilter);
      }
      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, 'line-color', colorExpr);
        map.setFilter(lineId, classFilter);
      }
    }
  };

  const applyReefExtentVisibility = (map) => {
    const activeIds = reefExtentVisible ? getMaplibreActiveReefExtentTilesetIds(map) : [];
    for (const t of REEF_EXTENT_TILESETS) {
      const vis = activeIds.includes(t.id) ? 'visible' : 'none';
      const fillId = reefFillLayerIdFor(t.id);
      const lineId = reefLineLayerIdFor(t.id);
      if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis);
      if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', vis);
    }
  };

  const applyReefExtentStyling = (map) => {
    const colorExpr = buildReefExtentColorMatchExpression(reefExtentClasses);
    const classFilter = buildVisibleReefExtentFilter(reefExtentClasses);
    for (const t of REEF_EXTENT_TILESETS) {
      const fillId = reefFillLayerIdFor(t.id);
      const lineId = reefLineLayerIdFor(t.id);
      if (map.getLayer(fillId)) {
        map.setPaintProperty(fillId, 'fill-color', colorExpr);
        map.setFilter(fillId, classFilter);
      }
      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, 'line-color', colorExpr);
        map.setFilter(lineId, classFilter);
      }
    }
  };

  const applyCaptionsVisibility = (map) => {
    if (map.getLayer(CAPTIONS_LAYER)) {
      map.setLayoutProperty(CAPTIONS_LAYER, 'visibility', captionsVisibleRef.current ? 'visible' : 'none');
    }
  };

  const applyBleachingVisibility = (map) => {
    const vis = bleachingVisibleRef.current ? 'visible' : 'none';
    if (map.getLayer(BLEACHING_LAYER)) map.setLayoutProperty(BLEACHING_LAYER, 'visibility', vis);
    if (map.getLayer(BLEACHING_OBS_LAYER)) map.setLayoutProperty(BLEACHING_OBS_LAYER, 'visibility', vis);
  };

  const applyBleachingYear = (map, year) => {
    if (year == null) return;
    const yearFilter = buildBleachingYearFilter(year);
    if (map.getLayer(BLEACHING_LAYER)) map.setFilter(BLEACHING_LAYER, yearFilter);
    if (map.getLayer(BLEACHING_OBS_LAYER)) map.setFilter(BLEACHING_OBS_LAYER, yearFilter);
  };

  const applyBleachingObservations = (map) => {
    const src = map.getSource(BLEACHING_OBS_SOURCE);
    if (src && bleachingObsRef.current) {
      src.setData(bleachingObsRef.current);
    }
  };

  const applyColoniesData = (map) => {
    const src = map.getSource(COLONIES_SOURCE);
    if (!src || !src.setData) return false;
    src.setData(coloniesToGeoJson(coloniesRef.current));
    return true;
  };

  const openColonyPopup = (map, colony, coordinates) => {
    if (!colony || !Array.isArray(coordinates) || coordinates.length !== 2) return;
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    const node = document.createElement('div');
    node.style.minWidth = '420px';
    node.style.maxWidth = '480px';
    const root = createRoot(node);
    root.render(<ColonyPopupContent colony={colony} />);

    const popup = new maplibregl.Popup({
      anchor: 'bottom',
      closeOnMove: false,
      focusAfterOpen: false,
      maxWidth: '480px',
      offset: [0, -4],
    });
    popup.setLngLat(coordinates);
    popup.setDOMContent(node);
    popup.addTo(map);
    popup.on('close', () => {
      try { root.unmount(); } catch (_) { /* ignore */ }
    });
    popupRef.current = popup;
  };

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
      interactive: true,
    });
    mapRef.current = map;
    clusterControllerRef.current = createLeafletClusterController({
      map,
      getColonies: () => coloniesRef.current,
      openPopup: (colony, coordinates) => openColonyPopup(map, colony, coordinates),
    });

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');
    const syncImagesAndHandlers = () => {
      ensureLeafletMarkerImages(map).catch(() => {
        // Map still works with clusters if marker images fail to load.
      });
      clusterControllerRef.current?.registerInteractions();
      // Style reload recreates sources/layers: re-apply all runtime state.
      applyBenthicStyling(map);
      applyReefExtentStyling(map);
      applyCaptionsVisibility(map);
      applyBenthicVisibility(map);
      applyReefExtentVisibility(map);
      applyBleachingVisibility(map);
      applyBleachingYear(map, bleachingYear);
      applyBleachingObservations(map);
      applyColoniesData(map);
      clusterControllerRef.current?.clearSpider();
    };
    map.on('load', syncImagesAndHandlers);
    map.on('style.load', syncImagesAndHandlers);
    map.on('click', BLEACHING_OBS_LAYER, (e) => {
      if (!bleachingVisibleRef.current) return;
      const feature = e.features?.[0];
      if (feature?.properties) onBleachingClickRef.current?.(feature.properties);
    });
    map.on('mouseenter', BLEACHING_OBS_LAYER, () => {
      if (bleachingVisibleRef.current) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', BLEACHING_OBS_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('error', (event) => {
      if (
        isBenthicTileError(event?.error) ||
        isReefExtentTileError(event?.error) ||
        isBleachingTileError(event?.error)
      ) {
        return;
      }
      // Let non-benthic errors keep their normal development visibility.
      // eslint-disable-next-line no-console
      console.error(event?.error || event);
    });
    map.on('zoomstart', () => clusterControllerRef.current?.clearSpider());
    map.on('zoomend', () => clusterControllerRef.current?.renderSpider());
    map.on('moveend', () => clusterControllerRef.current?.renderSpider());

    return () => {
      try {
        clusterControllerRef.current?.dispose();
        map.remove();
      } catch (_) {
        // ignore
      }
      clusterControllerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild style only when basemap changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapRef.current === basemap) return;
    basemapRef.current = basemap;
    // This triggers `style.load`, where we re-apply images, data, and handlers.
    map.setStyle(style);
  }, [basemap, style]);

  // Benthic visibility + viewport gating.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => applyBenthicVisibility(map);

    if (map.isStyleLoaded()) apply();
    map.on('moveend', apply);
    map.on('zoomend', apply);
    map.on('styledata', apply);
    return () => {
      map.off('moveend', apply);
      map.off('zoomend', apply);
      map.off('styledata', apply);
    };
  }, [benthicVisible]);

  // Reef extent visibility + viewport gating.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => applyReefExtentVisibility(map);

    if (map.isStyleLoaded()) apply();
    map.on('moveend', apply);
    map.on('zoomend', apply);
    map.on('styledata', apply);
    return () => {
      map.off('moveend', apply);
      map.off('zoomend', apply);
      map.off('styledata', apply);
    };
  }, [reefExtentVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => applyBleachingVisibility(map);

    if (map.isStyleLoaded()) apply();
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [bleachingVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || bleachingYear == null) return;

    const apply = () => applyBleachingYear(map, bleachingYear);

    if (map.isStyleLoaded()) apply();
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [bleachingYear]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bleachingObservationsGeoJson) return;

    const apply = () => applyBleachingObservations(map);

    if (map.isStyleLoaded()) apply();
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [bleachingObservationsGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyCaptionsVisibility(map);
  }, [captionsVisible]);

  // Sync class colors/visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyBenthicStyling(map);
  }, [benthicClasses]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyReefExtentStyling(map);
  }, [reefExtentClasses]);

  // Update colonies data and fit bounds.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = coloniesToGeoJson(colonies);
    // If style is mid-load (or was just rebuilt), source may not exist yet.
    if (!applyColoniesData(map)) {
      const onStyleData = () => {
        if (applyColoniesData(map)) {
          map.off('styledata', onStyleData);
        }
      };
      map.on('styledata', onStyleData);
    }

    if (!data.features.length) return;
    const coords = data.features.map((f) => f.geometry.coordinates);
    let minX = coords[0][0];
    let minY = coords[0][1];
    let maxX = coords[0][0];
    let maxY = coords[0][1];
    for (const [x, y] of coords) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 50, maxZoom: 14, duration: 500 },
    );
  }, [colonies]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget || focusHandledKeyRef.current === focusTarget.key) return;

    const focus = () => {
      focusHandledKeyRef.current = focusTarget.key;
      clusterControllerRef.current?.clearSpider();
      map.flyTo({
        center: focusTarget.coordinates,
        zoom: focusTarget.zoom || 12,
        duration: 700,
        essential: true,
      });
      if (focusTarget.colony) {
        openColonyPopup(map, focusTarget.colony, focusTarget.coordinates);
      }
    };

    if (map.isStyleLoaded()) {
      focus();
      return;
    }

    map.once('load', focus);
    return () => {
      try { map.off('load', focus); } catch (_) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

