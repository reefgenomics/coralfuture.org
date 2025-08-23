// External imports
import axios from 'axios';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Button, Form, FormGroup, Row, Col } from 'react-bootstrap';
import { ThermometerHalf } from 'react-bootstrap-icons';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'react-range-slider-input/dist/style.css';
// Internal imports
// Contexts
import { SidebarFilterContext } from 'contexts/SidebarFilterContext';
// Components
import AddToCartButton from 'components/Button/AddToCart';
import TemperatureFiltersModal from './TemperatureFiltersModal';

const InputSidebar = () => {

  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  
  // State for temperature filters modal
  const [showTemperatureModal, setShowTemperatureModal] = useState(false);
  
  // Get all Colonies and Projects from Context and define list of species
  const { allColonies, allBioSamples, allProjects, setFilters } = useContext(SidebarFilterContext);
  const speciesList = [...new Set(allColonies.map(allColonies => allColonies.species))].sort();
  const projectList = [...new Set(allProjects.map(allProjects => allProjects.name))].sort();

  // State for temperature filters - start with empty
  const [temperatureFilters, setTemperatureFilters] = useState({});

  // Check if any filters are actually applied
  const hasSpeciesFilter = selectedSpecies !== '';
  const hasProjectFilter = selectedProject !== '';
  const hasDateFilter = selectedDates.length > 0;
  
  // Check if temperature filters are set
  const hasTemperatureFilters = Object.keys(temperatureFilters).length > 0;

  const activeFiltersCount = (hasSpeciesFilter ? 1 : 0) + 
                           (hasProjectFilter ? 1 : 0) + 
                           (hasDateFilter ? 1 : 0) + 
                           (hasTemperatureFilters ? 1 : 0);

  // State to control sidebar visibility
  const [isCollapsed, setIsCollapsed] = useState(false);



  const handleApplyFilters = () => {
    // If no filters are applied, clear all filters
    if (!hasSpeciesFilter && !hasProjectFilter && !hasDateFilter && !hasTemperatureFilters) {
      setFilters({});
      return;
    }

    const newFilters = {
      species: selectedSpecies,
      project: selectedProject,
      ...temperatureFilters,
      years: selectedDates
    };
    
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setSelectedSpecies('');
    setSelectedProject('');
    setSelectedDates([]);
    setTemperatureFilters({});
    setFilters({});
  };

  const handleSpeciesChange = (e) => {
    setSelectedSpecies(e.target.value);
    console.log('Selected species:', e.target.value);
  };

  const handleProjectChange = (e) => {
    setSelectedProject(e.target.value);
    console.log('Selected project:', e.target.value);
  };

  const handleTemperatureFiltersChange = (newFilters) => {
    setTemperatureFilters(newFilters);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const openTemperatureModal = () => {
    console.log('Sidebar: opening temperature modal with filters:', temperatureFilters);
    setShowTemperatureModal(true);
  };

  const closeTemperatureModal = () => {
    setShowTemperatureModal(false);
  };

  if (isCollapsed) {
    return (
      <div style={{ 
        padding: '10px', 
        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
        borderRadius: '8px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
      }}>
        <Button 
          variant="primary" 
          onClick={toggleSidebar} 
          style={{ width: '40px', height: '40px', padding: '0' }}
        >
          <i className="bi bi-funnel"></i>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="sidebar" style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
        padding: '15px', 
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)', 
        borderRadius: '8px',
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div className="d-flex align-items-center">
            <h4 style={{ margin: 0 }}>Filters</h4>
            {activeFiltersCount > 0 && (
              <span 
                className="badge bg-primary ms-2" 
                style={{ fontSize: '0.75rem' }}
              >
                {activeFiltersCount}
              </span>
            )}
          </div>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={toggleSidebar}
            style={{ width: '30px', height: '30px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <i className="bi bi-chevron-left"></i>
          </Button>
        </div>
        
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

          <Row className="mb-3">
            <Col>
              <Button 
                variant={hasTemperatureFilters ? "primary" : "outline-primary"} 
                onClick={openTemperatureModal}
                className="w-100 d-flex align-items-center justify-content-center"
                style={{ height: '48px' }}
              >
                <ThermometerHalf className="me-2" size={18} />
                Temperature Filters
                {hasTemperatureFilters && (
                  <span className="badge bg-light text-primary ms-2" style={{ fontSize: '0.75rem' }}>
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
                style={{ width: '100%' }}
                disabled={activeFiltersCount === 0}
              >
                {activeFiltersCount > 0 ? `Apply Filters (${activeFiltersCount})` : 'Apply Filters'}
              </Button>
            </Col>
            <Col xs={3} className="ps-1">
              <Button 
                variant="outline-danger" 
                onClick={handleResetFilters} 
                style={{ width: '100%' }}
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