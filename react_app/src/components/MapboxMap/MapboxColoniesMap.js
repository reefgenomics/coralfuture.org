import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import mapboxgl from 'mapbox-gl';
import { Spinner } from 'react-bootstrap';
import 'mapbox-gl/dist/mapbox-gl.css';
import { SidebarFilterContext } from 'contexts/SidebarFilterContext';
import ColonyPopupContent from 'components/ColonyPopup/ColonyPopupContent';
import MapLayersPanel from 'components/MapboxMap/MapLayersPanel';
import filterColonies from 'utils/filterColonies';

const MAP_STYLE = 'mapbox://styles/coralfuture/cmo6t7qf1002501qvf0s391hi';

const BENTHIC_TILESET_URL =
  process.env.REACT_APP_BENTHIC_TILESET_URL || 'mapbox://coralfuture.benthic_cio';
const BENTHIC_SOURCE_LAYER =
  process.env.REACT_APP_BENTHIC_SOURCE_LAYER || 'benthic_from_gpkg.geojson';
const BENTHIC_SOURCE_ID = 'benthic-tiles';
const BENTHIC_FILL_LAYER_ID = 'benthic-fill';
const BENTHIC_LINE_LAYER_ID = 'benthic-outline';

/** Tileset covers this area; tiles are generated from zoom ~10 (see TileJSON). */
const BENTHIC_BOUNDS_SW = [71.23029327392578, -7.44793176651001];
const BENTHIC_BOUNDS_NE = [73.77342224121094, 12.40303897857666];

function getLayerInsertBeforeId(map) {
  const layers = map.getStyle()?.layers;
  if (!layers?.length) return undefined;
  const sym = layers.find((l) => l.type === 'symbol');
  if (sym?.id) return sym.id;
  const circle = layers.find((l) => l.type === 'circle');
  return circle?.id;
}

const SOURCE_ID = 'colonies';
const CLUSTER_LAYER_ID = 'colonies-clusters';
const CLUSTER_COUNT_LAYER_ID = 'colonies-cluster-count';
const UNCLUSTERED_LAYER_ID = 'colonies-unclustered';

/** Mapbox global terrain DEM — gives real elevation when map is pitched. */
const TERRAIN_DEM_SOURCE_ID = 'mapbox-terrain-dem';

function addTerrainAndSky(map) {
  try {
    if (!map.getTerrain()) {
      if (!map.getSource(TERRAIN_DEM_SOURCE_ID)) {
        map.addSource(TERRAIN_DEM_SOURCE_ID, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({
        source: TERRAIN_DEM_SOURCE_ID,
        exaggeration: 1.25,
      });
    }
  } catch (err) {
    console.warn('Map terrain not available:', err);
  }

  try {
    if (!map.getLayer('sky-atmosphere')) {
      map.addLayer({
        id: 'sky-atmosphere',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun-intensity': 12,
        },
      });
    }
  } catch (err) {
    console.warn('Sky layer not added:', err);
  }
}

const coloniesToGeoJSON = (colonies) => ({
  type: 'FeatureCollection',
  features: colonies.map((c) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [c.longitude, c.latitude],
    },
    properties: {
      colonyId: c.id,
    },
  })),
});

