/**
 * Reef extent (Allen Coral Atlas): vector tiles from backend MBTiles (source-layer: reef_extent).
 * Bounds mirror benthic regions where both exist; Micronesia & SW Pacific added for new archives.
 */

export const REEF_EXTENT_VECTOR_LAYER = process.env.REACT_APP_REEF_EXTENT_VECTOR_LAYER || 'reef_extent';

/** Geographic envelopes [[south, west], [north, east]] for viewport-mounted tilesets */
export const REEF_EXTENT_TILESETS = [
  {
    id: 'caribbean',
    label: 'Caribbean Sea',
    url: '/api/public/reef-extent-tiles/caribbean/{z}/{x}/{y}.pbf',
    bounds: [[8, -98], [32, -60]],
  },
  {
    id: 'arabian',
    label: 'Northwestern Arabian Sea',
    url: '/api/public/reef-extent-tiles/arabian/{z}/{x}/{y}.pbf',
    bounds: [[10, 52], [32, 72]],
  },
  {
    id: 'redsea',
    label: 'Red Sea & Gulf of Aden',
    url: '/api/public/reef-extent-tiles/redsea/{z}/{x}/{y}.pbf',
    bounds: [[6, 30], [35, 52]],
  },
  {
    id: 'micronesia',
    label: 'Western Micronesia',
    url: '/api/public/reef-extent-tiles/micronesia/{z}/{x}/{y}.pbf',
    bounds: [[1, 131], [20, 163]],
  },
  {
    id: 'sw_pacific',
    label: 'Southwestern Pacific',
    url: '/api/public/reef-extent-tiles/sw_pacific/{z}/{x}/{y}.pbf',
    bounds: [[-26, 110], [5, 175]],
  },
];

export const REEF_EXTENT_ZOOM_STRICT_REGION = 5;

export const DEFAULT_REEF_EXTENT_CLASS_COLORS = {
  Reef: '#34d399',
};
