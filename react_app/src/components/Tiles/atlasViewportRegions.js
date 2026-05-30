/**
 * Allen Coral Atlas regional tilesets: viewport bounds + labels for benthic / reef-extent layers.
 * Bounds from atlas GeoPackages (ogrinfo -json extent), padded ~0.5° — [[south, west], [north, east]].
 */

export const ALLEN_ATLAS_REGION_TILESETS = [
  {
    id: 'caribbean',
    label: 'Northern Caribbean, Florida & Bahamas',
    bounds: [
      [16.3375, -85.4629],
      [27.9106, -70.0245],
    ],
  },
  {
    id: 'arabian',
    label: 'Northwestern Arabian Sea',
    bounds: [
      [15.3692, 47.9184],
      [30.1827, 65.3483],
    ],
  },
  {
    id: 'redsea',
    label: 'Red Sea & Gulf of Aden',
    bounds: [
      [-1.8871, 31.8425],
      [30.4115, 55.045],
    ],
  },
  {
    id: 'micronesia',
    label: 'Western Micronesia',
    bounds: [
      [0.5222, 130.6124],
      [20.2617, 163.5705],
    ],
  },
  {
    id: 'sw_pacific',
    label: 'Southwestern Pacific',
    bounds: [
      [-24.4653, -180.5],
      [-6.9539, 180.5],
    ],
  },
  {
    id: 'andaman_sea',
    label: 'Andaman Sea',
    bounds: [
      [5.1496, 91.6756],
      [21.6638, 101.0667],
    ],
  },
  {
    id: 'bermuda',
    label: 'Bermuda',
    bounds: [
      [31.7279, -65.5608],
      [33.003, -64.057],
    ],
  },
  {
    id: 'brazil',
    label: 'Brazil',
    bounds: [
      [-18.5148, -45.6519],
      [-1.1952, -31.8745],
    ],
  },
  {
    id: 'central_south_pacific',
    label: 'Central South Pacific',
    bounds: [
      [-28.1528, -166.4303],
      [-3.4833, -124.2689],
    ],
  },
  {
    id: 'coral_sea',
    label: 'Coral Sea',
    bounds: [
      [-23.802, 146.0441],
      [-13.3002, 160.1397],
    ],
  },
  {
    id: 'eastern_micronesia',
    label: 'Eastern Micronesia',
    bounds: [
      [-7.7583, -177.1352],
      [19.9083, 177.8568],
    ],
  },
  {
    id: 'eastern_tropical_pacific',
    label: 'Eastern Tropical Pacific',
    bounds: [
      [-1.9124, -115.2569],
      [23.9648, -76.9199],
    ],
  },
  {
    id: 'great_barrier_reef',
    label: 'Great Barrier Reef & Torres Strait',
    bounds: [
      [-24.7764, 140.9106],
      [-7.9082, 153.307],
    ],
  },
  {
    id: 'northeastern_asia',
    label: 'Northeastern Asia',
    bounds: [
      [19.9124, 118.4595],
      [30.5569, 142.7602],
    ],
  },
  {
    id: 'south_china_sea',
    label: 'South China Sea',
    bounds: [
      [4.5111, 109.1172],
      [21.2811, 118.3498],
    ],
  },
  {
    id: 'southeastern_asia',
    label: 'Southeastern Asia',
    bounds: [
      [0.9308, 98.6609],
      [23.34, 117.3789],
    ],
  },
  {
    id: 'southeastern_caribbean',
    label: 'Southeastern Caribbean',
    bounds: [
      [8.231, -77.1325],
      [20.5936, -58.8982],
    ],
  },
  {
    id: 'southern_asia',
    label: 'Southern Asia',
    bounds: [
      [5.4179, 68.4298],
      [23.0979, 82.2148],
    ],
  },
  {
    id: 'subtropical_eastern_australia',
    label: 'Subtropical Eastern Australia',
    bounds: [
      [-32.069, 151.9101],
      [-23.8451, 159.6405],
    ],
  },
  {
    id: 'timor_arafura',
    label: 'Timor & Arafura Seas',
    bounds: [
      [-18.1641, 118.3856],
      [-10.3937, 140.4115],
    ],
  },
  {
    id: 'western_africa',
    label: 'Western Africa',
    bounds: [
      [3.8904, -26.0585],
      [30.6611, 3.1503],
    ],
  },
  {
    id: 'western_australia',
    label: 'Western Australia',
    bounds: [
      [-29.4964, 112.4111],
      [-17.4536, 122.725],
    ],
  },
];
