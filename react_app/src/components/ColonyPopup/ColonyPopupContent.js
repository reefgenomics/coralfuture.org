import React from 'react';

const filterValidData = (dataArray) => {
  if (!dataArray || !Array.isArray(dataArray)) return [];
  return dataArray.filter(
    (item) => item.timepoint && item.timepoint !== 'N/A' && item.timepoint !== 'null'
  );
};

const ColonyPopupContent = ({ colony }) => {
  const filteredThermalTolerances = filterValidData(colony.thermal_tolerances);
  const filteredBreakpointTemperatures = filterValidData(colony.breakpoint_temperatures);
  const filteredThermalLimits = filterValidData(colony.thermal_limits);

  return (
    <div style={{ maxWidth: '280px', maxHeight: '300px', overflow: 'auto' }}>
      <h5
        style={{
          marginBottom: '8px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          padding: '5px 0',
          zIndex: 1,
        }}
      >
        {colony.name}
      </h5>
      <div style={{ fontSize: '0.9rem' }}>
        <p style={{ margin: '2px 0' }}>
          <strong>ID:</strong> {colony.id}
        </p>
        <p style={{ margin: '2px 0' }}>
          <strong>Species:</strong> {colony.species}
        </p>
        <p style={{ margin: '2px 0' }}>
          <strong>Coordinates:</strong> {colony.latitude}, {colony.longitude}
        </p>

        {filteredThermalTolerances.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                fontWeight: 'bold',
                borderBottom: '1px solid #ccc',
                paddingBottom: '3px',
                fontSize: '0.9rem',
              }}
            >
              Thermal Tolerances (ED50)
            </div>
            <ul style={{ marginTop: '3px', paddingLeft: '15px', marginBottom: '5px' }}>
              {filteredThermalTolerances.map((tolerance, index) => (
                <li key={tolerance.id || `tolerance-${index}`} style={{ marginBottom: '5px' }}>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Abs. ED50:</strong> {tolerance.abs_thermal_tolerance}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Rel. ED50:</strong> {tolerance.rel_thermal_tolerance || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>MMM:</strong> {tolerance.sst_clim_mmm || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Condition:</strong> {tolerance.condition || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Timepoint:</strong> {tolerance.timepoint}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filteredBreakpointTemperatures.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                fontWeight: 'bold',
                borderBottom: '1px solid #ccc',
                paddingBottom: '3px',
                fontSize: '0.9rem',
              }}
            >
              Breakpoint Temperatures (ED5)
            </div>
            <ul style={{ marginTop: '3px', paddingLeft: '15px', marginBottom: '5px' }}>
              {filteredBreakpointTemperatures.map((breakpoint, index) => (
                <li key={breakpoint.id || `breakpoint-${index}`} style={{ marginBottom: '5px' }}>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Abs. ED5:</strong> {breakpoint.abs_breakpoint_temperature}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Rel. ED5:</strong> {breakpoint.rel_breakpoint_temperature || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>MMM:</strong> {breakpoint.sst_clim_mmm || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Condition:</strong> {breakpoint.condition || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Timepoint:</strong> {breakpoint.timepoint}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filteredThermalLimits.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                fontWeight: 'bold',
                borderBottom: '1px solid #ccc',
                paddingBottom: '3px',
                fontSize: '0.9rem',
              }}
            >
              Thermal Limits (ED95)
            </div>
            <ul style={{ marginTop: '3px', paddingLeft: '15px', marginBottom: '5px' }}>
              {filteredThermalLimits.map((limit, index) => (
                <li key={limit.id || `limit-${index}`} style={{ marginBottom: '5px' }}>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Abs. ED95:</strong> {limit.abs_thermal_limit}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Rel. ED95:</strong> {limit.rel_thermal_limit || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>MMM:</strong> {limit.sst_clim_mmm || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Condition:</strong> {limit.condition || 'N/A'}
                  </p>
                  <p style={{ margin: '1px 0', fontSize: '0.85rem' }}>
                    <strong>Timepoint:</strong> {limit.timepoint}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColonyPopupContent;
