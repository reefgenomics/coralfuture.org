import React from 'react';
import { Modal, Table } from 'react-bootstrap';
import { BLEACHING_SEVERITY_LABELS } from './bleachingSeverity';

const FIELD_LABELS = {
  COUNTRY: 'Country',
  LOCATION: 'Location',
  SITE_NAME: 'Site',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  MONTH: 'Month',
  YEAR: 'Year',
  DEPTH: 'Depth',
  SEVERITY_CODE: 'Severity code',
  severity: 'Severity',
  severity_label: 'Severity',
  PERCENT_BLEACHED: 'Percent bleached',
  MORTALITY_CODE: 'Mortality code',
  PERCENT_MORTALITY: 'Percent mortality',
  SURVEY_TYPE: 'Survey type',
  SOURCE: 'Source',
  NAME: 'Name',
  CITATION: 'Citation',
  COMMENTS: 'Comments',
  ENTRY_CODE: 'Entry code',
  DATABASE_CODE: 'Database code',
};

const formatValue = (key, value) => {
  if (value === '' || value == null || String(value) === '-999') return null;
  if (key === 'severity' || key === 'SEVERITY_CODE') {
    const n = Number(value);
    return BLEACHING_SEVERITY_LABELS[n] ?? BLEACHING_SEVERITY_LABELS[String(n)] ?? String(value);
  }
  return String(value);
};

const BleachingObservationModal = ({ show, onHide, observation }) => {
  if (!observation) return null;

  const title =
    observation.SITE_NAME ||
    observation.LOCATION ||
    observation.COUNTRY ||
    'Bleaching observation';

  const rows = Object.entries(observation)
    .map(([key, value]) => {
      const formatted = formatValue(key, value);
      if (formatted == null) return null;
      if (key === 'obs_id' || key === 'severity_label') return null;
      return { key, label: FIELD_LABELS[key] || key.replace(/_/g, ' '), value: formatted };
    })
    .filter(Boolean);

  return (
    <Modal show={show} onHide={onHide} size="lg" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table size="sm" striped bordered responsive className="mb-0">
          <tbody>
            {rows.map(({ key, label, value }) => (
              <tr key={key}>
                <th style={{ width: '38%' }}>{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
    </Modal>
  );
};

export default BleachingObservationModal;
