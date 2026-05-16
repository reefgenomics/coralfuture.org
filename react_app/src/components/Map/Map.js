import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerMapLibreMap from 'components/MapLibre/CustomerMapLibreMap';
import { SidebarFilterContext } from 'contexts/SidebarFilterContext';
import filterColonies from 'utils/filterColonies';
import { Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const Map = ({
  basemap = 'imagery',
  captionsVisible = true,
  benthicVisible = true,
  benthicClasses = {},
  reefExtentVisible = false,
  reefExtentClasses = {},
  bleachingVisible = false,
  bleachingYear = 2005,
  bleachingObservationsGeoJson = null,
  onBleachingObservationClick,
}) => {
  const { allColonies, filters, setFilteredColonies, defaultValues } =
    useContext(SidebarFilterContext);
  const [ready, setReady] = useState(false);
  const [searchParams] = useSearchParams();

  const computedColonies = useMemo(() => {
    if (!allColonies || allColonies.length === 0) return [];
    if (filters && Object.keys(filters).length > 0) {
      return filterColonies(filters, allColonies, defaultValues);
    }
    return allColonies;
  }, [allColonies, filters, defaultValues]);

  const focusTarget = useMemo(() => {
    const colonyParam = searchParams.get('colony');
    const lngParam = searchParams.get('lng');
    const latParam = searchParams.get('lat');
    const zoomParam = searchParams.get('zoom');
    const colonyId = colonyParam ? Number(colonyParam) : NaN;
    const lng = lngParam ? Number(lngParam) : NaN;
    const lat = latParam ? Number(latParam) : NaN;
    const zoom = zoomParam ? Number(zoomParam) : 12;
    const colonies = Array.isArray(allColonies) ? allColonies : [];
    const colony = Number.isFinite(colonyId)
      ? colonies.find((item) => item.id === colonyId)
      : null;

    const targetLng = Number.isFinite(lng) ? lng : colony?.longitude;
    const targetLat = Number.isFinite(lat) ? lat : colony?.latitude;
    if (!Number.isFinite(targetLng) || !Number.isFinite(targetLat)) return null;

    return {
      key: `${colonyId || 'point'}-${targetLng}-${targetLat}-${zoom}`,
      colony,
      coordinates: [targetLng, targetLat],
      zoom: Number.isFinite(zoom) ? zoom : 12,
    };
  }, [allColonies, searchParams]);

  useEffect(() => {
    if (!allColonies || allColonies.length === 0) {
      setReady(false);
      return;
    }
    setFilteredColonies(computedColonies);
    setReady(true);
  }, [allColonies, computedColonies, setFilteredColonies]);

  if (!ready) {
    return (
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
  }

  return (
    <CustomerMapLibreMap
      basemap={basemap}
      captionsVisible={captionsVisible}
      benthicVisible={benthicVisible}
      benthicClasses={benthicClasses}
      reefExtentVisible={reefExtentVisible}
      reefExtentClasses={reefExtentClasses}
      bleachingVisible={bleachingVisible}
      bleachingYear={bleachingYear}
      bleachingObservationsGeoJson={bleachingObservationsGeoJson}
      onBleachingObservationClick={onBleachingObservationClick}
      colonies={computedColonies}
      focusTarget={focusTarget}
    />
  );
};

export default Map;
