import { useEffect, useState } from 'react';
import { DEFAULT_BLEACHING_YEAR } from 'utils/mapLayerSettings';

export default function useBleachingMapData(initialYear = DEFAULT_BLEACHING_YEAR) {
  const [bleachingYears, setBleachingYears] = useState([]);
  const [bleachingObservations, setBleachingObservations] = useState(null);
  const [bleachingYear, setBleachingYear] = useState(initialYear);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [yearsRes, obsRes] = await Promise.all([
          fetch('/api/public/bleaching-years.json'),
          fetch('/api/public/bleaching-observations.geojson'),
        ]);
        if (!yearsRes.ok || !obsRes.ok) return;
        const yearsData = await yearsRes.json();
        const obsData = await obsRes.json();
        const list = yearsData.years || [];
        setBleachingYears(list);
        setBleachingObservations(obsData);
        if (list.length && !list.includes(initialYear)) {
          setBleachingYear(list[list.length - 1]);
        }
      } catch (_) {
        // Optional layer.
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [initialYear]);

  return {
    bleachingYears,
    bleachingObservations,
    bleachingYear,
    setBleachingYear,
    bleachingLoading: loading,
  };
}
