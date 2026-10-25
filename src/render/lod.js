/**
 * Level-of-detail constants shared by projection, atlases, camera and renderer.
 * Art is swapped (not scaled) between 'lo' and 'hi'. 1 grid tile = tileW x tileH diamond on screen;
 * 1 height unit = heightPx screen pixels (a 2.0-unit wall is 2*heightPx tall).
 */
export const LODS = {
  lo: { id: 'lo', tileW: 40, tileH: 20, heightPx: 30, sprite: 32 },
  hi: { id: 'hi', tileW: 64, tileH: 32, heightPx: 60, sprite: 64 }
};

/** Wall height in height units, and wall thickness in tile fractions. */
export const WALL_HEIGHT = 1.5;
export const WALL_THICK = 0.2;

/** Palette used by procedural world art (Endesga-32). */
export const E32 = ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'];
export const OUTLINE = '#3e2731';
