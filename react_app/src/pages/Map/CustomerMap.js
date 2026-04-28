import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
// Contexts
import SidebarFilterProvider from 'contexts/SidebarFilterContext';
// Components
import InputSidebar from 'components/Sidebar/Sidebar';
import Map from 'components/Map/Map';
import { DEFAULT_BENTHIC_CLASS_COLORS } from 'components/Tiles/BenthicTileLayer';

const MAP_SETTINGS_CACHE_KEY = 'customerMapSettings';

const buildDefaultBenthicClasses = () => Object.fromEntries(
  Object.entries(DEFAULT_BENTHIC_CLASS_COLORS).map(([className, color]) => [
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MAP_SETTINGS_CACHE_KEY,
        JSON.stringify({ basemap, captionsVisible, benthicVisible, benthicClasses }),
      );
    } catch (_) {
      // Ignore localStorage quota/private mode issues.
    }
  }, [basemap, captionsVisible, benthicVisible, benthicClasses]);

  return (
    <SidebarFilterProvider>
      <Container fluid className="p-0" style={{ height: 'calc(100vh - 56px)', position: 'relative', marginTop: '56px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <Map
            basemap={basemap}
            captionsVisible={captionsVisible}
            benthicVisible={benthicVisible}
            benthicClasses={benthicClasses}
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
          />
        </div>
      </Container>
    </SidebarFilterProvider>
  );
};

export default CustomerMap;
