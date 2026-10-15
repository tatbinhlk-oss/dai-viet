// Nền đất vẽ thật: cỏ theo cao độ (4 biến thể, bụi cỏ và hoa dại rải rác), bãi bồi (vệt bùn, cỏ thưa), sông (gợn sóng),
// đất trũng, nền móng, nước lũ phủ; cây: bụi tre (3 biến thể) và cây đa — render chọn biến thể theo băm tọa độ ô.
// Cây là sprite ở lớp công trình (zIndex theo ô) để ngọn tre che đúng thứ tự trước / sau.
import { canvas, darken, hex, HALF_H, HALF_W, lighten, line, poly, rng, TILE_H, TILE_W, type Canvas, type Ctx } from './lib';
import { COLOR } from '../../src/render/palette';

export const GROUND_VARIANTS = 6;
export const TREE_VARIANTS = 4;

/** Ô hình thoi 64×32 tô màu `fill`; vẽ thêm bằng `draw` trong vùng cắt hình thoi. */
function tile(fill: string, draw?: (g: Ctx, r: () => number) => void, seed = 1): Canvas {
  const c = canvas(TILE_W, TILE_H);
  const g = c.getContext('2d');
  // hình thoi nới ra 0,8 px mỗi phía: mép không còn pixel nửa trong suốt (lọc tuyến tính ở 2× làm lộ khe giữa hai ô)
  const E = 0.8;
  const pts: [number, number][] = [[HALF_W, -E], [TILE_W + E * 2, HALF_H], [HALF_W, TILE_H + E], [-E * 2, HALF_H]];
  poly(g, pts, fill);
  if (draw) {
    g.save();
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.clip();
    draw(g, rng(seed));
    g.restore();
  }
  return c;
}
/** Điểm ngẫu nhiên trong hình thoi. */
const inTile = (r: () => number): [number, number] => { const u = r(), v = r(); return [HALF_W + (u - v) * HALF_W, (u + v) * HALF_H]; };

export function grassTile(e: number, k: number): Canvas {
  const base = COLOR.grass[Math.min(4, e)];
  return tile(hex(base), (g, r) => {
    // loang màu rất nhẹ (vệt to mờ để nối với ô kề, không thành đốm)
    for (let i = 0; i < 2 + (k % 3); i++) { const [x, y] = inTile(r); g.fillStyle = hex(r() < 0.5 ? darken(base, 0.035) : lighten(base, 0.04)); g.beginPath(); g.ellipse(x, y, 10 + r() * 14, 3 + r() * 4, 0, 0, Math.PI * 2); g.fill(); }
    // bụi cỏ (mật độ khác nhau theo biến thể)
    for (let i = 0; i < 8 + ((k * 5) % 11); i++) { const [x, y] = inTile(r); const col = hex(r() < 0.5 ? darken(base, 0.22) : lighten(base, 0.2)); line(g, [x, y], [x - 0.8, y - 2 - r() * 1.5], col, 0.6); line(g, [x, y], [x + 0.8, y - 2 - r()], col, 0.6); }
    // hoa dại (biến thể 1 và 3)
    if (k % 2 === 1) for (let i = 0; i < 2; i++) { const [x, y] = inTile(r); g.fillStyle = r() < 0.5 ? '#f0e070' : '#f0f0f0'; g.fillRect(x, y - 1, 1, 1); g.fillRect(x + 2, y - 2, 1, 1); }
  }, 1000 + e * 10 + k);
}

export function floodplainTile(k: number): Canvas {
  const base = COLOR.floodplain;
  return tile(hex(base), (g, r) => {
    for (let i = 0; i < (k % 2); i++) { const [x, y] = inTile(r); g.fillStyle = hex(darken(base, 0.035 + r() * 0.035)); g.beginPath(); g.ellipse(x, y, 10 + r() * 12, 3 + r() * 3, 0, 0, Math.PI * 2); g.fill(); } // vệt bùn (nhẹ, chỉ ở nửa số biến thể)
    for (let i = 0; i < 2; i++) { const [x, y] = inTile(r); g.fillStyle = 'rgba(170,190,205,0.25)'; g.beginPath(); g.ellipse(x, y, 4 + r() * 4, 1.2 + r(), 0, 0, Math.PI * 2); g.fill(); } // ánh nước
    for (let i = 0; i < 6 + k * 2; i++) { const [x, y] = inTile(r); const col = hex(r() < 0.5 ? darken(base, 0.25) : lighten(base, 0.18)); line(g, [x, y], [x - 0.6, y - 1.5 - r()], col, 0.6); line(g, [x, y], [x + 0.8, y - 1.8 - r()], col, 0.6); }
  }, 1100 + k);
}

