// Độ hấp dẫn theo vòng — thuật toán map/desirability.c của Julius: giá trị tại vòng 1,
// cứ `step` vòng thì cộng `delta` (tiến về 0), tới `range` vòng.
import { BuildingType, type GameState } from '../state';
import { gridOffset, inBounds } from './grid';
import { BUILDING_DEFS, HOUSE_LEVELS } from '../buildings/defs';

export function updateDesirability(s: GameState): void {
  const d = s.grid.desirability;
  d.fill(0);
  for (const b of s.buildings) {
    if (b.type === BuildingType.None) continue;
    const des = b.type === BuildingType.House ? HOUSE_LEVELS[b.level].desirability : BUILDING_DEFS[b.type].desirability;
    if (!des) continue;
    addRings(d, b.x, b.y, b.size, des.value, des.step, des.delta, des.range);
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
