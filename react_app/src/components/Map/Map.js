import React, { useContext, useEffect, useMemo, useState } from 'react';
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
}) => {
  const { allColonies, filters, filteredColonies, setFilteredColonies, defaultValues } =
    useContext(SidebarFilterContext);
  const [ready, setReady] = useState(false);

  const computedColonies = useMemo(() => {
    if (!allColonies || allColonies.length === 0) return [];
    if (filters && Object.keys(filters).length > 0) {
      return filterColonies(filters, allColonies, defaultValues);
    }
    return allColonies;
  }, [allColonies, filters, defaultValues]);

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
      colonies={computedColonies}
    />
  );
};

export default Map;
