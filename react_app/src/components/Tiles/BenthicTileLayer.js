import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { createLayerComponent } from '@react-leaflet/core';
import 'leaflet.vectorgrid';

export const BENTHIC_OVERLAY_NAME = 'Benthic habitat';

const BENTHIC_TILE_URL = process.env.REACT_APP_BENTHIC_TILE_URL || '/api/public/benthic-tiles/{z}/{x}/{y}.pbf';
const BENTHIC_VECTOR_LAYER = process.env.REACT_APP_BENTHIC_VECTOR_LAYER || 'benthic';

// Geographic envelopes [[south, west], [north, east]] — only mount a tileset when the (padded) view intersects.
// CIO matches legacy Mapbox benthic extent; other boxes are loose data bounds.
// Caribbean layer disabled: 3+ GB tileset was causing severe map lag. Re-add when optimized.
// { id: 'caribbean', label: '...', url: '.../caribbean/...', bounds: [[8, -98], [32, -60]] },
export const BENTHIC_TILESETS = [
  { id: 'cio', label: 'Central Indian Ocean', url: BENTHIC_TILE_URL, bounds: [[-7.5, 71.0], [12.5, 74.0]] },
  {
    id: 'arabian',
    label: 'Northwestern Arabian Sea',
    url: '/api/public/benthic-tiles/arabian/{z}/{x}/{y}.pbf',
    bounds: [[10, 52], [32, 72]],
  },
  {
    id: 'redsea',
    label: 'Red Sea & Gulf of Aden',
    url: '/api/public/benthic-tiles/redsea/{z}/{x}/{y}.pbf',
    bounds: [[6, 30], [35, 52]],
  },
];

/** Below this zoom, if the view hits multiple regions, only the one nearest to map center is active. */
export const BENTHIC_ZOOM_STRICT_REGION = 5;
const VIEWPORT_BOUNDS_PAD = 0.06;

/**
 * Returns tileset ids to mount: viewport ∩ region bounds, with a small buffer.
 * - No intersection → no layers (no spurious fetches for “wrong” oceans).
 * - zoom < BENTHIC_ZOOM_STRICT_REGION and several regions match → one nearest to map center.
 * - zoom ≥ that → all matching regions.
 */
export const getActiveBenthicTilesetIds = (map) => {
  if (!BENTHIC_TILESETS.length) return [];
  const z = map.getZoom();
  const viewBounds = map.getBounds().pad(VIEWPORT_BOUNDS_PAD);
  const mapCenter = map.getCenter();
  const withBounds = BENTHIC_TILESETS.filter((t) => t.bounds);
  if (withBounds.length === 0) {
    return BENTHIC_TILESETS.map((t) => t.id);
  }
  const hitting = withBounds.filter((t) => L.latLngBounds(t.bounds).intersects(viewBounds));
  if (hitting.length === 0) {
    return [];
  }
  if (z < BENTHIC_ZOOM_STRICT_REGION) {
    const best = hitting.reduce(
      (acc, t) => {
        const c = L.latLngBounds(t.bounds).getCenter();
        const d = mapCenter.distanceTo(c);
        if (!acc || d < acc.d) return { id: t.id, d };
        return acc;
      },
      null,
    );
    return best ? [best.id] : [];
  }
  return hitting.map((t) => t.id);
};

export const BenthicTilesetsInViewport = ({ benthicClasses = {} }) => {
  const map = useMap();
  const [activeIds, setActiveIds] = useState(() => getActiveBenthicTilesetIds(map));

  useEffect(() => {
    const sync = () => {
      setActiveIds(getActiveBenthicTilesetIds(map));
    };
    sync();
    map.on('moveend', sync);
    map.on('zoomend', sync);
    return () => {
      map.off('moveend', sync);
      map.off('zoomend', sync);
    };
  }, [map]);

  return BENTHIC_TILESETS.filter((t) => activeIds.includes(t.id)).map((tileset) => (
    <BenthicVectorTileLayer
      key={`${tileset.id}-${JSON.stringify(benthicClasses)}`}
      tileUrl={tileset.url}
      classSettings={benthicClasses}
    />
  ));
};

export const DEFAULT_BENTHIC_CLASS_COLORS = {
  'Coral/Algae': '#ff7f50',
  'Microalgal Mats': '#8b5cf6',
  Rock: '#6b7280',
  Rubble: '#b45309',
  Sand: '#f2d16b',
  Seagrass: '#22c55e',
};

const getBenthicStyle = (properties = {}, classSettings = {}) => {
  const className = properties.class;
  const settings = classSettings[className];

  if (settings && !settings.visible) {
    return {
      stroke: false,
      fill: false,
      fillOpacity: 0,
      weight: 0,
    };
  }

  const color = settings?.color || DEFAULT_BENTHIC_CLASS_COLORS[className] || '#14b8a6';

  return {
    // A subtle stroke makes edges read as "sharp" on top of imagery,
    // especially with canvas antialiasing.
    stroke: true,
    fill: true,
    color,
    opacity: 0.55,
    fillColor: color,
    fillOpacity: 0.9,
    weight: 0.7,
  };
};

export const BenthicVectorTileLayer = createLayerComponent((props, context) => {
  const classSettings = props.classSettings || {};
  const tileUrl = props.tileUrl || BENTHIC_TILE_URL;
  const layer = L.vectorGrid.protobuf(tileUrl, {
    rendererFactory: (process.env.REACT_APP_BENTHIC_RENDERER || 'canvas') === 'svg' ? L.svg.tile : L.canvas.tile,
    interactive: false,
    maxNativeZoom: Number(process.env.REACT_APP_BENTHIC_MAX_NATIVE_ZOOM || 12),
    pane: 'overlayPane',
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 3,
    vectorTileLayerStyles: {
      [BENTHIC_VECTOR_LAYER]: (properties) => getBenthicStyle(properties, classSettings),
    },
  });

  return { instance: layer, context };
});

export const BenthicLegend = () => {
  const map = useMap();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleOverlayAdd = (event) => {
      if (event.name === BENTHIC_OVERLAY_NAME) setVisible(true);
    };
    const handleOverlayRemove = (event) => {
      if (event.name === BENTHIC_OVERLAY_NAME) setVisible(false);
    };

    map.on('overlayadd', handleOverlayAdd);
    map.on('overlayremove', handleOverlayRemove);
    return () => {
      map.off('overlayadd', handleOverlayAdd);
      map.off('overlayremove', handleOverlayRemove);
    };
  }, [map]);

  if (!visible) return null;

  return (
    <div className="tile-legend benthic-legend leaflet-control">
      <div className="tile-legend-title">Benthic Habitat</div>
      {Object.entries(DEFAULT_BENTHIC_CLASS_COLORS).map(([label, color]) => (
        <div key={label} className="tile-legend-item">
          <span className="tile-legend-swatch" style={{ backgroundColor: color }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
};
