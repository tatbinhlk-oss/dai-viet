// Đê điều (sheet ground): đoạn đê cao 0–4 (`dike{h}`), đê có đường vắt qua (`dike{h}_road`), cống đóng / mở (`sluice{h}_closed|open`).
// Hình học như hình tạm: trọn hình thoi nâng lên dikeHeightPx(h) với hai mặt trước là sườn đê, nên các đoạn kề nhau nối liền.
import { canvas, darken, hex, HALF_H, HALF_W, lighten, line, poly, rng, TILE_H, TILE_W, type Canvas, type Ctx } from './lib';
import { dikeHeightPx } from '../../src/render/palette';

const EARTH = 0x8a7046, EARTH_DARK = 0x6a5436, TOP = 0x9a8452, GRASS = 0x6f8f3a, ROAD = 0xb89a62, RUT = 0x86694a, WOOD_DARK = 0x5e4020, WOOD = 0x9a7040, WATER = 0x3b6e9c;

interface Geo { g: Ctx; H: number; hp: number; L: [number, number]; R: [number, number]; B: [number, number]; T: [number, number] }
function geo(h: number): { c: Canvas; d: Geo } {
  const hp = dikeHeightPx(h), H = TILE_H + hp;
  const c = canvas(TILE_W, H);
  const g = c.getContext('2d');
  return { c, d: { g, H, hp, L: [0, H - HALF_H], R: [TILE_W, H - HALF_H], B: [HALF_W, H], T: [HALF_W, H - TILE_H] } };
}
const up = (p: [number, number], z: number): [number, number] => [p[0], p[1] - z];

/** Thân đê: hai sườn trước có vân đất và cỏ chân, mặt trên tô `top`. Nới 0,8 px chống khe. */
function body(d: Geo, top: string, seed: number): void {
  const { g, hp, L, R, B, T } = d;
  const E = 0.8;
  const Le: [number, number] = [L[0] - E * 2, L[1]], Re: [number, number] = [R[0] + E * 2, R[1]], Be: [number, number] = [B[0], B[1] + E], Te: [number, number] = [T[0], T[1] - E];
  poly(g, [Le, up(Le, hp), up(Be, hp), Be], hex(EARTH));
  poly(g, [Be, up(Be, hp), up(Re, hp), Re], hex(EARTH_DARK));
  const r = rng(seed);
  for (let z = 2.5; z < hp; z += 3) { line(g, up(L, z), up(B, z), hex(darken(EARTH, 0.22)), 0.6); line(g, up(B, z), up(R, z), hex(darken(EARTH_DARK, 0.2)), 0.6); }
  for (let i = 0; i < 6; i++) { const t = r(); const a: [number, number] = [L[0] + (B[0] - L[0]) * t, L[1] + (B[1] - L[1]) * t]; line(g, a, [a[0] + 0.6, a[1] - 2 - r()], hex(GRASS), 0.7); const b: [number, number] = [B[0] + (R[0] - B[0]) * t, B[1] + (R[1] - B[1]) * t]; line(g, b, [b[0] - 0.6, b[1] - 2 - r()], hex(darken(GRASS, 0.2)), 0.7); }
  poly(g, [up(Te, hp), up(Re, hp), up(Be, hp), up(Le, hp)], top);
}

