import { DEFAULT_BENTHIC_CLASS_COLORS } from 'components/Tiles/BenthicTileLayer';
import { DEFAULT_REEF_EXTENT_CLASS_COLORS } from 'components/Tiles/ReefExtentTileLayer';

export const DEFAULT_BLEACHING_YEAR = 2005;

const buildDefaultBenthicClasses = () => Object.fromEntries(
  Object.entries(DEFAULT_BENTHIC_CLASS_COLORS).map(([className, color]) => [
    className,
    { visible: true, color },
  ]),
);

const buildDefaultReefExtentClasses = () => Object.fromEntries(
  Object.entries(DEFAULT_REEF_EXTENT_CLASS_COLORS).map(([className, color]) => [
    className,
    { visible: true, color },
  ]),
);

const defaultSettings = () => ({
  basemap: 'imagery',
  captionsVisible: true,
  benthicVisible: false,
  benthicClasses: buildDefaultBenthicClasses(),
  reefExtentVisible: false,
  reefExtentClasses: buildDefaultReefExtentClasses(),
  bleachingVisible: false,
  bleachingYear: DEFAULT_BLEACHING_YEAR,
});

export const getMapLayerSettings = (cacheKey) => {
  const defaults = defaultSettings();
  if (!cacheKey) return defaults;
  try {
    const cached = JSON.parse(window.localStorage.getItem(cacheKey));
    if (!cached || typeof cached !== 'object') return defaults;
    return {
      ...defaults,
      ...cached,
      benthicClasses: { ...defaults.benthicClasses, ...(cached.benthicClasses || {}) },
      reefExtentClasses: { ...defaults.reefExtentClasses, ...(cached.reefExtentClasses || {}) },
    };
  } catch (_) {
    return defaults;
  }
};

export const persistMapLayerSettings = (cacheKey, settings) => {
  if (!cacheKey) return;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(settings));
  } catch (_) {
    // Ignore quota / private mode.
  }
};
