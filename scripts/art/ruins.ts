// Đống tro ba giai đoạn (cỡ 1–3): `ruins_n` đang cháy (nền cháy đen, cột cháy dở, xà đổ, than hồng — lửa là frame riêng
// `fire_n_k` 4 khung hoạt ảnh đè lên), `ash_n` tro nguội (gò tro xám, cột cháy, khói mỏng), `rubble_n` sập (mảng tường vỡ, xà nghiêng, gạch vụn).
import { canvas, darken, hex, HALF_H, HALF_W, lighten, line, poly, polyUV, rng, scene, type Canvas, type Scene } from './lib';

const CHAR = 0x1e1a16, CHAR_LIGHT = 0x3a3430, ASH = 0x6a6660, ASH_LIGHT = 0x8a867e, EMBER = 0xff6a20, EMBER_HOT = 0xffd040;
const BRICK = 0x9a5a42, BRICK_DARK = 0x6a3a2a, WOOD_DARK = 0x5e4020, TILE = 0x8a4a3a, DUST = 0xb8a890;

/** Nền ô cháy đen / tro, hơi nhỏ hơn móng. */
function scorched(s: Scene, n: number, col: number, inset = 0.04): void {
  polyUV(s, [[inset, inset, 0], [n - inset, inset, 0], [n - inset, n - inset, 0], [inset, n - inset, 0]], hex(col));
}

/** Cột cháy dở tại (u, v) cao h, hơi nghiêng. */
function charredPost(s: Scene, u: number, v: number, h: number, lean: number): void {
  line(s.g, s.p(u, v, 0), [s.p(u, v, h)[0] + lean, s.p(u, v, h)[1]], hex(CHAR), 2);
  line(s.g, s.p(u, v, 0), [s.p(u, v, h * 0.6)[0] + lean * 0.6, s.p(u, v, h * 0.6)[1]], hex(CHAR_LIGHT), 0.8);
}

/** Xà gỗ nằm nghiêng từ a tới b (z0 → z1). */
function beam(s: Scene, a: [number, number, number], b: [number, number, number], col: number): void {
  line(s.g, s.p(...a), s.p(...b), hex(col), 2.5);
  line(s.g, s.p(...a), s.p(...b), hex(lighten(col, 0.25)), 0.8);
}

export function ruins(n: number): Canvas {
  const s = scene(n, 20);
  const r = rng(500 + n);
  scorched(s, n, CHAR);
  // vệt tro xám loang
  for (let i = 0; i < 5 * n; i++) { const [x, y] = s.p(0.1 + r() * (n - 0.2), 0.1 + r() * (n - 0.2)); s.g.fillStyle = `rgba(90,86,80,${0.3 + r() * 0.3})`; s.g.beginPath(); s.g.ellipse(x, y, 4 + r() * 6, 2 + r() * 2, 0, 0, Math.PI * 2); s.g.fill(); }
  // cột cháy dở quanh móng, xà đổ
  const cols: [number, number][] = n === 1 ? [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]] : [[0.2, 0.2], [n - 0.2, 0.2], [0.2, n - 0.2], [n - 0.2, n - 0.2], [n / 2, 0.2], [n / 2, n - 0.2]];
  for (const [u, v] of cols) charredPost(s, u, v, 6 + r() * 8, (r() - 0.5) * 4);
  beam(s, [0.2, n - 0.3, 9], [n - 0.3, n - 0.2, 0], CHAR);
  beam(s, [n - 0.2, 0.3, 7], [0.4, 0.6, 0], CHAR_LIGHT);
  // than hồng
  for (let i = 0; i < 10 * n; i++) { const [x, y] = s.p(0.15 + r() * (n - 0.3), 0.15 + r() * (n - 0.3)); s.g.fillStyle = hex(r() < 0.3 ? EMBER_HOT : EMBER); s.g.fillRect(x, y, 1 + r(), 0.8); }
  return s.c;
}