const MapboxColoniesMap = ({ focusBenthicRegion = false }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const coloniesByIdRef = useRef(new Map());
  const filteredColoniesRef = useRef([]);
  const initialCenterPlaced = useRef(false);

  const { allColonies, filters, filteredColonies, setFilteredColonies, defaultValues } =
    useContext(SidebarFilterContext);

  const [mapCenter, setMapCenter] = useState(null);
  const [benthicVisible, setBenthicVisible] = useState(true);
  const [coloniesVisible, setColoniesVisible] = useState(true);

  useEffect(() => {
    if (allColonies && allColonies.length > 0) {
      let dataToSet = allColonies;
      if (filters && Object.keys(filters).length > 0) {
        dataToSet = filterColonies(filters, allColonies, defaultValues);
      }
      if (dataToSet.length > 0 && !initialCenterPlaced.current) {
        if (focusBenthicRegion) {
          const lat = (BENTHIC_BOUNDS_SW[1] + BENTHIC_BOUNDS_NE[1]) / 2;
          const lng = (BENTHIC_BOUNDS_SW[0] + BENTHIC_BOUNDS_NE[0]) / 2;
          setMapCenter([lat, lng]);
        } else {
          const avgLat =
            dataToSet.reduce((sum, marker) => sum + marker.latitude, 0) / dataToSet.length;
          const avgLng =
            dataToSet.reduce((sum, marker) => sum + marker.longitude, 0) / dataToSet.length;
          setMapCenter([avgLat, avgLng]);
        }
        initialCenterPlaced.current = true;
      }
      setFilteredColonies(dataToSet);
    }
  }, [filters, allColonies, setFilteredColonies, focusBenthicRegion]);

  useEffect(() => {
    filteredColoniesRef.current = filteredColonies;
  }, [filteredColonies]);

  useEffect(() => {
    coloniesByIdRef.current = new Map(filteredColonies.map((c) => [c.id, c]));
  }, [filteredColonies]);

  const fitMapToColonies = useCallback((map, colonies) => {
    if (!colonies.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    colonies.forEach((c) => bounds.extend([c.longitude, c.latitude]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 500 });
  }, []);

  const syncColonySource = useCallback(
    (map, colonies, withFit = true) => {
      const source = map.getSource(SOURCE_ID);
      if (!source) return;
      source.setData(coloniesToGeoJSON(colonies));
      if (withFit) fitMapToColonies(map, colonies);
    },
    [fitMapToColonies]
  );

  useEffect(() => {
    if (!mapCenter || !containerRef.current) return;

    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [mapCenter[1], mapCenter[0]],
      zoom: focusBenthicRegion ? 10.5 : 3,
      attributionControl: true,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    mapRef.current = map;

    map.on('load', () => {
      addTerrainAndSky(map);

      const insertBefore = getLayerInsertBeforeId(map);

      map.addSource(BENTHIC_SOURCE_ID, {
        type: 'vector',
        url: BENTHIC_TILESET_URL,
      });

      map.addLayer(
        {
          id: BENTHIC_FILL_LAYER_ID,
          type: 'fill',
          source: BENTHIC_SOURCE_ID,
          'source-layer': BENTHIC_SOURCE_LAYER,
          minzoom: 10,
          paint: {
            'fill-antialias': true,
            'fill-color': [
              'match',
              ['get', 'class'],
              'Coral/Algae',
              '#0d9488',
              'Seagrass',
              '#15803d',
              'Sand',
              '#e8d5c4',
              'Rock',
              '#57534e',
              'Rubble',
              '#b45309',
              'Microalgal Mats',
              '#4d7c0f',
              '#64748b',
            ],
            'fill-opacity': 0.62,
          },
        },
        insertBefore
      );

      map.addLayer(
        {
          id: BENTHIC_LINE_LAYER_ID,
          type: 'line',
          source: BENTHIC_SOURCE_ID,
          'source-layer': BENTHIC_SOURCE_LAYER,
          minzoom: 10,
          paint: {
            'line-color': '#ffffff',
            'line-opacity': 0.45,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 14, 1.4],
          },
        },
        insertBefore
      );

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: coloniesToGeoJSON(filteredColoniesRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            10,
            '#f1f075',
            30,
            '#f28cb1',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 30, 26],
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
      });

      map.addLayer({
        id: UNCLUSTERED_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#11b4da',
          'circle-radius': 8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });

      map.on('click', CLUSTER_LAYER_ID, (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER_ID] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        const src = map.getSource(SOURCE_ID);
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom,
          });
        });
      });

      map.on('click', UNCLUSTERED_LAYER_ID, (e) => {
        if (popupRef.current) {
          popupRef.current.remove();
        }
        const coordinates = e.features[0].geometry.coordinates.slice();
        const colonyId = e.features[0].properties.colonyId;
        const colony = coloniesByIdRef.current.get(colonyId);
        if (!colony) return;

        while (Math.abs(coordinates[0]) > 180) {
          coordinates[0] += coordinates[0] > 180 ? -360 : 360;
        }

        const html = renderToString(<ColonyPopupContent colony={colony} />);
        popupRef.current = new mapboxgl.Popup({ maxWidth: '480px' })
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseenter', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', UNCLUSTERED_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', UNCLUSTERED_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      const colonySrc = map.getSource(SOURCE_ID);
      if (colonySrc) {
        colonySrc.setData(coloniesToGeoJSON(filteredColoniesRef.current));
      }
      if (!focusBenthicRegion) {
        fitMapToColonies(map, filteredColoniesRef.current);
      } else {
        map.fitBounds([BENTHIC_BOUNDS_SW, BENTHIC_BOUNDS_NE], {
          padding: 52,
          maxZoom: 11.5,
          duration: 900,
        });
      }
    });

    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [mapCenter, fitMapToColonies, focusBenthicRegion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    const source = map.getSource(SOURCE_ID);
    if (!source) return;
    syncColonySource(map, filteredColonies, true);
  }, [filteredColonies, syncColonySource]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.loaded()) return;
    const vis = benthicVisible ? 'visible' : 'none';
    if (map.getLayer(BENTHIC_FILL_LAYER_ID)) {
      map.setLayoutProperty(BENTHIC_FILL_LAYER_ID, 'visibility', vis);
    }
    if (map.getLayer(BENTHIC_LINE_LAYER_ID)) {
      map.setLayoutProperty(BENTHIC_LINE_LAYER_ID, 'visibility', vis);
    }
  }, [benthicVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.loaded()) return;
    const vis = coloniesVisible ? 'visible' : 'none';
    [CLUSTER_LAYER_ID, CLUSTER_COUNT_LAYER_ID, UNCLUSTERED_LAYER_ID].forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', vis);
      }
    });
  }, [coloniesVisible]);

  return mapCenter ? (
    <>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
      <MapLayersPanel
        benthicVisible={benthicVisible}
        onBenthicVisibleChange={setBenthicVisible}
        coloniesVisible={coloniesVisible}
        onColoniesVisibleChange={setColoniesVisible}
      />
    </>
  ) : (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        backgroundColor: '#f8f9fa',
      }}
    >
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    </div>
  );
};

export default MapboxColoniesMap;
