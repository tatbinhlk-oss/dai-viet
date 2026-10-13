// Sinh bản đồ thử nghiệm: một con sông uốn từ bắc xuống nam, elevation theo khoảng cách tới sông,
// vùng ngập tiềm năng = ô elevation ≤ 1 nối liền với sông (flood-fill). Kịch bản thật sẽ nạp từ file ở M6.
import { type Rng, nextFloat, nextInt } from '../rng';
import { GRID_SIZE, type Grid, gridOffset, inBounds, T_FLOODPLAIN, T_TREE, T_WATER } from './grid';

export interface TerrainOptions {
  /** Bản đồ phẳng cho test: sông thẳng ở mép trái (x < 4), toàn bộ đất là bãi bồi elevation 1, không cây. */
  flat?: boolean;
}

export function generateTerrain(g: Grid, rng: Rng, opts: TerrainOptions = {}): void {
  const n = GRID_SIZE;
  if (opts.flat) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = gridOffset(x, y);
        if (x < 4) { g.terrain[i] = T_WATER; g.elevation[i] = 0; }
        else { g.terrain[i] = T_FLOODPLAIN; g.elevation[i] = 1; }
      }
    }
    return;
  }
  // 1. Tim sông: x = trung tâm + sin, với hai chu kỳ nhiễu
  const phase1 = nextFloat(rng) * Math.PI * 2;
  const phase2 = nextFloat(rng) * Math.PI * 2;
  const center = new Float32Array(n);
  for (let y = 0; y < n; y++) {
    center[y] = n / 2 + 22 * Math.sin(y / 23 + phase1) + 9 * Math.sin(y / 7.5 + phase2);
  }
  // 2. Khoảng cách tới tim sông → nước (≤ 3 ô) và elevation
  const halfWidth = 3;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = gridOffset(x, y);
      const d = Math.abs(x - center[y]);
      if (d <= halfWidth) {
        g.terrain[i] = T_WATER;
        g.elevation[i] = 0;
      } else {
        // elevation tăng dần theo khoảng cách, có nhiễu nhẹ
        const base = (d - halfWidth) / 14 + (nextFloat(rng) - 0.5) * 0.9;
        g.elevation[i] = Math.max(0, Math.min(4, Math.round(base)));
      }
    }
  }
  // 3. Flood-fill từ sông qua ô đất có elevation ≤ 1 → FLOODPLAIN
  const stack: number[] = [];
  const seen = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) if (g.terrain[i] & T_WATER) { stack.push(i); seen[i] = 1; }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % n, y = (i / n) | 0;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (!inBounds(nx, ny)) continue;
      const j = gridOffset(nx, ny);
      if (seen[j]) continue;
      if (g.terrain[j] & T_WATER) continue;
      if (g.elevation[j] <= 1) {
        seen[j] = 1;
        g.terrain[j] |= T_FLOODPLAIN;
        stack.push(j);
      }
    }
  }
  // 4. Cây rải rác trên đất cao
  for (let i = 0; i < n * n; i++) {
    if (g.terrain[i] === 0 && g.elevation[i] >= 2 && nextInt(rng, 100) < 7) g.terrain[i] |= T_TREE;
  }
}
