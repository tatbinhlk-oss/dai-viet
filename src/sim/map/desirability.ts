// Độ hấp dẫn theo vòng — thuật toán map/desirability.c của Julius: giá trị tại vòng 1,
// cứ `step` vòng thì cộng `delta` (tiến về 0), tới `range` vòng.
import { BuildingType, type GameState } from '../state';
import { GRID_CELLS, gridOffset, inBounds, offsetX, offsetY, T_FLOODED, T_FLOODPLAIN, T_SUNKEN, T_UNPROTECTED } from './grid';
import { BUILDING_DEFS, flood, HOUSE_LEVELS } from '../buildings/defs';

const FD = flood.desirability;

export function updateDesirability(s: GameState): void {
  const d = s.grid.desirability;
  d.fill(0);
  for (const b of s.buildings) {
    if (b.type === BuildingType.None) continue;
    const des = b.type === BuildingType.House ? HOUSE_LEVELS[b.level].desirability : BUILDING_DEFS[b.type].desirability;
    if (!des) continue;
    addRings(d, b.x, b.y, b.size, des.value, des.step, des.delta, des.range);
  }
  // M4 (thiết kế phần 7): ô ngập −15/+5/tầm 2; đất trũng −5/+2/tầm 2; bãi bồi chưa có đê −5 tại ô (mùa khô);
  // bãi bồi có đê che và cách sông ≤ 6 ô +10 tại ô ("nhà cạnh sông có đê")
  const g = s.grid;
  for (let o = 0; o < GRID_CELLS; o++) {
    // M5: quan đi kiệu qua: +1 tạm thời, giảm dần theo ngày
    if (g.prestige[o] > 0) { g.prestige[o]--; d[o] = Math.min(100, d[o] + 1); }
    const t = g.terrain[o];
    if (!(t & (T_FLOODED | T_SUNKEN | T_FLOODPLAIN))) continue;
    const x = offsetX(o), y = offsetY(o);
    if (t & T_FLOODED) { add(d, x, y, FD.flooded[0]); addRings(d, x, y, 1, FD.flooded[0], FD.flooded[1], FD.flooded[2], FD.flooded[3]); continue; }
    if (t & T_SUNKEN) { add(d, x, y, FD.sunken[0]); addRings(d, x, y, 1, FD.sunken[0], FD.sunken[1], FD.sunken[2], FD.sunken[3]); }
    if (t & T_FLOODPLAIN) {
      if (t & T_UNPROTECTED) add(d, x, y, FD.unprotected);
      else if (g.waterDist[o] <= FD.riverRange) add(d, x, y, FD.protected);
    }
  }
}

function addRings(d: Int8Array, x: number, y: number, size: number, value: number, step: number, delta: number, range: number): void {
  let v = value;
  for (let ring = 1; ring <= range; ring++) {
    if (ring > 1 && (ring - 1) % step === 0) v += delta;
    if ((value > 0 && v <= 0) || (value < 0 && v >= 0)) break;
    const x0 = x - ring, y0 = y - ring, x1 = x + size - 1 + ring, y1 = y + size - 1 + ring;
    for (let cx = x0; cx <= x1; cx++) { add(d, cx, y0, v); add(d, cx, y1, v); }
    for (let cy = y0 + 1; cy <= y1 - 1; cy++) { add(d, x0, cy, v); add(d, x1, cy, v); }
  }
}

function add(d: Int8Array, x: number, y: number, v: number): void {
  if (!inBounds(x, y)) return;
  const o = gridOffset(x, y);
  d[o] = Math.max(-100, Math.min(100, d[o] + v));
}
