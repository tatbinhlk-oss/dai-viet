// Lưới bản đồ: các TypedArray song song, một phần tử một ô — kiểu map/grid.c của Julius.
export const GRID_SIZE = 160;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;

// Cờ địa hình (bit). Một ô có thể mang nhiều cờ.
export const T_WATER = 1 << 0;
export const T_ROAD = 1 << 1;
export const T_BUILDING = 1 << 2;
export const T_FLOODPLAIN = 1 << 3; // đất thấp nối với sông, sẽ ngập ở M4
export const T_TREE = 1 << 4;
export const T_FLOODED = 1 << 5; // M4: đang ngập (tính lại mỗi ngày trong mùa lũ)
export const T_SUNKEN = 1 << 6; // M4: đất trũng — chỗ đào đất đắp đê hoặc đoạn đê đã vỡ
export const T_UNPROTECTED = 1 << 7; // M4: ô bãi bồi chưa có đê che (lũ vừa sẽ ngập), để vẽ lớp phủ và độ hấp dẫn

export interface Grid {
  terrain: Uint16Array; // cờ T_*
  elevation: Uint8Array; // 0–4
  buildingId: Uint16Array; // 0 = trống; mọi ô trong móng đều ghi id
  bType: Uint8Array; // loại công trình, CHỈ ghi ở ô neo (góc dưới móng) — render dùng
  bLevel: Uint8Array; // bậc nhà ở ô neo
  desirability: Int8Array; // độ hấp dẫn, tính lại mỗi ngày
  dike: Uint8Array; // M4: mức cao đê hữu hiệu tại ô (cống mở = 0); flood-fill lan khi elevation + dike < mực lũ
  waterDist: Uint8Array; // M4: khoảng cách (BFS 4 hướng) tới ô sông gần nhất, tính một lần khi sinh bản đồ
}

export function createGrid(): Grid {
  return {
    terrain: new Uint16Array(GRID_CELLS),
    elevation: new Uint8Array(GRID_CELLS),
    buildingId: new Uint16Array(GRID_CELLS),
    bType: new Uint8Array(GRID_CELLS),
    bLevel: new Uint8Array(GRID_CELLS),
    desirability: new Int8Array(GRID_CELLS),
    dike: new Uint8Array(GRID_CELLS),
    waterDist: new Uint8Array(GRID_CELLS),
  };
}

export const gridOffset = (x: number, y: number): number => y * GRID_SIZE + x;
export const offsetX = (o: number): number => o % GRID_SIZE;
export const offsetY = (o: number): number => (o / GRID_SIZE) | 0;
export const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;

export function hasFlag(g: Grid, x: number, y: number, flag: number): boolean {
  return inBounds(x, y) && (g.terrain[gridOffset(x, y)] & flag) !== 0;
}

/** Ô đất trống có thể xây: không nước, không đường, không công trình. */
export function isBuildable(g: Grid, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  return (g.terrain[gridOffset(x, y)] & (T_WATER | T_ROAD | T_BUILDING)) === 0;
}

/** Đường đi được: có đường và không ngập (M4: walker không qua đường ngập). */
export const isRoad = (g: Grid, o: number): boolean => (g.terrain[o] & (T_ROAD | T_FLOODED)) === T_ROAD;
/** Đi bộ trên đất (dân di cư, phu đê): không nước, không công trình; đường thì đi được (kể cả đường vắt qua đê). Lội được qua ô ngập. */
export const isLand = (g: Grid, o: number): boolean => {
  const t = g.terrain[o];
  return (t & T_ROAD) !== 0 || (t & (T_WATER | T_BUILDING)) === 0;
};
export const isWater = (g: Grid, o: number): boolean => (g.terrain[o] & T_WATER) !== 0;

/** 4 ô kề (N, E, S, W) dưới dạng offset, -1 nếu ngoài biên. */
export function neighbors4(o: number, out: Int32Array): void {
  const x = offsetX(o), y = offsetY(o);
  out[0] = y > 0 ? o - GRID_SIZE : -1;
  out[1] = x < GRID_SIZE - 1 ? o + 1 : -1;
  out[2] = y < GRID_SIZE - 1 ? o + GRID_SIZE : -1;
  out[3] = x > 0 ? o - 1 : -1;
}