export function ash(n: number): Canvas {
  const s = scene(n, 20);
  const r = rng(600 + n);
  scorched(s, n, darken(ASH, 0.35));
  // gò tro
  const [cx, cy] = s.p(n / 2, n / 2);
  s.g.fillStyle = hex(ASH); s.g.beginPath(); s.g.ellipse(cx, cy, n * 22, n * 10, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(ASH_LIGHT); s.g.beginPath(); s.g.ellipse(cx - n * 4, cy - n * 3, n * 12, n * 5, 0, 0, Math.PI * 2); s.g.fill();
  for (let i = 0; i < 8 * n; i++) { const [x, y] = s.p(0.2 + r() * (n - 0.4), 0.2 + r() * (n - 0.4)); s.g.fillStyle = hex(r() < 0.5 ? CHAR : darken(ASH, 0.2)); s.g.fillRect(x, y - r() * 3, 1.5 + r() * 2, 1); }
  const cols: [number, number][] = n === 1 ? [[0.25, 0.25], [0.8, 0.75]] : [[0.2, 0.2], [n - 0.2, 0.3], [0.3, n - 0.2]];
  for (const [u, v] of cols) charredPost(s, u, v, 4 + r() * 5, (r() - 0.5) * 3);
  // khói mỏng
  for (let i = 0; i < 3; i++) { const [x, y] = s.p(0.3 + r() * (n - 0.6), 0.3 + r() * (n - 0.6)); for (let k = 0; k < 3; k++) { s.g.fillStyle = `rgba(190,190,190,${0.22 - k * 0.05})`; s.g.beginPath(); s.g.ellipse(x + k * 1.5, y - 6 - k * 5, 2.5 + k, 2 + k * 0.8, 0, 0, Math.PI * 2); s.g.fill(); } }
  return s.c;
}

export function rubble(n: number): Canvas {
  const s = scene(n, 24);
  const r = rng(700 + n);
  scorched(s, n, DUST, 0.08);
  // mảng tường vỡ còn đứng (vách trước và phải, răng cưa)
  const h = 6 + n * 2;
  const jag = (a: [number, number], b: [number, number], shade: number) => {
    const pts: [number, number][] = [s.p(a[0], a[1], 0), s.p(b[0], b[1], 0)];
    const steps = 5;
    for (let i = steps; i >= 0; i--) { const t = i / steps; const u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t; pts.push(s.p(u, v, (r() * 0.8 + 0.2) * h)); }
    poly(s.g, pts, hex(darken(BRICK, shade)));
    for (let z = 2; z < h; z += 2.5) line(s.g, s.p(a[0], a[1], z), s.p(b[0], b[1], z), `rgba(60,30,20,0.45)`, 0.6);
  };
  jag([0.15, n - 0.15], [n - 0.15, n - 0.15], 0);
  jag([n - 0.15, n - 0.15], [n - 0.15, 0.15], 0.2);
  // đống gạch vụn, ngói vỡ, xà nghiêng
  for (let i = 0; i < 14 * n; i++) { const [x, y] = s.p(0.2 + r() * (n - 0.4), 0.2 + r() * (n - 0.4)); const c = [BRICK, BRICK_DARK, TILE, DUST][Math.floor(r() * 4)]; s.g.fillStyle = hex(c); s.g.fillRect(x, y - r() * 4, 2 + r() * 2, 1.2 + r()); }
  const [mx, my] = s.p(n * 0.55, n * 0.45);
  s.g.fillStyle = hex(BRICK_DARK); s.g.beginPath(); s.g.ellipse(mx, my, n * 14, n * 6, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(BRICK); s.g.beginPath(); s.g.ellipse(mx - 2, my - 3, n * 9, n * 4, 0, 0, Math.PI * 2); s.g.fill();
  beam(s, [0.3, 0.3, h + 4], [n - 0.4, n - 0.5, 1], WOOD_DARK);
  beam(s, [n - 0.3, 0.4, 2], [0.5, n - 0.3, h], darken(WOOD_DARK, 0.2));
  // bụi mù
  for (let i = 0; i < 3; i++) { const [x, y] = s.p(0.3 + r() * (n - 0.6), 0.3 + r() * (n - 0.6)); s.g.fillStyle = 'rgba(200,185,160,0.3)'; s.g.beginPath(); s.g.ellipse(x, y - 5, 6 + r() * 4, 3, 0, 0, Math.PI * 2); s.g.fill(); }
  return s.c;
}

/** Ngọn lửa: hình giọt nhiều lớp (đỏ → cam → vàng) tại (x, y) cao h, nghiêng lean. */
function flame(g: import('./lib').Ctx, x: number, y: number, h: number, lean: number): void {
  const layers: [number, string][] = [[1, 'rgba(220,60,20,0.85)'], [0.72, 'rgba(255,120,30,0.9)'], [0.45, 'rgba(255,210,70,0.95)']];
  for (const [k, col] of layers) {
    const w = h * 0.45 * k, hh = h * k;
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.9, y - hh * 0.55, x + lean * k, y - hh); g.quadraticCurveTo(x + w * 0.9, y - hh * 0.55, x + w, y); g.closePath(); g.fill();
  }
}

export function fire(n: number, k: number): Canvas {
  const W = n * 64, H = n * 32 + 36;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const r = rng(800 + n * 10 + 0); // vị trí cố định theo cỡ, biến thiên theo khung
  const p = (u: number, v: number): [number, number] => [W / 2 + (u - v) * HALF_W, H - n * 32 + (u + v) * HALF_H];
  const spots: [number, number, number][] = [];
  for (let i = 0; i < 3 + n * 2; i++) spots.push([0.2 + r() * (n - 0.4), 0.2 + r() * (n - 0.4), 10 + r() * 10 + n * 2]);
  spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const ph = (k * Math.PI) / 2;
  // khói đen trước (phía sau lửa)
  for (const [u, v, h] of spots) { const [x, y] = p(u, v); for (let j = 0; j < 3; j++) { g.fillStyle = `rgba(40,36,34,${0.35 - j * 0.08})`; const dx = Math.sin(ph + j) * 3 + j * 2, dy = -h - 4 - j * 7; g.beginPath(); g.ellipse(x + dx, y + dy, 4 + j * 1.5, 3 + j, 0, 0, Math.PI * 2); g.fill(); } }
  // lửa: cao thấp thở theo khung, nghiêng đổi chiều
  spots.forEach(([u, v, h], i) => { const [x, y] = p(u, v); const hh = h * (0.85 + 0.15 * Math.sin(ph + i)); flame(g, x, y, hh, Math.sin(ph + i * 1.3) * 3); });
  // ánh hồng dưới chân lửa
  for (const [u, v] of spots) { const [x, y] = p(u, v); g.fillStyle = 'rgba(255,140,40,0.25)'; g.beginPath(); g.ellipse(x, y, 8, 3.5, 0, 0, Math.PI * 2); g.fill(); }
  return c;
}

export function ruinFrames(): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (let n = 1; n <= 3; n++) {
    out[`buildings/ruins_${n}.png`] = ruins(n);
    out[`buildings/ash_${n}.png`] = ash(n);
    out[`buildings/rubble_${n}.png`] = rubble(n);
    for (let k = 0; k < 4; k++) out[`buildings/fire_${n}_${k}.png`] = fire(n, k);
  }
  return out;
}