export function dike(h: number, road: boolean): Canvas {
  const { c, d } = geo(h);
  const { g, hp, L, R, B, T } = d;
  const r = rng(900 + h * 7 + (road ? 1 : 0));
  if (h === 0) {
    // mới vẽ: gờ đất thấp + cọc tre cắm mốc, dây căng
    body(d, hex(darken(TOP, 0.1)), 901);
    for (const p of [T, L, R, B].map((q) => [(q[0] + HALF_W) / 2, (q[1] + (d.H - HALF_H)) / 2 - hp] as [number, number])) { line(g, p, [p[0], p[1] - 7], hex(WOOD), 1); g.fillStyle = hex(0xe03030); g.fillRect(p[0] - 1.5, p[1] - 8, 3, 1.5); }
    return c;
  }
  body(d, hex(road ? ROAD : TOP), 900 + h);
  g.save();
  g.beginPath(); g.moveTo(T[0], T[1] - hp); g.lineTo(R[0], R[1] - hp); g.lineTo(B[0], B[1] - hp); g.lineTo(L[0], L[1] - hp); g.closePath(); g.clip();
  if (road) {
    for (const off of [-5, 5]) line(g, [L[0] + 8, L[1] - hp + off * 0.5], [R[0] - 8, R[1] - hp + off * 0.5], `rgba(134,105,74,0.5)`, 1);
    for (let i = 0; i < 8; i++) { const u = r(), v = r(); g.fillStyle = hex(r() < 0.5 ? darken(ROAD, 0.3) : lighten(ROAD, 0.3)); g.fillRect(HALF_W + (u - v) * HALF_W, (u + v) * HALF_H + d.H - TILE_H - hp, 0.8, 0.6); }
  } else {
    // mặt đê: đất nện, cỏ thưa hai mép
    for (let i = 0; i < 10; i++) { const u = r(), v = r(); const x = HALF_W + (u - v) * HALF_W, y = (u + v) * HALF_H + d.H - TILE_H - hp; const edge = Math.min(u, v, 1 - u, 1 - v) < 0.2; g.fillStyle = hex(edge ? GRASS : darken(TOP, 0.2)); if (edge) { line(g, [x, y], [x + 0.6, y - 2], hex(GRASS), 0.7); } else g.fillRect(x, y, 1, 0.7); }
  }
  g.restore();
  void RUT;
  return c;
}

export function sluice(h: number, open: boolean): Canvas {
  const { c, d } = geo(h);
  const { g, hp, L, R, B, T } = d;
  body(d, hex(TOP), 950 + h);
  // rãnh nước xuyên đê (từ mép sau-trái tới mép trước-phải) và khung cống gỗ ở giữa
  const cx = HALF_W, cy = d.H - HALF_H - hp;
  poly(g, [[T[0] - 4, T[1] - hp + 2], [T[0] + 4, T[1] - hp + 2], [B[0] + 4, B[1] - hp - 2], [B[0] - 4, B[1] - hp - 2]], hex(open ? WATER : darken(TOP, 0.35)));
  if (open) for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(200,225,240,0.6)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(cx - 2, cy - 6 + i * 5); g.quadraticCurveTo(cx, cy - 7 + i * 5, cx + 2, cy - 6 + i * 5); g.stroke(); }
  // hai cột và xà ngang
  line(g, [cx - 6, cy + 3], [cx - 6, cy - 14], hex(WOOD_DARK), 1.6); line(g, [cx + 6, cy + 3], [cx + 6, cy - 14], hex(WOOD_DARK), 1.6);
  line(g, [cx - 7, cy - 14], [cx + 7, cy - 14], hex(WOOD_DARK), 2);
  // ván cống: đóng thì chắn ngang rãnh, mở thì kéo lên treo dưới xà
  g.fillStyle = hex(WOOD);
  if (open) { g.fillRect(cx - 5, cy - 13, 10, 6); for (let x = cx - 3; x < cx + 5; x += 2.5) line(g, [x, cy - 13], [x, cy - 7], hex(WOOD_DARK), 0.6); }
  else { g.fillRect(cx - 5, cy - 7, 10, 8); for (let x = cx - 3; x < cx + 5; x += 2.5) line(g, [x, cy - 7], [x, cy + 1], hex(WOOD_DARK), 0.6); }
  // tay quay
  line(g, [cx + 6, cy - 14], [cx + 10, cy - 18], hex(WOOD), 1);
  void L; void R;
  return c;
}

export function dikeFrames(): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (let h = 0; h <= 4; h++) {
    out[`ground/dike${h}.png`] = dike(h, false);
    out[`ground/dike${h}_road.png`] = dike(h, true);
    out[`ground/sluice${h}_closed.png`] = sluice(h, false);
    out[`ground/sluice${h}_open.png`] = sluice(h, true);
  }
  return out;
}
