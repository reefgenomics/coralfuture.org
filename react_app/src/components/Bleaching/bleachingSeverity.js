/** Allen Coral Atlas / ReefBase severity codes for bleaching grid and markers. */

export const BLEACHING_SEVERITY_COLORS = {
  '-1': '#9ca3af',
  0: '#e5e7eb',
  1: '#facc15',
  2: '#f97316',
  3: '#dc2626',
};

export const BLEACHING_SEVERITY_LABELS = {
  '-1': 'Unknown',
  0: 'No bleaching',
  1: 'Mild (1–10%)',
  2: 'Moderate (11–50%)',
  3: 'Severe (>50%)',
};

export const buildBleachingSeverityColorExpression = () => [
  'match',
  ['get', 'severity'],
  -1, BLEACHING_SEVERITY_COLORS['-1'],
  0, BLEACHING_SEVERITY_COLORS[0],
  1, BLEACHING_SEVERITY_COLORS[1],
  2, BLEACHING_SEVERITY_COLORS[2],
  3, BLEACHING_SEVERITY_COLORS[3],
  BLEACHING_SEVERITY_COLORS['-1'],
];

export const buildBleachingYearFilter = (year) => ['==', ['get', 'year'], year];
