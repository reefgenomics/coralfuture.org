import React, { useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';

export const BENTHIC_LEGEND = [
  { label: 'Coral/Algae', color: '#0d9488' },
  { label: 'Seagrass', color: '#15803d' },
  { label: 'Sand', color: '#e8d5c4' },
  { label: 'Rock', color: '#57534e' },
  { label: 'Rubble', color: '#b45309' },
  { label: 'Microalgal Mats', color: '#4d7c0f' },
];

const panelShell = {
  backgroundColor: 'rgba(255, 255, 255, 0.94)',
  borderRadius: '10px',
  boxShadow: '0 2px 14px rgba(0, 0, 0, 0.12)',
  border: '1px solid rgba(0, 0, 0, 0.06)',
};

/**
 * Collapsible right-side panel: toggle benthic tileset + colony markers; legend when benthic on.
 */
const MapLayersPanel = ({
  benthicVisible,
  onBenthicVisibleChange,
  coloniesVisible,
  onColoniesVisibleChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: '96px',
          zIndex: 1001,
        }}
      >
        <Button
          variant="light"
          size="sm"
          title="Map layers"
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          style={{
            ...panelShell,
            borderRadius: '10px 0 0 10px',
            padding: '10px 8px',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          <i className="bi bi-layers-fill" style={{ fontSize: '1.1rem' }} />
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: '12px',
        top: '96px',
        zIndex: 1001,
        width: 'min(280px, calc(100vw - 24px))',
      }}
    >
      <Card style={panelShell} className="border-0">
        <Card.Header
          className="py-2 px-3 d-flex align-items-center justify-content-between"
          style={{ background: 'rgba(248, 250, 252, 0.95)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <span className="fw-semibold small">Map layers</span>
          <Button
            variant="link"
            size="sm"
            className="p-0 text-secondary"
            title="Collapse"
            aria-label="Collapse layers panel"
            onClick={() => setCollapsed(true)}
          >
            <i className="bi bi-chevron-right" />
          </Button>
        </Card.Header>
        <Card.Body className="py-2 px-3">
          <Form.Check
            type="switch"
            id="layer-colonies"
            className="mb-2"
            label="Colony sites"
            checked={coloniesVisible}
            onChange={(e) => onColoniesVisibleChange(e.target.checked)}
          />
          <Form.Check
            type="switch"
            id="layer-benthic"
            className="mb-0"
            label="Benthic habitats (tileset)"
            checked={benthicVisible}
            onChange={(e) => onBenthicVisibleChange(e.target.checked)}
          />

          {benthicVisible && (
            <div
              className="mt-3 pt-2"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
            >
              <div className="text-muted small mb-2">Habitat legend</div>
              <ul className="list-unstyled mb-0 small">
                {BENTHIC_LEGEND.map((item) => (
                  <li key={item.label} className="d-flex align-items-center gap-2 mb-1">
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        backgroundColor: item.color,
                        flexShrink: 0,
                        border: '1px solid rgba(0,0,0,0.15)',
                      }}
                    />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted mb-0 mt-2" style={{ fontSize: '0.72rem' }}>
                Visible from zoom ~10 in this region.
              </p>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default MapLayersPanel;
