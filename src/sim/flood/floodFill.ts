// Flood-fill lũ — thiết kế phần 5: từ ô sông lan sang ô láng giềng khi elevation + dikeHeight(ô) < mực lũ.
// Một tuyến đê kín cao hơn mực lũ chặn toàn bộ; một lỗ hổng làm cả vùng sau đê ngập.
import { GRID_CELLS, type Grid, neighbors4, T_FLOODED, T_FLOODPLAIN, T_UNPROTECTED, T_WATER } from '../map/grid';
import type { GameState } from '../state';

const queue = new Int32Array(GRID_CELLS);
const nb = new Int32Array(4);

/** Ghi 1 vào `out[o]` cho mọi ô đất bị ngập ở mực lũ `level` (0 = không ngập ô nào). */
export function computeFlood(g: Grid, level: number, out: Uint8Array): void {
  out.fill(0);
  if (level <= 0) return;
  let head = 0, tail = 0;
  for (let o = 0; o < GRID_CELLS; o++) if (g.terrain[o] & T_WATER) { queue[tail++] = o; out[o] = 2; }
  while (head < tail) {
    const o = queue[head++];
    neighbors4(o, nb);
    for (let k = 0; k < 4; k++) {
      const n = nb[k];
      if (n < 0 || out[n]) continue;
      if (g.elevation[n] + g.dike[n] < level) { out[n] = 1; queue[tail++] = n; }
    }
  }
  for (let o = 0; o < GRID_CELLS; o++) if (out[o] === 2) out[o] = 0; // ô sông không tính là "ngập"
}

const buf = new Uint8Array(GRID_CELLS);

/** Áp kết quả flood-fill vào cờ T_FLOODED, đánh dirty ô đổi. Trả số ô đang ngập. */
export function applyFlood(s: GameState, level: number): number {
  const g = s.grid;
  computeFlood(g, level, buf);
  let n = 0;
  for (let o = 0; o < GRID_CELLS; o++) {
    const was = (g.terrain[o] & T_FLOODED) !== 0;
    const now = buf[o] === 1;
    if (now) n++;
    if (was === now) continue;
    if (now) g.terrain[o] |= T_FLOODED; else g.terrain[o] &= ~T_FLOODED;
    s.dirty.add(o);
  }
  return n;
}

/** Ô bãi bồi mà lũ vừa (mức 2) vẫn lan tới được với đê hiện có → T_UNPROTECTED. Gọi khi đê đổi. */
export function updateProtection(s: GameState): void {
  const g = s.grid;
  computeFlood(g, 2, buf);
  for (let o = 0; o < GRID_CELLS; o++) {
    if (!(g.terrain[o] & T_FLOODPLAIN)) continue;
    const was = (g.terrain[o] & T_UNPROTECTED) !== 0;
    const now = buf[o] === 1;
    if (was === now) continue;
    if (now) g.terrain[o] |= T_UNPROTECTED; else g.terrain[o] &= ~T_UNPROTECTED;
    s.dirty.add(o);
  }
}

/** Khoảng cách BFS 4 hướng tới ô sông gần nhất (tối đa 255), tính một lần sau khi sinh bản đồ. */
export function computeWaterDist(g: Grid): void {
  g.waterDist.fill(255);
  let head = 0, tail = 0;
  for (let o = 0; o < GRID_CELLS; o++) if (g.terrain[o] & T_WATER) { queue[tail++] = o; g.waterDist[o] = 0; }
  while (head < tail) {
    const o = queue[head++];
    const d = g.waterDist[o] + 1;
    if (d >= 255) continue;
    neighbors4(o, nb);
    for (let k = 0; k < 4; k++) {
      const n = nb[k];
      if (n >= 0 && g.waterDist[n] > d) { g.waterDist[n] = d; queue[tail++] = n; }
    }
  }
}
