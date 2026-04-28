import axios from 'axios';
import React, { useState, useEffect, createContext } from 'react';

export const SidebarFilterContext = createContext();

const FILTERS_CACHE_KEY = 'customerMapFilters';

const getInitialFilters = () => {
  try {
    const cached = JSON.parse(window.localStorage.getItem(FILTERS_CACHE_KEY));
    return cached && typeof cached === 'object' ? cached : {};
  } catch (_) {
    return {};
  }
};

const SidebarFilterProvider = (props) => {
  const [allColonies, setAllColonies] = useState([]);
  const [allBioSamples, setAllBioSamples] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [filters, setFilters] = useState(getInitialFilters);
  const [filteredColonies, setFilteredColonies] = useState([]);
  const [defaultValues, setDefaultValues] = useState({});

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(filters));
    } catch (_) {
      // Ignore localStorage quota/private mode issues.
    }
  }, [filters]);

  useEffect(() => {
    const fetchColonies = async (backendUrl) => {
      try {
        const response = await axios.get(`${backendUrl}/api/public/colonies/`);
        setAllColonies(response.data);
        console.log('Retrieve Colonies from database');
      } catch (error) {
        console.error(error);
      }
    };

    const fetchBioSamples = async (backendUrl) => {
      try {
        const response = await axios.get(`${backendUrl}/api/public/biosamples/`);
        setAllBioSamples(response.data);
        console.log('Retrieve BioSamples from database')
      } catch (error) {
        console.error(error);
      }
    };

    const fetchProjects = async (backendUrl) => {
      try {
        const response = await axios.get(`${backendUrl}/api/public/projects/`);
        setAllProjects(response.data)
        console.log('Retrieve Projects from database');
      } catch (error) {
        console.error(error);
      }
    };

    const fetchDefaultValues = async (backendUrl) => {
      try {
        const [ttResponse, btResponse, tlResponse] = await Promise.all([
          axios.get(`${backendUrl}/api/public/thermal-tolerances/max-min/`),
          axios.get(`${backendUrl}/api/public/breakpoint-temperatures/max-min/`),
          axios.get(`${backendUrl}/api/public/thermal-limits/max-min/`)
        ]);

        const ttData = ttResponse.data;
        const btData = btResponse.data;
        const tlData = tlResponse.data;

        setDefaultValues({
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
        });
      } catch (error) {
        console.error('Error fetching default values:', error);
      }
    };

    // Use relative URL for API calls to work with both HTTP and HTTPS
    const backendUrl = '';

    fetchColonies(backendUrl);
    fetchBioSamples(backendUrl);
    fetchProjects(backendUrl);
    fetchDefaultValues(backendUrl);
  }, []);

  return (
    <SidebarFilterContext.Provider
      value={{ allColonies, allBioSamples, allProjects, filters, setFilters, filteredColonies, setFilteredColonies, defaultValues }}
    >
      {props.children}
    </SidebarFilterContext.Provider>
  );
};

export default SidebarFilterProvider;
