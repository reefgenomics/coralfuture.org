import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
// Contexts
import SidebarFilterProvider from 'contexts/SidebarFilterContext';
// Components
import InputSidebar from 'components/Sidebar/Sidebar';
import Map from 'components/Map/Map';

const CustomerMap = () => {
  const [basemap, setBasemap] = useState('imagery');
  const [benthicVisible, setBenthicVisible] = useState(true);
  const [benthicClasses, setBenthicClasses] = useState({
    'Coral/Algae': { visible: true, color: '#ff7f50' },
    'Microalgal Mats': { visible: true, color: '#8b5cf6' },
    Rock: { visible: true, color: '#6b7280' },
    Rubble: { visible: true, color: '#b45309' },
    Sand: { visible: true, color: '#f2d16b' },
    Seagrass: { visible: true, color: '#22c55e' },
  });

  return (
    <SidebarFilterProvider>
      <Container fluid className="p-0" style={{ height: 'calc(100vh - 56px)', position: 'relative', marginTop: '56px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <Map
            basemap={basemap}
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
        }}>
          <InputSidebar
            basemap={basemap}
            onBasemapChange={setBasemap}
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
