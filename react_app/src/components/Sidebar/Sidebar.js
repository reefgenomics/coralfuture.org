// External imports
import React, { useEffect, useState, useContext } from 'react';
import { Button, Form, FormGroup, Row, Col, Card } from 'react-bootstrap';
import { Box, Slider } from '@mui/material';
import { ThermometerHalf } from 'react-bootstrap-icons';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'react-range-slider-input/dist/style.css';
import './Sidebar.css';
// Internal imports
// Contexts
import { SidebarFilterContext } from 'contexts/SidebarFilterContext';
// Components
import AddToCartButton from 'components/Button/AddToCart';
import { DEFAULT_BENTHIC_CLASS_COLORS } from 'components/Tiles/BenthicTileLayer';
import { BASEMAPS } from 'components/Tiles/basemaps';
import TemperatureFiltersModal from './TemperatureFiltersModal';

const InputSidebar = ({
  basemap = 'imagery',
  onBasemapChange,
  captionsVisible = true,
  onCaptionsVisibleChange,
  benthicVisible = true,
  onBenthicVisibleChange,
  benthicClasses = {},
  onBenthicClassesChange,
}) => {

  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  
  // State for temperature filters modal
  const [showTemperatureModal, setShowTemperatureModal] = useState(false);
  const [activeTab, setActiveTab] = useState('filters');
  
  
  // Get all Colonies and Projects from Context and define list of species
  const { allColonies, allProjects, filters, setFilters, defaultValues } = useContext(SidebarFilterContext);
  const speciesList = [...new Set(allColonies.map(allColonies => allColonies.species))].sort();
  const projectList = [...new Set(allProjects.map(allProjects => allProjects.name))].sort();

  useEffect(() => {
    setSelectedSpecies(filters.species || '');
    setSelectedProject(filters.project || '');
    setSelectedDates(Array.isArray(filters.years) ? filters.years : []);
  }, [filters.species, filters.project, filters.years]);

  // Extract temperature filters from global filters
  const temperatureFilters = {
    absThermalTolerance: filters.absThermalTolerance,
    relThermalTolerance: filters.relThermalTolerance,
    ed50: filters.ed50,
    ed50Mmm: filters.ed50Mmm,
    absBreakpointTemperature: filters.absBreakpointTemperature,
    relBreakpointTemperature: filters.relBreakpointTemperature,
    ed5: filters.ed5,
    ed5Mmm: filters.ed5Mmm,
    absThermalLimit: filters.absThermalLimit,
    relThermalLimit: filters.relThermalLimit,
    ed95: filters.ed95,
    ed95Mmm: filters.ed95Mmm,
  };

  // Check if any filters are actually applied
  const hasSpeciesFilter = selectedSpecies !== '';
  const hasProjectFilter = selectedProject !== '';
  const hasDateFilter = selectedDates.length > 0;
  
  // Check if temperature filters are set
  const hasTemperatureFilters = Object.values(temperatureFilters).some(value => value !== undefined);
  
  // Check if main sliders are active
  const hasAbsThermalToleranceFilter = filters.absThermalTolerance && defaultValues.absThermalTolerance && (filters.absThermalTolerance[0] !== defaultValues.absThermalTolerance.min || filters.absThermalTolerance[1] !== defaultValues.absThermalTolerance.max);
  const hasAbsBreakpointTemperatureFilter = filters.absBreakpointTemperature && defaultValues.absBreakpointTemperature && (filters.absBreakpointTemperature[0] !== defaultValues.absBreakpointTemperature.min || filters.absBreakpointTemperature[1] !== defaultValues.absBreakpointTemperature.max);
  const hasAbsThermalLimitFilter = filters.absThermalLimit && defaultValues.absThermalLimit && (filters.absThermalLimit[0] !== defaultValues.absThermalLimit.min || filters.absThermalLimit[1] !== defaultValues.absThermalLimit.max);

  const activeFiltersCount = (hasSpeciesFilter ? 1 : 0) + 
                           (hasProjectFilter ? 1 : 0) + 
                           (hasDateFilter ? 1 : 0) + 
                           (hasAbsThermalToleranceFilter ? 1 : 0) +
                           (hasAbsBreakpointTemperatureFilter ? 1 : 0) +
                           (hasAbsThermalLimitFilter ? 1 : 0);

  // State to control sidebar visibility
  const [isCollapsed, setIsCollapsed] = useState(false);


  // Handle slider changes
  const handleSliderChange = (parameter, newValue) => {
    setFilters(prev => ({
      ...prev,
      [parameter]: newValue
    }));
  };



  const handleApplyFilters = () => {
    // If no filters are applied, clear all filters
    if (!hasSpeciesFilter && !hasProjectFilter && !hasDateFilter && !hasAbsThermalToleranceFilter && !hasAbsBreakpointTemperatureFilter && !hasAbsThermalLimitFilter) {
      setFilters({});
      return;
    }

    const newFilters = {
      species: selectedSpecies,
      project: selectedProject,
      years: selectedDates,
      // Keep existing temperature filters from global state
      ...temperatureFilters,
      // Add main slider filters
      absThermalTolerance: filters.absThermalTolerance,
      absBreakpointTemperature: filters.absBreakpointTemperature,
      absThermalLimit: filters.absThermalLimit
    };
    
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setSelectedSpecies('');
    setSelectedProject('');
    setSelectedDates([]);
    setFilters({});
  };

  const handleSpeciesChange = (e) => {
    setSelectedSpecies(e.target.value);
    console.log('Selected species:', e.target.value);
  };

  const handleProjectChange = (e) => {
    const newProject = e.target.value;
    setSelectedProject(newProject);
    console.log('Selected project:', newProject);
    
    // Auto-apply filters when project is selected
    const newFilters = {
      species: selectedSpecies,
      project: newProject,
      years: selectedDates,
      // Keep existing temperature filters from global state
      ...temperatureFilters,
      // Add main slider filters
      absThermalTolerance: filters.absThermalTolerance,
      absBreakpointTemperature: filters.absBreakpointTemperature,
      absThermalLimit: filters.absThermalLimit
    };
    
    setFilters(newFilters);
  };

  const handleTemperatureFiltersChange = (newFilters) => {
    // Update global filters with new temperature filters, preserving existing filters
    setFilters(prev => ({
      ...prev,
      // Preserve basic filters from sidebar
      species: prev.species,
      project: prev.project,
      years: prev.years,
      // Update temperature filters
      ...newFilters
    }));
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const openTemperatureModal = () => {
    console.log('Sidebar: opening temperature modal with filters:', temperatureFilters);
    console.log('Sidebar: global filters:', filters);
    setShowTemperatureModal(true);
  };

  const closeTemperatureModal = () => {
    setShowTemperatureModal(false);
  };

  const updateBenthicClass = (className, patch) => {
    onBenthicClassesChange?.((previous) => ({
      ...previous,
      [className]: {
        visible: previous[className]?.visible ?? true,
        color: previous[className]?.color || DEFAULT_BENTHIC_CLASS_COLORS[className],
        ...patch,
      },
    }));
  };

  const resetBenthicColors = () => {
    onBenthicClassesChange?.(
      Object.fromEntries(
        Object.entries(DEFAULT_BENTHIC_CLASS_COLORS).map(([className, color]) => [
          className,
          { visible: true, color },
        ])
      )
    );
  };

  // Render compact slider for sidebar
  const renderCompactSlider = (parameter, label, unit = '°C') => {
    const defaultValue = defaultValues[parameter] || { min: 20, max: 40 };
    const value = filters[parameter] || [defaultValue.min, defaultValue.max];
    const minMax = defaultValue;
    const isActive = value[0] !== minMax.min || value[1] !== minMax.max;

    return (
      <Card 
        key={parameter}
        className={`compact-slider-card ${isActive ? 'active' : ''}`}
      >
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className={`compact-slider-title ${isActive ? 'active' : ''}`}>
              {label}
            </h6>
            {isActive && (
              <span className="badge bg-primary compact-slider-badge">Active</span>
            )}
          </div>
          
          <Box sx={{ px: 0.5, mb: 2 }}>
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
                  width: 16,
                  height: 16,
                  boxShadow: isActive ? '0 0 0 2px rgba(0, 123, 255, 0.2)' : 'none',
                },
                '& .MuiSlider-track': {
                  height: 6,
                  backgroundColor: isActive ? '#007bff' : '#6c757d',
                  borderRadius: 3,
                },
                '& .MuiSlider-rail': {
                  height: 4,
                  backgroundColor: '#e9ecef',
                  borderRadius: 2,
                },
                '& .MuiSlider-valueLabel': {
                  backgroundColor: isActive ? '#007bff' : '#6c757d',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                },
              }}
            />
          </Box>
          
          <div className="row text-center compact-slider-values">
            <div className="col-6">
              <div className="compact-slider-value-box">
                <small className="value-label">Min</small>
                <span className="value-number">{value[0].toFixed(1)}{unit}</span>
              </div>
            </div>
            <div className="col-6">
              <div className="compact-slider-value-box">
                <small className="value-label">Max</small>
                <span className="value-number">{value[1].toFixed(1)}{unit}</span>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
    );
  };

  if (isCollapsed) {
    return (
      <div className="sidebar-collapsed">
        <Button 
          variant="primary" 
          onClick={toggleSidebar} 
          className="sidebar-toggle-btn"
        >
          <i className="bi bi-funnel"></i>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="sidebar">
        <div className="map-sidebar-header">
          <div className="map-sidebar-title">Map</div>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={toggleSidebar}
            className="map-sidebar-collapse-btn"
          >
            <i className="bi bi-chevron-right"></i>
          </Button>
        </div>

        <div className="map-sidebar-tabs">
          <button
            type="button"
            className={`map-sidebar-tab ${activeTab === 'filters' ? 'active' : ''}`}
            onClick={() => setActiveTab('filters')}
          >
            Filters
            {activeFiltersCount > 0 && <span className="filter-count-badge">{activeFiltersCount}</span>}
          </button>
          <button
            type="button"
            className={`map-sidebar-tab ${activeTab === 'layers' ? 'active' : ''}`}
            onClick={() => setActiveTab('layers')}
          >
            Layers
          </button>
        </div>

        {activeTab === 'filters' && (
        <div className="sidebar-section">
        
        <Form>
          <Row className="mb-3">
            <Col>
              <FormGroup className="mb-2">
                <Form.Label>Species</Form.Label>
                <Form.Control as="select" value={selectedSpecies} onChange={handleSpeciesChange}>
                  <option value="">All species</option>
                  {speciesList.map((species, index) => (
                    <option key={index} value={species}>{species}</option>
                  ))}
                </Form.Control>
              </FormGroup>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <FormGroup className="mb-2">
                <Form.Label>Project</Form.Label>
                <Form.Control as="select" value={selectedProject} onChange={handleProjectChange}>
                  <option value="">All projects</option>
                  {projectList.map((project, index) => (
                    <option key={index} value={project}>{project}</option>
                  ))}
                </Form.Control>
              </FormGroup>
            </Col>
          </Row>

          {/* Temperature Sliders */}
          <Row className="mb-3">
            <Col>
              <div className="temperature-filters-section">
                <div className="temperature-filters-header">
                  <ThermometerHalf className="me-2 text-primary" size={16} />
                  <h6>Temperature Filters</h6>
                </div>
                {renderCompactSlider('absThermalTolerance', 'ED50 (Thermal Tolerance)', '°C')}
                {renderCompactSlider('absBreakpointTemperature', 'ED5 (Breakpoint Temperature)', '°C')}
                {renderCompactSlider('absThermalLimit', 'ED95 (Thermal Limit)', '°C')}
              </div>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Button 
                variant="outline-primary" 
                onClick={openTemperatureModal}
                className="w-100 d-flex align-items-center justify-content-center advanced-filters-btn"
              >
                <ThermometerHalf className="me-2" size={14} />
                Advanced Filters
                {hasTemperatureFilters && (
                  <span className="badge bg-primary ms-2" style={{ fontSize: '0.65rem' }}>
                    Active
                  </span>
                )}
              </Button>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col xs={9} className="pe-0">
              <Button 
                variant={activeFiltersCount > 0 ? "primary" : "outline-secondary"} 
                onClick={handleApplyFilters} 
                className="w-100 apply-filters-btn"
                disabled={activeFiltersCount === 0}
              >
                {activeFiltersCount > 0 ? `Apply Filters (${activeFiltersCount})` : 'Apply Filters'}
              </Button>
            </Col>
            <Col xs={3} className="ps-1">
              <Button 
                variant="outline-danger" 
                onClick={handleResetFilters} 
                className="w-100 reset-filters-btn"
                disabled={activeFiltersCount === 0}
              >
                <i className="bi bi-trash3"></i>
              </Button>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <FormGroup className="mb-2">
                <AddToCartButton />
              </FormGroup>
            </Col>
          </Row>
        </Form>
        </div>
        )}

        {activeTab === 'layers' && (
        <div className="sidebar-section layers-section">
          <div className="layer-card">
            <div className="layer-card-title">Map settings</div>
            {Object.entries(BASEMAPS).map(([key, config]) => (
              <Form.Check
                key={key}
                type="radio"
                id={`basemap-${key}`}
                name="basemap"
                label={config.label}
                checked={basemap === key}
                onChange={() => onBasemapChange?.(key)}
                className="layer-radio"
              />
            ))}
            <div className="layer-divider" />
            <Form.Check
              type="checkbox"
              id="captions-layer-toggle"
              label="Captions"
              checked={captionsVisible}
              onChange={(event) => onCaptionsVisibleChange?.(event.target.checked)}
              className="fw-semibold"
            />
          </div>

          <div className="layer-card">
            <div className="layer-toggle-row">
              <Form.Check
                type="checkbox"
                id="benthic-layer-toggle"
                label="Benthic Habitat"
                checked={benthicVisible}
                onChange={(event) => onBenthicVisibleChange?.(event.target.checked)}
                className="fw-semibold"
              />
              <Button variant="link" size="sm" onClick={resetBenthicColors} className="layer-reset-btn">
                Reset
              </Button>
            </div>

            {benthicVisible && (
              <div className="benthic-class-list">
                {Object.entries(DEFAULT_BENTHIC_CLASS_COLORS).map(([className, defaultColor]) => {
                  const classSettings = benthicClasses[className] || { visible: true, color: defaultColor };
                  return (
                    <div key={className} className={`benthic-class-row ${classSettings.visible ? '' : 'disabled'}`}>
                      <Form.Check
                        type="checkbox"
                        id={`benthic-class-${className}`}
                        checked={classSettings.visible}
                        onChange={(event) => updateBenthicClass(className, { visible: event.target.checked })}
                      />
                      <input
                        type="color"
                        value={classSettings.color || defaultColor}
                        onChange={(event) => updateBenthicClass(className, { color: event.target.value })}
                        className="benthic-color-input"
                        aria-label={`${className} color`}
                      />
                      <span className="benthic-class-label">{className}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Temperature Filters Modal */}
      <TemperatureFiltersModal
        show={showTemperatureModal}
        onHide={closeTemperatureModal}
        filters={temperatureFilters}
        onAddFilters={handleTemperatureFiltersChange}
      />
    </>
  );
};

export default InputSidebar;