/** Prop footprint (w along +x, d along +y, in tiles) and height (height units) per kind. */
export const PROP_VISUALS = {
  desk: { w: 2, d: 1, h: 0.5, colorKey: 'desk' },
  cab: { w: 1, d: 1, h: 0.8, colorKey: 'cab' },
  chair: { w: 1, d: 1, h: 0.45, colorKey: 'chair' },
  monitor: { w: 1, d: 1, h: 0.3, colorKey: 'monitor' },
  rack: { w: 1, d: 1, h: 1.2, colorKey: 'rack' },
  vend: { w: 1, d: 1, h: 1.2, colorKey: 'vend' },
  safe: { w: 1, d: 1, h: 1.0, colorKey: 'safe' },
  statue: { w: 1, d: 1, h: 1.0, colorKey: 'statue' },
  ceo: { w: 3, d: 2, h: 0.7, colorKey: 'ceo' },
  plant: { w: 1, d: 1, h: 0.8, colorKey: 'plant' },
  copier: { w: 1, d: 1, h: 0.8, colorKey: 'copier' }
};

/** Floor tile base colours. */
export const FLOOR_COLORS = {
  carpetA: '#c0cbdc',
  carpetB: '#5a6988',
  carpetC: '#b55088',
  tile: '#e8b796',
  asphalt: '#3a4466',
  grass: '#63c74d'
};

/** Prop base colours keyed by colorKey. */
export const PROP_COLORS = {
  desk: '#d77643',
  cab: '#8b9bb4',
  chair: '#68386c',
  rack: '#262b44',
  vend: '#e43b44',
  safe: '#5a6988',
  statue: '#feae34',
  ceo: '#be4a2f',
  monitor: '#3a4466',
  plant: '#3e8948',
  copier: '#c0cbdc'
};
