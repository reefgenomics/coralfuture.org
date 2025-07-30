function filterColonies(filters, colonies) {
  return colonies.filter(colony => {
    // Check if species filter is defined and matches colony species
    if (filters.species && colony.species !== filters.species) {
      return false; // Colony species does not match filter, exclude from result
    }

    // Check if project filter is defined and matches any of the colony's projects
    if (filters.project && !colony.projects.includes(filters.project)) {
      return false; // Colony does not belong to the specified project, exclude from result
    }

    // Check if Abs. Thermal Tolerance ED50 temperature filter is defined and colony's Abs. Thermal Tolerance ED50 temperature is within the specified range
    if (filters.ed50Temperatures && !filters.ed50Temperatures.includes(Infinity) && !filters.ed50Temperatures.includes(-Infinity)) {
      // Check if colony has thermal_tolerances
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false; // Colony does not have thermal tolerances data, exclude from result
      }
      
      const absTTValues = colony.thermal_tolerances.map(tt => tt.abs_thermal_tolerance);
      if (!absTTValues.some(value => value >= filters.ed50Temperatures[0] && value <= filters.ed50Temperatures[1])) {
        return false; // Colony does not meet Abs. Thermal Tolerance ED50 temperature criteria, exclude from result
      }
    }

    // Check if Rel. Thermal Tolerance ED50 - MMM temperature filter is defined and colony's Rel. Thermal Tolerance ED50 - MMM temperature is within the specified range
    if (filters.thermalToleranceTemperatures && !filters.thermalToleranceTemperatures.includes(Infinity) && !filters.thermalToleranceTemperatures.includes(-Infinity)) {
      // Check if colony has thermal_tolerances with rel_thermal_tolerance values
      if (!colony.thermal_tolerances || colony.thermal_tolerances.length === 0) {
        return false; // Colony does not have thermal tolerances data, exclude from result
      }
      
      const relTTValues = colony.thermal_tolerances
        .map(tt => tt.rel_thermal_tolerance)
        .filter(value => value !== null && value !== undefined);
      
      // If there are no rel_thermal_tolerance values, exclude colony
      if (relTTValues.length === 0) {
        return false;
      }
      
      if (!relTTValues.some(value => value >= filters.thermalToleranceTemperatures[0] && value <= filters.thermalToleranceTemperatures[1])) {
        return false; // Colony does not meet Rel. Thermal Tolerance ED50 - MMM temperature criteria, exclude from result
      }
    }

    return true; // Colony meets all filter criteria
  });
}

export default filterColonies;
