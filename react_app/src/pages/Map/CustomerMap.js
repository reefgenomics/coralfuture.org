import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import SidebarFilterProvider from 'contexts/SidebarFilterContext';
import InputSidebar from 'components/Sidebar/Sidebar';
import Map from 'components/Map/Map';
import BleachingObservationModal from 'components/Bleaching/BleachingObservationModal';
import { DEFAULT_BENTHIC_CLASS_COLORS } from 'components/Tiles/BenthicTileLayer';
import { DEFAULT_REEF_EXTENT_CLASS_COLORS } from 'components/Tiles/ReefExtentTileLayer';

const MAP_SETTINGS_CACHE_KEY = 'customerMapSettings';
const DEFAULT_BLEACHING_YEAR = 2005;

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

const getInitialMapSettings = () => {
  const defaults = {
    basemap: 'imagery',
    captionsVisible: true,
    benthicVisible: false,
    benthicClasses: buildDefaultBenthicClasses(),
    reefExtentVisible: false,
    reefExtentClasses: buildDefaultReefExtentClasses(),
    bleachingVisible: false,
    bleachingYear: DEFAULT_BLEACHING_YEAR,
  };

  try {
    const cached = JSON.parse(window.localStorage.getItem(MAP_SETTINGS_CACHE_KEY));
    if (!cached || typeof cached !== 'object') return defaults;
    return {
      ...defaults,
      ...cached,
      benthicClasses: {
        ...defaults.benthicClasses,
        ...(cached.benthicClasses || {}),
      },
      reefExtentClasses: {
        ...defaults.reefExtentClasses,
        ...(cached.reefExtentClasses || {}),
      },
    };
  } catch (_) {
    return defaults;
  }
};

const CustomerMap = () => {
  const initialSettings = getInitialMapSettings();
  const [basemap, setBasemap] = useState(initialSettings.basemap);
  const [captionsVisible, setCaptionsVisible] = useState(initialSettings.captionsVisible);
  const [benthicVisible, setBenthicVisible] = useState(initialSettings.benthicVisible);
  const [benthicClasses, setBenthicClasses] = useState(initialSettings.benthicClasses);
  const [reefExtentVisible, setReefExtentVisible] = useState(initialSettings.reefExtentVisible);
  const [reefExtentClasses, setReefExtentClasses] = useState(initialSettings.reefExtentClasses);
  const [bleachingVisible, setBleachingVisible] = useState(initialSettings.bleachingVisible);
  const [bleachingYear, setBleachingYear] = useState(initialSettings.bleachingYear);
  const [bleachingYears, setBleachingYears] = useState([]);
  const [bleachingObservations, setBleachingObservations] = useState(null);
  const [selectedBleachingObs, setSelectedBleachingObs] = useState(null);
  const [searchParams] = useSearchParams();
  const bleachingFromUrlAppliedRef = useRef(false);

  useEffect(() => {
    if (bleachingFromUrlAppliedRef.current) return;
    const yearParam = searchParams.get('bleachingYear');
    if (!yearParam) return;
    const year = Number(yearParam);
    if (!Number.isFinite(year)) return;
    bleachingFromUrlAppliedRef.current = true;
    setBleachingYear(year);
    setBleachingVisible(true);
  }, [searchParams]);

  useEffect(() => {
    const loadBleaching = async () => {
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
        if (list.length && !list.includes(bleachingYear)) {
          setBleachingYear(list[list.length - 1]);
        }
      } catch (_) {
        // Bleaching layer optional if files missing.
      }
    };
    loadBleaching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MAP_SETTINGS_CACHE_KEY,
        JSON.stringify({
          basemap,
          captionsVisible,
          benthicVisible,
          benthicClasses,
          reefExtentVisible,
          reefExtentClasses,
          bleachingVisible,
          bleachingYear,
        }),
      );
    } catch (_) {
      // Ignore localStorage quota/private mode issues.
    }
  }, [
    basemap,
    captionsVisible,
    benthicVisible,
    benthicClasses,
    reefExtentVisible,
    reefExtentClasses,
    bleachingVisible,
    bleachingYear,
  ]);

  return (
    <SidebarFilterProvider>
      <Container fluid className="p-0" style={{ height: 'calc(100vh - 56px)', position: 'relative', marginTop: '56px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <Map
            basemap={basemap}
            captionsVisible={captionsVisible}
            benthicVisible={benthicVisible}
            benthicClasses={benthicClasses}
            reefExtentVisible={reefExtentVisible}
            reefExtentClasses={reefExtentClasses}
            bleachingVisible={bleachingVisible}
            bleachingYear={bleachingYear}
            bleachingObservationsGeoJson={bleachingObservations}
            onBleachingObservationClick={setSelectedBleachingObs}
          />
        </div>

        <div style={{
          position: 'absolute',
          top: '20px',
          right: '16px',
          zIndex: 1000,
          width: '390px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <InputSidebar
            basemap={basemap}
            onBasemapChange={setBasemap}
            captionsVisible={captionsVisible}
            onCaptionsVisibleChange={setCaptionsVisible}
            benthicVisible={benthicVisible}
            onBenthicVisibleChange={setBenthicVisible}
            benthicClasses={benthicClasses}
            onBenthicClassesChange={setBenthicClasses}
            reefExtentVisible={reefExtentVisible}
            onReefExtentVisibleChange={setReefExtentVisible}
            reefExtentClasses={reefExtentClasses}
            onReefExtentClassesChange={setReefExtentClasses}
            bleachingVisible={bleachingVisible}
            onBleachingVisibleChange={setBleachingVisible}
            bleachingYear={bleachingYear}
            onBleachingYearChange={setBleachingYear}
            bleachingYears={bleachingYears}
          />
        </div>
      </Container>

      <BleachingObservationModal
        show={!!selectedBleachingObs}
        onHide={() => setSelectedBleachingObs(null)}
        observation={selectedBleachingObs}
      />
    </SidebarFilterProvider>
  );
};

export default CustomerMap;
