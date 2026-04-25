import React from 'react';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Marker, Popup, LayerGroup } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';

import ColonyPopupContent from 'components/ColonyPopup/ColonyPopupContent';

const Markers = ({ colonies }) => {
  return (
    <LayerGroup>
      <MarkerClusterGroup>
        {colonies &&
          Array.isArray(colonies) &&
          colonies.map((colony) => (
            <Marker key={colony.id} position={[colony.latitude, colony.longitude]}>
              <Popup maxWidth="300">
                <ColonyPopupContent colony={colony} />
              </Popup>
            </Marker>
          ))}
      </MarkerClusterGroup>
    </LayerGroup>
  );
};

export default Markers;