export function waterTile(k: number): Canvas {
  const base = COLOR.water;
  return tile(hex(base), (g, r) => {
    for (let i = 0; i < 1 + (k % 2); i++) { const [x, y] = inTile(r); g.fillStyle = hex(r() < 0.5 ? darken(base, 0.05) : lighten(base, 0.05)); g.beginPath(); g.ellipse(x, y, 10 + r() * 12, 2.5 + r() * 2.5, 0, 0, Math.PI * 2); g.fill(); }
    // gợn sóng: nét sáng ngắn lượn theo trục ngang, lệch theo biến thể
    for (let i = 0; i < 3 + (k % 3); i++) {
      const [x, y] = inTile(r); const w = 5 + r() * 6;
      g.strokeStyle = `rgba(200,225,240,${0.35 + r() * 0.3})`; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w / 2, y - 1.2, x, y); g.quadraticCurveTo(x + w / 2, y + 1.2, x + w, y); g.stroke();
    }
  }, 1200 + k);
}

export function sunkenTile(): Canvas {
  const base = COLOR.sunken;
  return tile(hex(base), (g, r) => { for (let i = 0; i < 4; i++) { const [x, y] = inTile(r); g.fillStyle = hex(darken(base, 0.2)); g.beginPath(); g.ellipse(x, y, 6 + r() * 6, 2 + r() * 2, 0, 0, Math.PI * 2); g.fill(); } for (let i = 0; i < 8; i++) { const [x, y] = inTile(r); g.fillStyle = hex(r() < 0.5 ? darken(base, 0.35) : lighten(base, 0.2)); g.fillRect(x, y, 1.2, 0.8); } }, 1300);
}
export function floorTile(): Canvas {
  const base = COLOR.floor;
  return tile(hex(base), (g, r) => { for (let i = 0; i < 10; i++) { const [x, y] = inTile(r); g.fillStyle = hex(r() < 0.5 ? darken(base, 0.25) : lighten(base, 0.15)); g.fillRect(x, y, 1.5, 0.8); } }, 1400);
}
/** Nước lũ phủ lên ô (nửa trong suốt, có gợn). */
export function floodedTile(): Canvas {
  const c = canvas(TILE_W, TILE_H);
  const g = c.getContext('2d');
  g.globalAlpha = 0.62;
  poly(g, [[HALF_W, -0.8], [TILE_W + 1.6, HALF_H], [HALF_W, TILE_H + 0.8], [-1.6, HALF_H]], hex(COLOR.flooded));
  g.globalAlpha = 0.5; const r = rng(1500);
  for (let i = 0; i < 3; i++) { const [x, y] = inTile(r); const w = 4 + r() * 5; g.strokeStyle = '#d0e4f0'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - 1.5, x + w, y); g.stroke(); }
  return c;
}

