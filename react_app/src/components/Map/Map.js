// External imports
import React, { useEffect, useState, useContext } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
import { SidebarFilterContext } from 'contexts/SidebarFilterContext'
import Markers from 'components/Markers/Markers';
import { BenthicTilesetsInViewport } from 'components/Tiles/BenthicTileLayer';
import { BASEMAPS } from 'components/Tiles/basemaps';
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

const Map = ({ basemap = 'imagery', benthicVisible = true, benthicClasses = {} }) => {
  const { allColonies, filters, filteredColonies, setFilteredColonies, defaultValues } = useContext(SidebarFilterContext);
  const [mapCenter, setMapCenter] = useState(null);
  const basemapConfig = BASEMAPS[basemap] || BASEMAPS.imagery;
  
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
        <TileLayer
          key={basemap}
          url={basemapConfig.url}
          attribution={basemapConfig.attribution}
          maxNativeZoom={basemapConfig.maxNativeZoom}
        />
        {benthicVisible && (
          <BenthicTilesetsInViewport benthicClasses={benthicClasses} />
        )}
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

            .tile-legend {
              position: absolute;
              right: 10px;
              bottom: 24px;
              z-index: 500;
              padding: 12px 14px;
              min-width: 180px;
              background: rgba(255, 255, 255, 0.94);
              border-radius: 14px;
              box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
              border: 1px solid rgba(148, 163, 184, 0.28);
              color: #0f172a;
              font-size: 0.82rem;
              backdrop-filter: blur(10px);
            }

            .tile-legend-title {
              margin-bottom: 8px;
              color: #0f766e;
              font-weight: 800;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              font-size: 0.72rem;
            }

            .tile-legend-item {
              display: flex;
              align-items: center;
              gap: 8px;
              margin: 5px 0;
              white-space: nowrap;
            }

            .tile-legend-swatch {
              width: 14px;
              height: 14px;
              flex: 0 0 14px;
              border-radius: 4px;
              border: 1px solid rgba(15, 23, 42, 0.18);
              box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.38);
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
