import React from 'react';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
// Contexts
import SidebarFilterProvider from 'contexts/SidebarFilterContext';
// Components
import InputSidebar from 'components/Sidebar/Sidebar';
import Map from 'components/Map/Map';

const CustomerMap = () => {
  return (
    <SidebarFilterProvider>
      <Container fluid className="p-0" style={{ height: 'calc(100vh - 56px)', position: 'relative', marginTop: '56px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <Map />
        </div>
        
        {/* Overlay filter panel */}
        <div style={{ 
          position: 'absolute', 
          top: '20px', 
          left: '10px', 
          zIndex: 1000, 
          maxWidth: '350px',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
        }}>
          <InputSidebar />
        </div>
      </Container>
    </SidebarFilterProvider>
  );
};

export default CustomerMap;
