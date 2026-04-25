// External imports
import React, { useEffect, useState, useContext } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import { Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
import { SidebarFilterContext } from 'contexts/SidebarFilterContext'
import Markers from 'components/Markers/Markers';
import filterColonies from 'utils/filterColonies';


// To adjust map center and zoom to selection
const ChangeView = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = new L.LatLngBounds(markers.map(marker => [marker.latitude, marker.longitude]));
      map.fitBounds(bounds);
    }
  }, [markers, map]);
  return null;
}

const Map = () => {
  const { BaseLayer } = LayersControl;
  const { allColonies, filters, filteredColonies, setFilteredColonies, defaultValues } = useContext(SidebarFilterContext);
  const [mapCenter, setMapCenter] = useState(null);
  
  useEffect(() => {
    if (allColonies && allColonies.length > 0) {
      let dataToSet = allColonies;

      // Only apply the filter if filters are set
      if (filters && Object.keys(filters).length > 0) {
        dataToSet = filterColonies(filters, allColonies, defaultValues);
      }
      // Recalculate map center based on selection
      const avgLat = dataToSet.reduce((sum, marker) => sum + marker.latitude, 0) / dataToSet.length;
      const avgLng = dataToSet.reduce((sum, marker) => sum + marker.longitude, 0) / dataToSet.length;

      setMapCenter([avgLat, avgLng]);
      setFilteredColonies(dataToSet);
    }
  }, [filters, allColonies, setFilteredColonies]);


  return (
    mapCenter ? (
      <MapContainer
        center={mapCenter}
        zoom={3}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <ChangeView markers={filteredColonies} />
        <LayersControl position="topright">
        <BaseLayer name="OpenStreetMap">
            <TileLayer
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
          </BaseLayer>
          <BaseLayer checked name="World Imagery">
            <TileLayer
              url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            />
          </BaseLayer>
        </LayersControl>
        <Markers colonies={filteredColonies} />
        <style>
          {`
            .leaflet-control-layers-base label {
              text-align: left;
            }
            
            .leaflet-popup-content {
              margin: 10px 10px;
              min-width: 420px;
            }
            
            .leaflet-popup-content::-webkit-scrollbar {
              width: 6px;
            }
            
            .leaflet-popup-content::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 3px;
            }
            
            .leaflet-popup-content::-webkit-scrollbar-thumb {
              background: #888;
              border-radius: 3px;
            }
            
            .leaflet-popup-content::-webkit-scrollbar-thumb:hover {
              background: #555;
            }
          `}
        </style>
      </MapContainer>
    ) : (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%', 
        width: '100%',
        backgroundColor: '#f8f9fa'
      }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    )
  );  
};

export default Map;
