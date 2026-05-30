import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { BoxArrowUpRight } from 'react-bootstrap-icons';
import SidebarFilterProvider from 'contexts/SidebarFilterContext';
import InputSidebar from 'components/Sidebar/Sidebar';
import Map from 'components/Map/Map';
import BleachingObservationModal from 'components/Bleaching/BleachingObservationModal';
import ProjectBleachingSummary from 'components/Bleaching/ProjectBleachingSummary';
import useBleachingMapData from 'hooks/useBleachingMapData';
import {
  getMapLayerSettings,
  persistMapLayerSettings,
} from 'utils/mapLayerSettings';
import { buildGlobalMapLink } from 'utils/coloniesMapView';
import './ProjectMapPanel.css';

const PROJECT_MAP_SETTINGS_KEY = 'projectMapLayerSettings';

const ProjectMapPanel = ({ colonies = [], projectName = '' }) => {
  const initialSettings = getMapLayerSettings(PROJECT_MAP_SETTINGS_KEY);
  const [basemap, setBasemap] = useState(initialSettings.basemap);
  const [captionsVisible, setCaptionsVisible] = useState(initialSettings.captionsVisible);
  const [benthicVisible, setBenthicVisible] = useState(initialSettings.benthicVisible);
  const [benthicClasses, setBenthicClasses] = useState(initialSettings.benthicClasses);
  const [reefExtentVisible, setReefExtentVisible] = useState(initialSettings.reefExtentVisible);
  const [reefExtentClasses, setReefExtentClasses] = useState(initialSettings.reefExtentClasses);
  const [bleachingVisible, setBleachingVisible] = useState(initialSettings.bleachingVisible);
  const [selectedBleachingObs, setSelectedBleachingObs] = useState(null);

  const {
    bleachingYears,
    bleachingObservations,
    bleachingYear,
    setBleachingYear,
    bleachingLoading,
  } = useBleachingMapData(initialSettings.bleachingYear);

  const handleBleachingYearSelect = (year) => {
    setBleachingYear(year);
    setBleachingVisible(true);
  };

  const scopedColonies = useMemo(() => {
    if (!Array.isArray(colonies)) return [];
    return colonies.map((colony) => ({
      ...colony,
      projects: colony.projects?.length ? colony.projects : (projectName ? [projectName] : []),
    }));
  }, [colonies, projectName]);

  const globalMapLink = useMemo(
    () => buildGlobalMapLink({ colonies: scopedColonies, projectName, bleachingYear }),
    [scopedColonies, projectName, bleachingYear],
  );

  useEffect(() => {
    persistMapLayerSettings(PROJECT_MAP_SETTINGS_KEY, {
      basemap,
      captionsVisible,
      benthicVisible,
      benthicClasses,
      reefExtentVisible,
      reefExtentClasses,
      bleachingVisible,
      bleachingYear,
    });
  }, [
    basemap,
    captionsVisible,
    benthicVisible,
    benthicClasses,
    reefExtentVisible,
    reefExtentClasses,
    bleachingVisible,
    bleachingYear,
  ]);

  if (!scopedColonies.length) {
    return (
      <div className="project-map-panel project-map-panel-empty">
        <p className="text-muted mb-0">No colonies with coordinates for this project.</p>
      </div>
    );
  }

  return (
    <SidebarFilterProvider scopedColonies={scopedColonies}>
      <div className="project-map-panel">
        <div className="project-map-canvas">
          <Map
            basemap={basemap}
            captionsVisible={captionsVisible}
            benthicVisible={benthicVisible}
            benthicClasses={benthicClasses}
            reefExtentVisible={reefExtentVisible}
            reefExtentClasses={reefExtentClasses}
            bleachingVisible={bleachingVisible}
            bleachingYear={bleachingYear}
            bleachingObservationsGeoJson={bleachingObservations}
            onBleachingObservationClick={setSelectedBleachingObs}
            scopedColonies={scopedColonies}
            skipUrlFocus
          />
        </div>
        <div className="project-map-sidebar-wrap">
          <InputSidebar
            layout="embedded"
            sidebarTitle="Map & filters"
            hideProjectFilter
            basemap={basemap}
            onBasemapChange={setBasemap}
            captionsVisible={captionsVisible}
            onCaptionsVisibleChange={setCaptionsVisible}
            benthicVisible={benthicVisible}
            onBenthicVisibleChange={setBenthicVisible}
            benthicClasses={benthicClasses}
            onBenthicClassesChange={setBenthicClasses}
            reefExtentVisible={reefExtentVisible}
            onReefExtentVisibleChange={setReefExtentVisible}
            reefExtentClasses={reefExtentClasses}
            onReefExtentClassesChange={setReefExtentClasses}
            bleachingVisible={bleachingVisible}
            onBleachingVisibleChange={setBleachingVisible}
            bleachingYear={bleachingYear}
            onBleachingYearChange={setBleachingYear}
            bleachingYears={bleachingYears}
          />
        </div>
      </div>
      <ProjectBleachingSummary
        colonies={scopedColonies}
        bleachingObservations={bleachingObservations}
        bleachingYear={bleachingYear}
        onSelectYear={handleBleachingYearSelect}
        loading={bleachingLoading}
      />
      <div className="project-map-footer">
        <Button
          as={Link}
          to={globalMapLink}
          variant="outline-primary"
          className="project-map-global-link"
        >
          <BoxArrowUpRight className="me-2" size={16} aria-hidden />
          Open on global map
        </Button>
      </div>
      <BleachingObservationModal
        show={!!selectedBleachingObs}
        onHide={() => setSelectedBleachingObs(null)}
        observation={selectedBleachingObs}
      />
    </SidebarFilterProvider>
  );
};

export default ProjectMapPanel;
