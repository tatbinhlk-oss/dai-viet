// Đường đất — lớp phủ trong suốt đè lên nền (cỏ / bãi bồi) nên lề đường tự khớp màu đất xung quanh.
// Hình theo kết nối 4 phía (mask bit0 = −y, bit1 = +x, bit2 = +y, bit3 = −x): lõi đất ở giữa + nhánh tới mỗi cạnh có đường kề,
// cạnh nhánh chạm đúng mép ô để hai ô liền nhau nối liền. Mỗi mask có VARIANTS biến thể (sỏi, vệt bụi, bụi cỏ, vết bánh xe
// đặt theo RNG xác định) — render chọn biến thể theo băm tọa độ ô nên đường dài không lặp.
import { darken, hex, lighten, line, mix, rng, scene, type Canvas, type Scene } from './lib';

export const ROAD_VARIANTS = 3;
const DIRT = 0xa8895a, DIRT_DUST = 0xc2a872, DIRT_RUT = 0x86694a, GRASS = 0x6f8f3a, GRASS_DRY = 0x9aa04a;
const A = 0.2, B = 0.8; // lề đường trong ô (u, v)
const M = 0.08; // dải cỏ mòn quanh đường

type Rect = [number, number, number, number]; // u0, v0, u1, v1

/** Các hình chữ nhật (u, v) tạo nên đường theo mask, nở thêm `m` sang hai bên (không nở qua mép ô). */
function shapes(mask: number, m: number): Rect[] {
  const a = A - m, b = B + m;
  if (mask === 0) return [[0.28 - m, 0.28 - m, 0.72 + m, 0.72 + m]];
  const out: Rect[] = [[a, a, b, b]];
  if (mask & 1) out.push([a, 0, b, A + 0.01]);
  if (mask & 2) out.push([B - 0.01, a, 1, b]);
  if (mask & 4) out.push([a, B - 0.01, b, 1]);
  if (mask & 8) out.push([0, a, A + 0.01, b]);
  return out;
}

function fillRects(s: Scene, rects: Rect[], fill: string): void {
  const g = s.g;
  g.fillStyle = fill;
  for (const [u0, v0, u1, v1] of rects) {
    g.beginPath();
    const p = [s.p(u0, v0), s.p(u1, v0), s.p(u1, v1), s.p(u0, v1)];
    g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) g.lineTo(p[i][0], p[i][1]); g.closePath();
    g.fill();
  }
}

function clipRects(s: Scene, rects: Rect[], draw: () => void): void {
  const g = s.g;
  g.save();
  g.beginPath();
  for (const [u0, v0, u1, v1] of rects) {
    const p = [s.p(u0, v0), s.p(u1, v0), s.p(u1, v1), s.p(u0, v1)];
    g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) g.lineTo(p[i][0], p[i][1]); g.closePath();
  }
  g.clip();
  draw();
  g.restore();
}

const inRects = (rects: Rect[], u: number, v: number): boolean => rects.some(([u0, v0, u1, v1]) => u >= u0 && u <= u1 && v >= v0 && v <= v1);

/** Một ô đường: mask kết nối, biến thể k. 64×32, nền trong suốt. */
export function roadTile(mask: number, k: number): Canvas {
  const s = scene(1, 0);
  const g = s.g;
  const r = rng(mask * 101 + k * 7919 + 13);
  const core = shapes(mask, 0), worn = shapes(mask, M);
  // dải cỏ mòn: cỏ úa lẫn đất, mờ dần để hòa với nền
  fillRects(s, worn, `rgba(${(GRASS_DRY >> 16) & 255},${(GRASS_DRY >> 8) & 255},${GRASS_DRY & 255},0.55)`);
  fillRects(s, shapes(mask, M / 2), `rgba(${(mix(GRASS_DRY, DIRT, 0.6) >> 16) & 255},${(mix(GRASS_DRY, DIRT, 0.6) >> 8) & 255},${mix(GRASS_DRY, DIRT, 0.6) & 255},0.7)`);
  // lõi đất, màu hơi lệch theo biến thể
  const dirt = mix(DIRT, k === 1 ? DIRT_DUST : k === 2 ? DIRT_RUT : DIRT, 0.25);
  fillRects(s, core, hex(dirt));
  clipRects(s, core, () => {
    // vệt bụi sáng loang
    for (let i = 0; i < 4; i++) {
      const u = A + (B - A) * r(), v = A + (B - A) * r();
      if (!inRects(core, u, v)) continue;
      const [x, y] = s.p(u, v);
      g.fillStyle = `rgba(${(DIRT_DUST >> 16) & 255},${(DIRT_DUST >> 8) & 255},${DIRT_DUST & 255},${0.35 + r() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, 4 + r() * 5, 1.5 + r() * 1.5, 0, 0, Math.PI * 2); g.fill();
    }
    // vết bánh xe: hai rãnh song song theo trục đường thẳng
    if (mask === 5 || mask === 10) {
      for (const off of [-0.17, 0.17]) {
        const pts = mask === 5 ? [s.p(0.5 + off, 0), s.p(0.5 + off, 1)] : [s.p(0, 0.5 + off), s.p(1, 0.5 + off)];
        line(g, pts[0], pts[1], `rgba(${(DIRT_RUT >> 16) & 255},${(DIRT_RUT >> 8) & 255},${DIRT_RUT & 255},${0.45 + k * 0.1})`, 1);
      }
    }
    // sỏi
    for (let i = 0; i < 9; i++) {
      const u = r(), v = r();
      if (!inRects(core, u, v)) continue;
      const [x, y] = s.p(u, v);
      g.fillStyle = hex(r() < 0.5 ? darken(dirt, 0.3) : lighten(dirt, 0.3));
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  });
  // bụi cỏ lấn vào lề (ở dải mòn, ngoài lõi)
  for (let i = 0; i < 6; i++) {
    const u = r(), v = r();
    if (inRects(core, u, v) || !inRects(worn, u, v)) continue;
    const [x, y] = s.p(u, v);
    const col = hex(r() < 0.5 ? GRASS : lighten(GRASS, 0.2));
    line(g, [x, y], [x - 1, y - 2 - r()], col, 1); line(g, [x, y], [x + 1, y - 2 - r()], col, 1);
  }
  return s.c;
}

export function roadFrames(): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (let mask = 0; mask < 16; mask++) for (let k = 0; k < ROAD_VARIANTS; k++) out[`ground/road_${mask}_${k}.png`] = roadTile(mask, k);
  return out;
}
