import React, { useMemo } from 'react';
import { Badge, Button, Spinner } from 'react-bootstrap';
import {
  computeBleachingStatsByYear,
  getColoniesBounds,
} from 'utils/bleachingRegionStats';
import './ProjectBleachingSummary.css';

const ProjectBleachingSummary = ({
  colonies = [],
  bleachingObservations = null,
  bleachingYear,
  onSelectYear,
  loading = false,
}) => {
  const bounds = useMemo(() => getColoniesBounds(colonies), [colonies]);

  const stats = useMemo(
    () => computeBleachingStatsByYear(bleachingObservations, bounds),
    [bleachingObservations, bounds],
  );

  const handleYearClick = (year) => {
    onSelectYear?.(year);
  };

  return (
    <div className="project-bleaching-summary">
      <div className="project-bleaching-summary-header">
        <h6 className="mb-1">Bleaching surveys in this region</h6>
        <p className="text-muted small mb-0">
          Records within the map area around this project&apos;s colonies. Select a year to display it on the map.
        </p>
      </div>

      {loading && (
        <div className="project-bleaching-summary-loading">
          <Spinner animation="border" size="sm" role="status" className="me-2" />
          <span className="small text-muted">Loading bleaching data…</span>
        </div>
      )}

      {!loading && stats.total === 0 && (
        <p className="text-muted small mb-0">No bleaching survey records in this region.</p>
      )}

      {!loading && stats.total > 0 && (
        <>
          <div className="project-bleaching-summary-totals">
            <span className="project-bleaching-total-count">{stats.total}</span>
            <span className="text-muted small">
              {' '}
              observation{stats.total === 1 ? '' : 's'} across{' '}
              {stats.yearCount} year{stats.yearCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="project-bleaching-year-list" role="list" aria-label="Bleaching records by year">
            {stats.byYear.map(({ year, count }) => {
              const active = bleachingYear === year;
              return (
                <Button
                  key={year}
                  type="button"
                  size="sm"
                  variant={active ? 'primary' : 'outline-secondary'}
                  className="project-bleaching-year-btn"
                  onClick={() => handleYearClick(year)}
                  aria-pressed={active}
                >
                  <span className="project-bleaching-year-label">{year}</span>
                  <Badge
                    bg={active ? 'light' : 'secondary'}
                    text={active ? 'dark' : 'white'}
                    className="ms-2"
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectBleachingSummary;
