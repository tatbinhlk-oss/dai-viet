// Lưới bản đồ: các TypedArray song song, một phần tử một ô — kiểu map/grid.c của Julius.
export const GRID_SIZE = 160;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;

// Cờ địa hình (bit). Một ô có thể mang nhiều cờ.
export const T_WATER = 1 << 0;
export const T_ROAD = 1 << 1;
export const T_BUILDING = 1 << 2;
export const T_FLOODPLAIN = 1 << 3; // đất thấp nối với sông, sẽ ngập ở M4
export const T_TREE = 1 << 4;
export const T_FLOODED = 1 << 5; // dùng từ M4

export interface Grid {
  terrain: Uint16Array; // cờ T_*
  elevation: Uint8Array; // 0–4
  buildingId: Uint16Array; // 0 = trống
  desirability: Int8Array; // dùng từ M2
}

export function createGrid(): Grid {
  return {
    terrain: new Uint16Array(GRID_CELLS),
    elevation: new Uint8Array(GRID_CELLS),
    buildingId: new Uint16Array(GRID_CELLS),
    desirability: new Int8Array(GRID_CELLS),
  };
}

export const gridOffset = (x: number, y: number): number => y * GRID_SIZE + x;
export const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;

export function hasFlag(g: Grid, x: number, y: number, flag: number): boolean {
  return (g.terrain[gridOffset(x, y)] & flag) !== 0;
}

/** Ô đất trống có thể xây: không nước, không đường, không công trình. */
export function isBuildable(g: Grid, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  return (g.terrain[gridOffset(x, y)] & (T_WATER | T_ROAD | T_BUILDING)) === 0;
}
