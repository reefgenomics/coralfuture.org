/**
 * Reef extent (Allen Coral Atlas): vector tiles from backend MBTiles (source-layer: reef_extent).
 */

import { ALLEN_ATLAS_REGION_TILESETS } from './atlasViewportRegions';

export const REEF_EXTENT_VECTOR_LAYER = process.env.REACT_APP_REEF_EXTENT_VECTOR_LAYER || 'reef_extent';

/** Geographic envelopes [[south, west], [north, east]] for viewport-mounted tilesets */
export const REEF_EXTENT_TILESETS = ALLEN_ATLAS_REGION_TILESETS.map((r) => ({
  id: r.id,
  label: r.label,
  url: `/api/public/reef-extent-tiles/${r.id}/{z}/{x}/{y}.pbf`,
  bounds: r.bounds,
}));

export const REEF_EXTENT_ZOOM_STRICT_REGION = 5;

export const DEFAULT_REEF_EXTENT_CLASS_COLORS = {
  Reef: '#34d399',
};
