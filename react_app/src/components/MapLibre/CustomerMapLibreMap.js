import React, { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAPS } from 'components/Tiles/basemaps';
import {
  BENTHIC_TILESETS,
  DEFAULT_BENTHIC_CLASS_COLORS,
} from 'components/Tiles/BenthicTileLayer';
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

const captionsUrlFor = (basemap) => (basemap === 'ocean' ? OCEAN_CAPTIONS_URL : DEFAULT_CAPTIONS_URL);

const isBenthicTileError = (error) => {
  const url = error?.url || error?.message || '';
  return typeof url === 'string' && url.includes('/benthic-tiles/');
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

const getMaplibreActiveBenthicTilesetIds = (map) => {
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

  // Direct implementation (no Leaflet dependency) using BENTHIC_TILESETS bounds.
  const z = map.getZoom();
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const pad = 0.06;
  const swp = { lat: sw.lat - (ne.lat - sw.lat) * pad, lng: sw.lng - (ne.lng - sw.lng) * pad };
  const nep = { lat: ne.lat + (ne.lat - sw.lat) * pad, lng: ne.lng + (ne.lng - sw.lng) * pad };

  const hits = BENTHIC_TILESETS.filter((t) => t.bounds).filter((t) => {
    const [[s, w], [n, e]] = t.bounds;
    const intersects =
      e >= swp.lng && w <= nep.lng && n >= swp.lat && s <= nep.lat;
    return intersects;
  });

  if (hits.length === 0) return [];
  const strictZoom = 5;
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

export default function CustomerMapLibreMap({
  basemap = 'imagery',
  captionsVisible = true,
  benthicVisible = true,
  benthicClasses = {},
  colonies = [],
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const clusterControllerRef = useRef(null);
  const basemapRef = useRef(basemap);
  const captionsVisibleRef = useRef(captionsVisible);

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

  const applyCaptionsVisibility = (map) => {
    if (map.getLayer(CAPTIONS_LAYER)) {
      map.setLayoutProperty(CAPTIONS_LAYER, 'visibility', captionsVisibleRef.current ? 'visible' : 'none');
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
      applyCaptionsVisibility(map);
      applyBenthicVisibility(map);
      applyColoniesData(map);
      clusterControllerRef.current?.clearSpider();
    };
    map.on('load', syncImagesAndHandlers);
    map.on('style.load', syncImagesAndHandlers);
    map.on('error', (event) => {
      if (isBenthicTileError(event?.error)) {
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

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

