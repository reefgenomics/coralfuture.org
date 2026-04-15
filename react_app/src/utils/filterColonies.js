function filterColonies(filters, colonies, defaultValues = {}) {
  return colonies.filter(colony => {
    // Check if species filter is defined and matches colony species
    if (filters.species && colony.species !== filters.species) {
      return false; // Colony species does not match filter, exclude from result
    }

    // Check if project filter is defined and matches any of the colony's projects
    if (filters.project && !colony.projects.includes(filters.project)) {
      return false; // Colony does not belong to the specified project, exclude from result
    }

    // Check if years filter is defined and colony's collection dates are within the specified range
    if (filters.years && filters.years.length > 0) {
      // This would need to be implemented based on how years are stored and filtered
      // For now, we'll skip this check
    }

    // Helper function to check if a filter is actually applied (not default values)
    const isFilterApplied = (filterValues, parameterName) => {
      if (!filterValues || filterValues.length !== 2) return false;
      
      // Get default values from parameter or use fallback values
      const defaultMin = defaultValues[parameterName]?.min || 20;
      const defaultMax = defaultValues[parameterName]?.max || 40;
      
      return filterValues[0] !== defaultMin || filterValues[1] !== defaultMax;
    };

    // Helper function to check temperature range filters
    const checkTemperatureRange = (filterValues, dataValues, parameterName) => {
      if (!filterValues || filterValues.includes(Infinity) || filterValues.includes(-Infinity)) {
        return true; // No filter applied
      }
      
      if (!dataValues || dataValues.length === 0) {
        return false; // No data available
      }
      
      const validValues = dataValues.filter(value => value !== null && value !== undefined);
      if (validValues.length === 0) {
        return false; // No valid data
      }
      
      return validValues.some(value => value >= filterValues[0] && value <= filterValues[1]);
    };

    // Check Thermal Tolerance (TT) filters - only if they were actually changed from defaults
    if (isFilterApplied(filters.absThermalTolerance, 'absThermalTolerance')) {
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false;
      }
      
      const absTTValues = colony.thermal_tolerances.map(tt => tt.abs_thermal_tolerance);
      if (!checkTemperatureRange(filters.absThermalTolerance, absTTValues, 'absThermalTolerance')) {
        return false;
      }
    }

    if (isFilterApplied(filters.relThermalTolerance, 'relThermalTolerance')) {
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false;
      }
      
      const relTTValues = colony.thermal_tolerances.map(tt => tt.rel_thermal_tolerance);
      if (!checkTemperatureRange(filters.relThermalTolerance, relTTValues, 'relThermalTolerance')) {
        return false;
      }
    }

    // Check ED50 filters
    if (isFilterApplied(filters.ed50, 'ed50')) {
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false;
      }
      
      const ed50Values = colony.thermal_tolerances.map(tt => tt.ed50);
      if (!checkTemperatureRange(filters.ed50, ed50Values, 'ed50')) {
        return false;
      }
    }

    if (isFilterApplied(filters.ed50Mmm, 'ed50Mmm')) {
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false;
      }
      
      const ed50MmmValues = colony.thermal_tolerances.map(tt => tt.ed50_mmm);
      if (!checkTemperatureRange(filters.ed50Mmm, ed50MmmValues, 'ed50Mmm')) {
        return false;
      }
    }

    // Check Breakpoint Temperature (BT) filters - only if they were actually changed from defaults
    if (isFilterApplied(filters.absBreakpointTemperature, 'absBreakpointTemperature')) {
      if (!colony.breakpoint_temperatures || colony.breakpoint_temperatures.length === 0) {
        return false;
      }
      
      const absBTValues = colony.breakpoint_temperatures.map(bt => bt.abs_breakpoint_temperature);
      if (!checkTemperatureRange(filters.absBreakpointTemperature, absBTValues, 'absBreakpointTemperature')) {
        return false;
      }
    }

    if (isFilterApplied(filters.relBreakpointTemperature, 'relBreakpointTemperature')) {
      if (!colony.breakpoint_temperatures || colony.breakpoint_temperatures.length === 0) {
        return false;
      }
      
      const relBTValues = colony.breakpoint_temperatures.map(bt => bt.rel_breakpoint_temperature);
      if (!checkTemperatureRange(filters.relBreakpointTemperature, relBTValues, 'relBreakpointTemperature')) {
        return false;
      }
    }

    // Check ED5 filters
    if (isFilterApplied(filters.ed5, 'ed5')) {
      if (!colony.breakpoint_temperatures || colony.breakpoint_temperatures.length === 0) {
        return false;
      }
      
      const ed5Values = colony.breakpoint_temperatures.map(bt => bt.ed5);
      if (!checkTemperatureRange(filters.ed5, ed5Values, 'ed5')) {
        return false;
      }
    }

    if (isFilterApplied(filters.ed5Mmm, 'ed5Mmm')) {
      if (!colony.breakpoint_temperatures || colony.breakpoint_temperatures.length === 0) {
        return false;
      }
      
      const ed5MmmValues = colony.breakpoint_temperatures.map(bt => bt.ed5_mmm);
      if (!checkTemperatureRange(filters.ed5Mmm, ed5MmmValues, 'ed5Mmm')) {
        return false;
      }
    }

    // Check Thermal Limit (TL) filters - only if they were actually changed from defaults
    if (isFilterApplied(filters.absThermalLimit, 'absThermalLimit')) {
      if (!colony.thermal_limits || colony.thermal_limits.length === 0) {
        return false;
      }
      
      const absTLValues = colony.thermal_limits.map(tl => tl.abs_thermal_limit);
      if (!checkTemperatureRange(filters.absThermalLimit, absTLValues, 'absThermalLimit')) {
        return false;
      }
    }

    if (isFilterApplied(filters.relThermalLimit, 'relThermalLimit')) {
      if (!colony.thermal_limits || colony.thermal_limits.length === 0) {
        return false;
      }
      
      const relTLValues = colony.thermal_limits.map(tl => tl.rel_thermal_limit);
      if (!checkTemperatureRange(filters.relThermalLimit, relTLValues, 'relThermalLimit')) {
        return false;
      }
    }

    // Check ED95 filters
    if (isFilterApplied(filters.ed95, 'ed95')) {
      if (!colony.thermal_limits || colony.thermal_limits.length === 0) {
        return false;
      }
      
      const ed95Values = colony.thermal_limits.map(tl => tl.ed95);
      if (!checkTemperatureRange(filters.ed95, ed95Values, 'ed95')) {
        return false;
      }
    }

    if (isFilterApplied(filters.ed95Mmm, 'ed95Mmm')) {
      if (!colony.thermal_limits || colony.thermal_limits.length === 0) {
        return false;
      }
      
      const ed95MmmValues = colony.thermal_limits.map(tl => tl.ed95_mmm);
      if (!checkTemperatureRange(filters.ed95Mmm, ed95MmmValues, 'ed95Mmm')) {
        return false;
      }
    }

    // Legacy filter support for backward compatibility
    if (filters.ed50Temperatures && !filters.ed50Temperatures.includes(Infinity) && !filters.ed50Temperatures.includes(-Infinity)) {
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false;
      }
      
      const absTTValues = colony.thermal_tolerances.map(tt => tt.abs_thermal_tolerance);
      if (!absTTValues.some(value => value >= filters.ed50Temperatures[0] && value <= filters.ed50Temperatures[1])) {
        return false;
      }
    }

    if (filters.thermalToleranceTemperatures && !filters.thermalToleranceTemperatures.includes(Infinity) && !filters.thermalToleranceTemperatures.includes(-Infinity)) {
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false;
      }
      
      const relTTValues = colony.thermal_tolerances
        .map(tt => tt.rel_thermal_tolerance)
        .filter(value => value !== null && value !== undefined);
      
      if (relTTValues.length === 0) {
        return false;
      }
      
      if (!relTTValues.some(value => value >= filters.thermalToleranceTemperatures[0] && value <= filters.thermalToleranceTemperatures[1])) {
        return false;
      }
    }

    return true; // Colony meets all filter criteria
  });
}

export default filterColonies;
