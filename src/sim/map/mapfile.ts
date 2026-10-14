// M6b: nạp bản đồ thật từ file src/data/maps/*.json thay cho bản đồ sinh ngẫu nhiên.
// File ghi cao độ, sông, cửa ngõ, cửa sông, mép giặc vào và đất cấp theo phẩm hàm. Bãi bồi (đất thấp nối sông) suy ra khi nạp.
// Ô ghi bằng một ký tự mỗi ô, 160 dòng × 160 ký tự: '~' nước, '0'–'4' cao độ đất, 't' cây trên đất cao 2, 'T' cây trên đất cao 3.
import { GRID_SIZE, type Grid, gridOffset, inBounds, T_FLOODPLAIN, T_RESERVED, T_TREE, T_WATER } from './grid';
import type { InvasionSource } from '../state';

export interface LandGrant { rank: number; rect: [number, number, number, number] }
export interface MapDef {
  name: string;
  size: number;
  /** [x, y] ô đất ở mép: dân nhập cư, đoàn buôn vào */
  entry: [number, number];
  /** [x, y] ô nước ở mép: thuyền buôn và cướp biển vào */
  riverMouth: [number, number];
  /** ô đất ở mép giặc từng nguồn vào; thiếu = tự tìm theo hướng (war.ts) */
  enemy?: Partial<Record<InvasionSource, [number, number]>>;
  /** đất được cấp: ô xây được khi nằm trong một hình chữ nhật có rank ≤ phẩm hàm; rỗng = cả bản đồ */
  land?: LandGrant[];
  rows: string[];
}

export const MAP_LEGEND = { water: '~', tree2: 't', tree3: 'T' } as const;

/** Ghi địa hình từ file vào lưới. Ném lỗi nếu file sai cỡ hoặc ký tự lạ. */
export function applyMapFile(g: Grid, m: MapDef): void {
  const n = GRID_SIZE;
  if (m.size !== n || m.rows.length !== n) throw new Error(`Bản đồ ${m.name}: cần ${n} dòng, có ${m.rows.length}`);
  for (let y = 0; y < n; y++) {
    const row = m.rows[y];
    if (row.length !== n) throw new Error(`Bản đồ ${m.name}: dòng ${y} dài ${row.length}, cần ${n}`);
    for (let x = 0; x < n; x++) {
      const c = row[x], i = gridOffset(x, y);
      if (c === MAP_LEGEND.water) { g.terrain[i] = T_WATER; g.elevation[i] = 0; }
      else if (c === MAP_LEGEND.tree2) { g.terrain[i] = T_TREE; g.elevation[i] = 2; }
      else if (c === MAP_LEGEND.tree3) { g.terrain[i] = T_TREE; g.elevation[i] = 3; }
      else if (c >= '0' && c <= '4') { g.terrain[i] = 0; g.elevation[i] = c.charCodeAt(0) - 48; }
      else throw new Error(`Bản đồ ${m.name}: ký tự lạ "${c}" tại (${x}, ${y})`);
    }
  }
  // bãi bồi: flood-fill từ sông qua ô đất cao độ ≤ 1 (cùng quy tắc với terrain.ts)
  const stack: number[] = [];
  const seen = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) if (g.terrain[i] & T_WATER) { stack.push(i); seen[i] = 1; }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % n, y = (i / n) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!inBounds(nx, ny)) continue;
      const j = gridOffset(nx, ny);
      if (seen[j] || g.terrain[j] & T_WATER) continue;
      if (g.elevation[j] <= 1) { seen[j] = 1; g.terrain[j] |= T_FLOODPLAIN; stack.push(j); }
    }
  }
  const tileAt = (p: [number, number], what: string, water: boolean) => {
    const [x, y] = p;
    if (!inBounds(x, y)) throw new Error(`Bản đồ ${m.name}: ${what} (${x}, ${y}) ngoài biên`);
    if (((g.terrain[gridOffset(x, y)] & T_WATER) !== 0) !== water) throw new Error(`Bản đồ ${m.name}: ${what} (${x}, ${y}) phải là ô ${water ? 'nước' : 'đất'}`);
  };
  tileAt(m.entry, 'cửa ngõ', false);
  tileAt(m.riverMouth, 'cửa sông', true);
  for (const [k, p] of Object.entries(m.enemy ?? {})) if (p) tileAt(p, `mép giặc ${k}`, false);
}

/** Đặt cờ đất chưa cấp theo phẩm hàm hiện tại: ô ngoài mọi hình chữ nhật có rank ≤ phẩm hàm thì T_RESERVED. Trả về số ô vừa mở; ô đổi cờ ghi vào `dirty`. */
export function applyLandGrants(g: Grid, land: LandGrant[] | undefined, rank: number, dirty?: Set<number>): number {
  const n = GRID_SIZE;
  if (!land || land.length === 0) {
    let opened = 0;
    for (let i = 0; i < n * n; i++) if (g.terrain[i] & T_RESERVED) { g.terrain[i] &= ~T_RESERVED; opened++; dirty?.add(i); }
    return opened;
  }
  const open = new Uint8Array(n * n);
  for (const gr of land) {
    if (gr.rank > rank) continue;
    const [x0, y0, x1, y1] = gr.rect;
    for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) open[gridOffset(x, y)] = 1;
  }
  let opened = 0;
  for (let i = 0; i < n * n; i++) {
    const was = (g.terrain[i] & T_RESERVED) !== 0;
    if (open[i] || g.terrain[i] & T_WATER) { if (was) { g.terrain[i] &= ~T_RESERVED; opened++; dirty?.add(i); } }
    else if (!was) { g.terrain[i] |= T_RESERVED; dirty?.add(i); }
  }
  return opened;
}
