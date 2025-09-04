import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Row, Col, Card, Badge } from 'react-bootstrap';
import { Box, Slider, Divider } from '@mui/material';
import { ThermometerHalf, XCircle, PlusCircle, ArrowLeft } from 'react-bootstrap-icons';
import 'bootstrap/dist/css/bootstrap.min.css';
import './TemperatureFiltersModal.css';

const TemperatureFiltersModal = ({ show, onHide, filters, onAddFilters }) => {
  // State for all temperature parameters
  const [tempFilters, setTempFilters] = useState({
    // Thermal Tolerance (TT)
    absThermalTolerance: [20, 40],
    relThermalTolerance: [0, 10],
    ed50: [20, 40],
    ed50Mmm: [0, 10],
    
    // Breakpoint Temperature (BT)
    absBreakpointTemperature: [20, 40],
    relBreakpointTemperature: [0, 10],
    ed5: [20, 40],
    ed5Mmm: [0, 10],
    
    // Thermal Limit (TL)
    absThermalLimit: [20, 40],
    relThermalLimit: [0, 10],
    ed95: [20, 40],
    ed95Mmm: [0, 10],
  });

  // State for min/max values from API
  const [minMaxValues, setMinMaxValues] = useState({
    absThermalTolerance: { min: 20, max: 40 },
    relThermalTolerance: { min: 0, max: 10 },
    ed50: { min: 20, max: 40 },
    ed50Mmm: { min: 0, max: 10 },
    absBreakpointTemperature: { min: 20, max: 40 },
    relBreakpointTemperature: { min: 0, max: 10 },
    ed5: { min: 20, max: 40 },
    ed5Mmm: { min: 0, max: 10 },
    absThermalLimit: { min: 20, max: 40 },
    relThermalLimit: { min: 0, max: 10 },
    ed95: { min: 20, max: 40 },
    ed95Mmm: { min: 0, max: 10 },
  });

  // State for active filters count
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const fetchMinMaxData = useCallback(async () => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    
    try {
      // Fetch all temperature ranges
      const [ttResponse, btResponse, tlResponse] = await Promise.all([
        fetch(`${backendUrl}/api/public/thermal-tolerances/max-min/`),
        fetch(`${backendUrl}/api/public/breakpoint-temperatures/max-min/`),
        fetch(`${backendUrl}/api/public/thermal-limits/max-min/`)
      ]);

      const ttData = await ttResponse.json();
      const btData = await btResponse.json();
      const tlData = await tlResponse.json();

      const newMinMaxValues = {
        absThermalTolerance: {
          min: ttData.min_abs_thermal_tolerance || 20,
          max: ttData.max_abs_thermal_tolerance || 40
        },
        relThermalTolerance: {
          min: ttData.min_rel_thermal_tolerance || 0,
          max: ttData.max_rel_thermal_tolerance || 10
        },
        ed50: {
          min: ttData.min_ed50 || 20,
          max: ttData.max_ed50 || 40
        },
        ed50Mmm: {
          min: ttData.min_ed50_mmm || 0,
          max: ttData.max_ed50_mmm || 10
        },
        absBreakpointTemperature: {
          min: btData.min_abs_breakpoint_temperature || 20,
          max: btData.max_abs_breakpoint_temperature || 40
        },
        relBreakpointTemperature: {
          min: btData.min_rel_breakpoint_temperature || 0,
          max: btData.max_rel_breakpoint_temperature || 10
        },
        ed5: {
          min: btData.min_ed5 || 20,
          max: btData.max_ed5 || 40
        },
        ed5Mmm: {
          min: btData.min_ed5_mmm || 0,
          max: btData.max_ed5_mmm || 10
        },
        absThermalLimit: {
          min: tlData.min_abs_thermal_limit || 20,
          max: tlData.max_abs_thermal_limit || 40
        },
        relThermalLimit: {
          min: tlData.min_rel_thermal_limit || 0,
          max: tlData.max_rel_thermal_limit || 10
        },
        ed95: {
          min: tlData.min_ed95 || 20,
          max: tlData.max_ed95 || 40
        },
        ed95Mmm: {
          min: tlData.min_ed95_mmm || 0,
          max: tlData.max_ed95_mmm || 10
        }
      };

      setMinMaxValues(newMinMaxValues);

      // Don't update tempFilters here - they should be preserved from the filters prop
      // Only set defaults if no filters were provided
      if (!filters || Object.keys(filters).length === 0) {
        console.log('Modal: no filters provided, setting defaults from API');
        setTempFilters({
          absThermalTolerance: [newMinMaxValues.absThermalTolerance.min, newMinMaxValues.absThermalTolerance.max],
          relThermalTolerance: [newMinMaxValues.relThermalTolerance.min, newMinMaxValues.relThermalTolerance.max],
          ed50: [newMinMaxValues.ed50.min, newMinMaxValues.ed50.max],
          ed50Mmm: [newMinMaxValues.ed50Mmm.min, newMinMaxValues.ed50Mmm.max],
          absBreakpointTemperature: [newMinMaxValues.absBreakpointTemperature.min, newMinMaxValues.absBreakpointTemperature.max],
          relBreakpointTemperature: [newMinMaxValues.relBreakpointTemperature.min, newMinMaxValues.relBreakpointTemperature.max],
          ed5: [newMinMaxValues.ed5.min, newMinMaxValues.ed5.max],
          ed5Mmm: [newMinMaxValues.ed5Mmm.min, newMinMaxValues.ed5Mmm.max],
          absThermalLimit: [newMinMaxValues.absThermalLimit.min, newMinMaxValues.absThermalLimit.max],
          relThermalLimit: [newMinMaxValues.relThermalLimit.min, newMinMaxValues.relThermalLimit.max],
          ed95: [newMinMaxValues.ed95.min, newMinMaxValues.ed95.max],
          ed95Mmm: [newMinMaxValues.ed95Mmm.min, newMinMaxValues.ed95Mmm.max],
        });
      } else {
        console.log('Modal: filters provided, preserving them');
      }
    } catch (error) {
      console.error('Error fetching temperature ranges:', error);
    }
  }, [filters]);

  useEffect(() => {
    if (show) {
      fetchMinMaxData();
      // Always start with full range (no filters active)
      setTempFilters({
        absThermalTolerance: [minMaxValues.absThermalTolerance.min, minMaxValues.absThermalTolerance.max],
        relThermalTolerance: [minMaxValues.relThermalTolerance.min, minMaxValues.relThermalTolerance.max],
        ed50: [minMaxValues.ed50.min, minMaxValues.ed50.max],
        ed50Mmm: [minMaxValues.ed50Mmm.min, minMaxValues.ed50Mmm.max],
        absBreakpointTemperature: [minMaxValues.absBreakpointTemperature.min, minMaxValues.absBreakpointTemperature.max],
        relBreakpointTemperature: [minMaxValues.relBreakpointTemperature.min, minMaxValues.relBreakpointTemperature.max],
        ed5: [minMaxValues.ed5.min, minMaxValues.ed5.max],
        ed5Mmm: [minMaxValues.ed5Mmm.min, minMaxValues.ed5Mmm.max],
        absThermalLimit: [minMaxValues.absThermalLimit.min, minMaxValues.absThermalLimit.max],
        relThermalLimit: [minMaxValues.relThermalLimit.min, minMaxValues.relThermalLimit.max],
        ed95: [minMaxValues.ed95.min, minMaxValues.ed95.max],
        ed95Mmm: [minMaxValues.ed95Mmm.min, minMaxValues.ed95Mmm.max],
      });
    }
  }, [show, fetchMinMaxData]);

  useEffect(() => {
    // Calculate active filters count
    let count = 0;
    Object.entries(tempFilters).forEach(([key, value]) => {
      const minMax = minMaxValues[key];
      if (value[0] !== minMax.min || value[1] !== minMax.max) {
        count++;
      }
    });
    setActiveFiltersCount(count);
  }, [tempFilters, minMaxValues]);

  const handleSliderChange = (parameter, newValue) => {
    setTempFilters(prev => ({
      ...prev,
      [parameter]: newValue
    }));
  };

  const handleResetAll = () => {
    setTempFilters({
      absThermalTolerance: [minMaxValues.absThermalTolerance.min, minMaxValues.absThermalTolerance.max],
      relThermalTolerance: [minMaxValues.relThermalTolerance.min, minMaxValues.relThermalTolerance.max],
      ed50: [minMaxValues.ed50.min, minMaxValues.ed50.max],
      ed50Mmm: [minMaxValues.ed50Mmm.min, minMaxValues.ed50Mmm.max],
      absBreakpointTemperature: [minMaxValues.absBreakpointTemperature.min, minMaxValues.absBreakpointTemperature.max],
      relBreakpointTemperature: [minMaxValues.relBreakpointTemperature.min, minMaxValues.relBreakpointTemperature.max],
      ed5: [minMaxValues.ed5.min, minMaxValues.ed5.max],
      ed5Mmm: [minMaxValues.ed5Mmm.min, minMaxValues.ed5Mmm.max],
      absThermalLimit: [minMaxValues.absThermalLimit.min, minMaxValues.absThermalLimit.max],
      relThermalLimit: [minMaxValues.relThermalLimit.min, minMaxValues.relThermalLimit.max],
      ed95: [minMaxValues.ed95.min, minMaxValues.ed95.max],
      ed95Mmm: [minMaxValues.ed95Mmm.min, minMaxValues.ed95Mmm.max],
    });
  };

  const handleAddFilters = () => {
    onAddFilters(tempFilters);
    onHide();
  };

  const isFilterActive = (parameter) => {
    const value = tempFilters[parameter];
    const minMax = minMaxValues[parameter];
    // Filter is active if it's different from the full range (min to max)
    return value[0] !== minMax.min || value[1] !== minMax.max;
  };

  const renderTemperatureSlider = (parameter, label, unit = '°C', icon = null) => {
    const value = tempFilters[parameter];
    const minMax = minMaxValues[parameter];
    const isActive = isFilterActive(parameter);

    return (
      <Card 
        key={parameter}
        className={`mb-4 ${isActive ? 'border-primary shadow-sm' : 'border-light'}`}
        style={{ 
          boxShadow: isActive ? '0 0 0 2px #007bff' : 'none',
          transition: 'all 0.3s ease',
          borderRadius: '12px'
        }}
      >
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center">
              {icon && <span className="me-2 text-primary">{icon}</span>}
              <h6 className={`mb-0 fw-semibold ${isActive ? 'text-primary' : 'text-dark'}`}>
                {label}
              </h6>
            </div>
            {isActive && (
              <Badge bg="primary" className="fs-6 px-3 py-2">Active</Badge>
            )}
          </div>
          
          <Box sx={{ px: 1, mb: 3 }}>
            <Slider
              value={value}
              onChange={(event, newValue) => handleSliderChange(parameter, newValue)}
              valueLabelDisplay="auto"
              min={minMax.min}
              max={minMax.max}
              step={0.01}
              sx={{
                '& .MuiSlider-thumb': {
                  color: isActive ? '#007bff' : '#6c757d',
                  width: 24,
                  height: 24,
                  boxShadow: isActive ? '0 0 0 4px rgba(0, 123, 255, 0.2)' : 'none',
                },
                '& .MuiSlider-track': {
                  height: 10,
                  backgroundColor: isActive ? '#007bff' : '#6c757d',
                  borderRadius: 5,
                },
                '& .MuiSlider-rail': {
                  height: 8,
                  backgroundColor: '#e9ecef',
                  borderRadius: 4,
                },
                '& .MuiSlider-valueLabel': {
                  backgroundColor: isActive ? '#007bff' : '#6c757d',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                },
              }}
            />
          </Box>
          
          <div className="row text-center mb-3">
            <div className="col-6">
              <div className="p-2 bg-light rounded">
                <small className="text-muted d-block">Min</small>
                <span className="fw-semibold text-primary">{value[0].toFixed(2)}{unit}</span>
              </div>
            </div>
            <div className="col-6">
              <div className="p-2 bg-light rounded">
                <small className="text-muted d-block">Max</small>
                <span className="fw-semibold text-primary">{value[1].toFixed(2)}{unit}</span>
              </div>
            </div>
          </div>
          
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Range: {minMax.min.toFixed(2)} - {minMax.max.toFixed(2)}{unit}
            </small>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => handleSliderChange(parameter, [minMax.min, minMax.max])}
              className="btn-sm px-3"
            >
              Reset
            </Button>
          </div>
        </Card.Body>
      </Card>
    );
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      centered
      className="temperature-filters-modal"
    >
      <Modal.Header className="bg-primary text-white border-0 d-flex justify-content-between align-items-center">
        <Modal.Title className="d-flex align-items-center">
          <ThermometerHalf className="me-3" size={24} />
          <div>
            <div className="fw-bold">Temperature Filters</div>
            <small className="opacity-75">Configure temperature ranges for filtering coral colonies</small>
          </div>
          {activeFiltersCount > 0 && (
            <Badge bg="light" text="primary" className="ms-3 fs-6">
              {activeFiltersCount} active
            </Badge>
          )}
        </Modal.Title>
        <Button variant="link" onClick={onHide} className="text-white p-0 ms-auto">
          <XCircle size={28} />
        </Button>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="p-4 bg-light border-bottom">
          <p className="text-muted mb-0">
            Adjust the sliders to set minimum and maximum values for each temperature parameter. 
            Only modified ranges will be applied as filters.
          </p>
        </div>

        <div className="p-4">
          {/* Thermal Tolerance Section */}
          <div className="mb-5">
            <div className="d-flex align-items-center mb-4">
              <div className="bg-primary bg-opacity-10 p-2 rounded me-3">
                <ThermometerHalf size={20} className="text-primary" />
              </div>
              <h5 className="mb-0 text-primary fw-bold">Thermal Tolerance (TT)</h5>
            </div>
            <Row>
              <Col lg={6}>
                {renderTemperatureSlider('absThermalTolerance', 'Absolute Thermal Tolerance', '°C')}
              </Col>
              <Col lg={6}>
                {renderTemperatureSlider('relThermalTolerance', 'Relative Thermal Tolerance', '°C')}
              </Col>
            </Row>
            <Row>
              <Col lg={6}>
                {renderTemperatureSlider('ed50', 'Absolute Thermal Tolerance: ED50', '°C')}
              </Col>
              <Col lg={6}>
                {renderTemperatureSlider('ed50Mmm', 'Relative Thermal Tolerance: ED50-MMM', '°C')}
              </Col>
            </Row>
          </div>

          <Divider className="my-4" />

          {/* Breakpoint Temperature Section */}
          <div className="mb-5">
            <div className="d-flex align-items-center mb-4">
              <div className="bg-success bg-opacity-10 p-2 rounded me-3">
                <ThermometerHalf size={20} className="text-success" />
              </div>
              <h5 className="mb-0 text-success fw-bold">Breakpoint Temperature (BT)</h5>
            </div>
            <Row>
              <Col lg={6}>
                {renderTemperatureSlider('absBreakpointTemperature', 'Absolute Breakpoint Temperature', '°C')}
              </Col>
              <Col lg={6}>
                {renderTemperatureSlider('relBreakpointTemperature', 'Relative Breakpoint Temperature', '°C')}
              </Col>
            </Row>
            <Row>
              <Col lg={6}>
                {renderTemperatureSlider('ed5', 'Breakpoint Temperature: ED5', '°C')}
              </Col>
              <Col lg={6}>
                {renderTemperatureSlider('ed5Mmm', 'Relative Breakpoint Temperature: ED5-MMM', '°C')}
              </Col>
            </Row>
          </div>

          <Divider className="my-4" />

          {/* Thermal Limit Section */}
          <div className="mb-4">
            <div className="d-flex align-items-center mb-4">
              <div className="bg-warning bg-opacity-10 p-2 rounded me-3">
                <ThermometerHalf size={20} className="text-warning" />
              </div>
              <h5 className="mb-0 text-warning fw-bold">Thermal Limit (TL)</h5>
            </div>
            <Row>
              <Col lg={6}>
                {renderTemperatureSlider('absThermalLimit', 'Absolute Thermal Limit', '°C')}
              </Col>
              <Col lg={6}>
                {renderTemperatureSlider('relThermalLimit', 'Relative Thermal Limit', '°C')}
              </Col>
            </Row>
            <Row>
              <Col lg={6}>
                {renderTemperatureSlider('ed95', 'Thermal Limit: ED95', '°C')}
              </Col>
              <Col lg={6}>
                {renderTemperatureSlider('ed95Mmm', 'Relative Thermal Limit: ED95-MMM', '°C')}
              </Col>
            </Row>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="bg-light border-0 p-4">
        <div className="d-flex justify-content-between w-100">
          <Button 
            variant="outline-secondary" 
            onClick={handleResetAll}
            className="d-flex align-items-center px-4"
          >
            <ArrowLeft className="me-2" size={16} />
            Reset All
          </Button>
          
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={onHide} className="px-4">
              Cancel
            </Button>
            <Button 
              variant="success" 
              onClick={handleAddFilters}
              className="d-flex align-items-center px-4"
              disabled={activeFiltersCount === 0}
            >
              <PlusCircle className="me-2" size={16} />
              Add Filters
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default TemperatureFiltersModal;