/** Bụi tre: 6–9 cây thon cao nghiêng ra, đốt sẫm, lá dài ở ngọn. Ảnh 64×(32+H), gốc ở tâm ô. */
export function bamboo(k: number): Canvas {
  const H = 60;
  const c = canvas(TILE_W, TILE_H + H);
  const g = c.getContext('2d');
  const r = rng(1600 + k);
  const bx = HALF_W, by = H + HALF_H; // tâm ô
  // bóng gốc
  g.fillStyle = 'rgba(20,30,10,0.25)'; g.beginPath(); g.ellipse(bx + 2, by + 1, 11, 4.5, 0, 0, Math.PI * 2); g.fill();
  const n = 6 + Math.floor(r() * 4);
  const culms: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) { const lean = (i / (n - 1) - 0.5) * 16 + (r() - 0.5) * 4, h = 34 + r() * 20 + k * 2, x0 = bx + (r() - 0.5) * 8; culms.push([x0, lean, h, r()]); }
  culms.sort((a, b) => a[2] - b[2]);
  for (const [x0, lean, h, t] of culms) {
    const col = t < 0.5 ? 0x9ab84a : 0xb8c860, dark = darken(col, 0.45);
    // thân cong nhẹ
    g.strokeStyle = hex(col); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, by); g.quadraticCurveTo(x0 + lean * 0.3, by - h * 0.55, x0 + lean, by - h); g.stroke();
    // đốt
    for (let z = 5; z < h - 4; z += 6 + r() * 2) { const tt = z / h; const x = x0 + lean * (2 * tt * (1 - tt) * 0.3 + tt * tt), y = by - z; line(g, [x - 1.2, y], [x + 1.2, y], hex(dark), 0.8); }
    // lá ở ngọn và lưng chừng
    const leaf = (x: number, y: number, dir: number) => { for (let j = 0; j < 4; j++) { const a = -0.3 - j * 0.45, L = 5 + r() * 4; g.strokeStyle = hex(j % 2 ? 0x3f7a2a : 0x5a9a3a); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L * dir, y + Math.sin(a) * L * 0.6 - 1); g.stroke(); } };
    leaf(x0 + lean, by - h, lean >= 0 ? 1 : -1); leaf(x0 + lean, by - h, lean >= 0 ? -1 : 1);
    leaf(x0 + lean * 0.75, by - h * 0.75, lean >= 0 ? 1 : -1);
  }
  return c;
}

/** Cây đa: gốc to, tán rộng nhiều tầng, rễ phụ buông. */
export function banyan(): Canvas {
  const H = 56;
  const c = canvas(TILE_W, TILE_H + H);
  const g = c.getContext('2d');
  const r = rng(1700);
  const bx = HALF_W, by = H + HALF_H;
  g.fillStyle = 'rgba(20,30,10,0.28)'; g.beginPath(); g.ellipse(bx + 2, by + 1, 20, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x5a4030); g.beginPath(); g.moveTo(bx - 6, by); g.lineTo(bx - 3, by - 22); g.lineTo(bx + 3, by - 22); g.lineTo(bx + 6, by); g.closePath(); g.fill();
  for (const dx of [-9, -4, 5, 10]) line(g, [bx + dx, by - 1], [bx + dx * 0.4, by - 24], hex(0x6a5040), 1); // rễ phụ
  for (const [dx, dy, rx, ry, col] of [[-10, -30, 16, 9, 0x355f22], [10, -32, 16, 9, 0x3f6a2a], [0, -42, 20, 10, 0x4a7a32], [-6, -50, 12, 6, 0x5a8a3a], [8, -48, 11, 6, 0x5f903f]] as [number, number, number, number, number][]) { g.fillStyle = hex(col); g.beginPath(); g.ellipse(bx + dx, by + dy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 12; i++) { g.fillStyle = hex(r() < 0.5 ? 0x6aa048 : 0x2e5a1e); g.beginPath(); g.ellipse(bx + (r() - 0.5) * 36, by - 30 - r() * 22, 2, 1.2, 0, 0, Math.PI * 2); g.fill(); }
  return c;
}

export function groundFrames(): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (let e = 0; e < 5; e++) for (let k = 0; k < GROUND_VARIANTS; k++) out[`ground/grass${e}_${k}.png`] = grassTile(e, k);
  for (let k = 0; k < GROUND_VARIANTS; k++) { out[`ground/floodplain_${k}.png`] = floodplainTile(k); out[`ground/water_${k}.png`] = waterTile(k); }
  out['ground/sunken.png'] = sunkenTile();
  out['ground/floor.png'] = floorTile();
  out['ground/flooded.png'] = floodedTile();
  for (let k = 0; k < 3; k++) out[`ground/tree_${k}.png`] = bamboo(k);
  out['ground/tree_3.png'] = banyan();
  return out;
}
