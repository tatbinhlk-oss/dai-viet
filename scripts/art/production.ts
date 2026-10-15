// Công trình sản xuất (đều 2×2): nguyên liệu — bến cá, vườn rau, chuồng lợn, bãi đất sét, ruộng bông, đồi chè, nương dâu,
// mỏ đồng, mỏ sắt, ruộng muối, trại gỗ; xưởng — lò gốm, khung cửi, nhà sao chè, xưởng dệt lụa, lò đúc đồng, lò rèn.
import { darken, hex, lighten, line, poly, polyUV, rng, scene, shadow, type Canvas, type Scene } from './lib';
import { earthFloor, haystack, thatchPlane, waterJar } from './house';
import { plankWall, post, tilePlane } from './buildings';
import { homestead, tree } from './houses';

const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, WOOD_LIGHT = 0xc09060, STRAW = 0xc9a85c;
const BRICK = 0x9a5a42, BRICK_DARK = 0x6a3a2a, STONE = 0x7a7a74, STONE_DARK = 0x4e4e4a, STONE_LIGHT = 0x9a9a94;
const SOIL = 0x6e5838, LEAF = 0x4a8a2a, LEAF_DARK = 0x356a1e, LEAF_LIGHT = 0x7ab848, GLOW = 0xf08020;

type Rect = [number, number, number, number];

/** Miệng ống khói của công trình đang vẽ (so với đáy giữa hình) — smoke.ts sinh khung khói bay đè lên. */
export const CHIMNEYS: Record<string, { dx: number; dy: number; n: number }[]> = {};
let currentKey = '';
function chimney(s: Scene, x: number, y: number): void { (CHIMNEYS[currentKey] ??= []).push({ dx: x - s.W / 2, dy: y - s.H, n: s.n }); }

/** Luống đất tơi (sẫm) trong vùng. */
function bed(s: Scene, [u0, v0, u1, v1]: Rect): void {
  polyUV(s, [[u0, v0, 0], [u1, v0, 0], [u1, v1, 0], [u0, v1, 0]], hex(SOIL));
}

/** Cụm lá tròn tại (u, v). */
function bush(s: Scene, u: number, v: number, r: number, col = LEAF, z = 0): void {
  const [x, y] = s.p(u, v, z);
  s.g.fillStyle = hex(darken(col, 0.3)); s.g.beginPath(); s.g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(col); s.g.beginPath(); s.g.ellipse(x - r * 0.15, y - r * 0.35, r * 0.85, r * 0.55, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(lighten(col, 0.25)); s.g.beginPath(); s.g.ellipse(x - r * 0.3, y - r * 0.55, r * 0.35, r * 0.22, 0, 0, Math.PI * 2); s.g.fill();
}

/** Mái che hở (cột + mái rơm / ngói), không vách — cho lò rèn, bến cá, lán mỏ. */
function openShed(s: Scene, [u0, v0, u1, v1]: Rect, h: number, roof: 'thatch' | 'tile', seed: number): void {
  const vm = (v0 + v1) / 2, ov = 0.1;
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) post(s, u, v, h, 0, 1.5);
  if (roof === 'thatch') {
    thatchPlane(s, [u0 - ov, vm, h + 7], [u1 + ov, vm, h + 7], [u1 + ov, v0 - ov, h - 1], [u0 - ov, v0 - ov, h - 1], lighten(STRAW, 0.12), seed);
    thatchPlane(s, [u0 - ov, vm, h + 7], [u1 + ov, vm, h + 7], [u1 + ov, v1 + ov, h - 1], [u0 - ov, v1 + ov, h - 1], STRAW, seed + 1);
  } else {
    tilePlane(s, [u0 - ov, vm, h + 7], [u1 + ov, vm, h + 7], [u1 + ov, v0 - ov, h - 1], [u0 - ov, v0 - ov, h - 1], 0xa86050);
    tilePlane(s, [u0 - ov, vm, h + 7], [u1 + ov, vm, h + 7], [u1 + ov, v1 + ov, h - 1], [u0 - ov, v1 + ov, h - 1], 0x8a4a3a);
  }
}

/** Lò gạch: khối vuông có vòm, cửa lò sáng lửa, ống khói và khói. */
function furnace(s: Scene, u: number, v: number, w: number, h: number, dome: boolean): void {
  const g = s.g;
  polyUV(s, [[u, v + w, 0], [u + w, v + w, 0], [u + w, v + w, h], [u, v + w, h]], hex(BRICK));
  polyUV(s, [[u + w, v + w, 0], [u + w, v, 0], [u + w, v, h], [u + w, v + w, h]], hex(BRICK_DARK));
  polyUV(s, [[u, v, h], [u + w, v, h], [u + w, v + w, h], [u, v + w, h]], hex(lighten(BRICK, 0.2)));
  for (let z = 2; z < h; z += 2.5) { line(g, s.p(u, v + w, z), s.p(u + w, v + w, z), hex(darken(BRICK, 0.35)), 0.6); line(g, s.p(u + w, v + w, z), s.p(u + w, v, z), hex(darken(BRICK_DARK, 0.3)), 0.6); }
  if (dome) {
    const [cx, cy] = s.p(u + w / 2, v + w / 2, h);
    g.fillStyle = hex(darken(BRICK, 0.1)); g.beginPath(); g.ellipse(cx, cy, w * 28, w * 20, 0, Math.PI, 0); g.fill();
    g.fillStyle = hex(lighten(BRICK, 0.15)); g.beginPath(); g.ellipse(cx - w * 6, cy - w * 4, w * 14, w * 10, 0, Math.PI, 0); g.fill();
  }
  // cửa lò + lửa
  const dm = v + w * 0.5;
  polyUV(s, [[u + w, dm + 0.12, 0], [u + w, dm - 0.12, 0], [u + w, dm - 0.12, h * 0.55], [u + w, dm + 0.12, h * 0.55]], hex(0x1a0a06));
  polyUV(s, [[u + w, dm + 0.08, 0], [u + w, dm - 0.08, 0], [u + w, dm - 0.08, h * 0.35], [u + w, dm + 0.08, h * 0.35]], hex(GLOW));
  polyUV(s, [[u + w, dm + 0.04, 0], [u + w, dm - 0.04, 0], [u + w, dm - 0.04, h * 0.2], [u + w, dm + 0.04, h * 0.2]], hex(0xf8e060));
  // ống khói (khói là frame hoạt ảnh riêng, xem smoke.ts)
  const [kx, ky] = s.p(u + w * 0.3, v + w * 0.3, h + (dome ? w * 20 : 0));
  g.fillStyle = hex(BRICK_DARK); g.fillRect(kx - 2, ky - 10, 4, 10);
  g.fillStyle = hex(darken(BRICK_DARK, 0.4)); g.fillRect(kx - 2, ky - 10, 4, 1);
  chimney(s, kx, ky - 10);
}

/** Đống gỗ tròn xếp chồng tại (u, v). */
function logPile(s: Scene, u: number, v: number, n: number): void {
  const g = s.g;
  const [x, y] = s.p(u, v);
  for (let row = 0; row < 3; row++) for (let i = 0; i < n - row; i++) {
    const cx = x - (n - row) * 2.5 + i * 5 + 2.5 + row * 0.5, cy = y - 2 - row * 3.5;
    g.fillStyle = hex(WOOD_DARK); g.fillRect(cx - 2.5, cy - 2, 12, 4);
    g.fillStyle = hex(WOOD_LIGHT); g.beginPath(); g.ellipse(cx - 2.5, cy, 2.2, 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = hex(WOOD); g.beginPath(); g.ellipse(cx - 2.5, cy, 1.2, 1.1, 0, 0, Math.PI * 2); g.fill();
  }
}

/** Mỏm đá / núi nhỏ ở góc sau với cửa hầm. */
function rockMound(s: Scene, ore: number): void {
  const g = s.g;
  polyUV(s, [[0.1, 0.1, 0], [1.6, 0.1, 0], [1.6, 0.6, 14], [1.1, 0.2, 22], [0.4, 0.3, 18], [0.1, 1.0, 0]], hex(STONE));
  polyUV(s, [[1.6, 0.1, 0], [1.6, 1.0, 0], [1.6, 0.6, 14]], hex(STONE_DARK));
  polyUV(s, [[0.1, 1.0, 0], [1.6, 1.0, 0], [1.6, 0.6, 14], [1.1, 0.2, 22], [0.4, 0.3, 18]], hex(darken(STONE, 0.12)));
  const r = rng(ore);
  for (let i = 0; i < 12; i++) { const [x, y] = s.p(0.2 + r() * 1.3, 0.2 + r() * 0.7, r() * 12); g.fillStyle = hex(r() < 0.5 ? STONE_LIGHT : STONE_DARK); g.fillRect(x, y, 2 + r() * 3, 1.5); }
  // cửa hầm có khung gỗ
  polyUV(s, [[0.75, 1.0, 0], [1.15, 1.0, 0], [1.15, 1.0, 9], [0.75, 1.0, 9]], hex(0x14100c));
  line(g, s.p(0.75, 1.0, 0), s.p(0.75, 1.0, 9), hex(WOOD), 2); line(g, s.p(1.15, 1.0, 0), s.p(1.15, 1.0, 9), hex(WOOD), 2); line(g, s.p(0.72, 1.0, 9), s.p(1.18, 1.0, 9), hex(WOOD), 2.5);
  // ray + xe goòng
  line(g, s.p(0.95, 1.0), s.p(0.95, 1.9), hex(STONE_DARK), 1); line(g, s.p(1.02, 1.0), s.p(1.02, 1.9), hex(STONE_DARK), 1);
  const [cx, cy] = s.p(0.98, 1.55);
  g.fillStyle = hex(WOOD_DARK); g.fillRect(cx - 5, cy - 7, 10, 5);
  g.fillStyle = hex(ore); g.beginPath(); g.ellipse(cx, cy - 7, 4.5, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x2a2a2a); g.fillRect(cx - 4, cy - 2, 2, 2); g.fillRect(cx + 2, cy - 2, 2, 2);
}
function orePile(s: Scene, u: number, v: number, ore: number): void {
  const [x, y] = s.p(u, v);
  const g = s.g;
  g.fillStyle = hex(darken(ore, 0.3)); g.beginPath(); g.ellipse(x, y, 7, 3.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(ore); g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x, y - 9, x + 6, y); g.closePath(); g.fill();
  g.fillStyle = hex(lighten(ore, 0.3)); g.fillRect(x - 2, y - 5, 2, 1.5); g.fillRect(x + 1, y - 3, 1.5, 1.5);
}

// ---------- nguyên liệu ----------
export function fishWharf(): Canvas {
  const s = scene(2, 36);
  earthFloor(s, 0, 0, 2, 2, 71);
  // sàn gỗ nhô ra phía trước (nơi kề sông) trên cọc
  for (const u of [0.2, 0.8, 1.4, 1.95]) post(s, u, 1.95, 5, 0, 1.5);
  polyUV(s, [[0.1, 1.2, 5], [2, 1.2, 5], [2, 2, 5], [0.1, 2, 5]], hex(WOOD));
  for (let v = 1.3; v < 2; v += 0.12) line(s.g, s.p(0.1, v, 5), s.p(2, v, 5), hex(WOOD_DARK), 0.6);
  polyUV(s, [[0.1, 2, 0], [2, 2, 0], [2, 2, 5], [0.1, 2, 5]], hex(WOOD_DARK));
  // giàn phơi cá
  for (const u of [1.2, 1.9]) post(s, u, 1.45, 14, 5, 1.2);
  line(s.g, s.p(1.2, 1.45, 18), s.p(1.9, 1.45, 18), hex(WOOD_DARK), 1);
  for (let u = 1.28; u < 1.9; u += 0.11) { const [x, y] = s.p(u, 1.45, 18); s.g.fillStyle = hex(0x9ab0c0); s.g.beginPath(); s.g.ellipse(x, y + 4, 1.5, 3.5, 0, 0, Math.PI * 2); s.g.fill(); }
  // lều nhỏ, lưới và thúng cá
  homestead(s, 0.2, 0.2, 0.95, 0.9, { wall: 'plank', roof: 'thatch', wallH: 9, ridge: 18, seed: 72, doorRight: true });
  const g = s.g; const [nx, ny] = s.p(1.5, 0.5);
  g.strokeStyle = 'rgba(60,50,30,0.7)'; g.lineWidth = 0.6;
  for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(nx + i * 3, ny - 14); g.lineTo(nx + i * 3 + 4, ny); g.stroke(); g.beginPath(); g.moveTo(nx - 15, ny - 14 + (i + 5) * 1.4); g.lineTo(nx + 15, ny - 14 + (i + 5) * 1.4); g.stroke(); }
  post(s, 1.15, 0.5, 16, 0, 1.2); post(s, 1.85, 0.5, 16, 0, 1.2);
  for (const [u, v] of [[0.5, 1.6], [0.8, 1.75]] as [number, number][]) { const [x, y] = s.p(u, v, 5); g.fillStyle = hex(0xb89a5a); g.beginPath(); g.ellipse(x, y - 1, 4, 2.2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0x80a8c0); g.beginPath(); g.ellipse(x, y - 2.5, 3, 1.5, 0, 0, Math.PI * 2); g.fill(); }
  return s.c;
}

export function vegGarden(): Canvas {
  const s = scene(2, 12);
  earthFloor(s, 0, 0, 2, 2, 81);
  const r = rng(82);
  for (const v0 of [0.15, 0.65, 1.15, 1.65]) {
    bed(s, [0.15, v0, 1.85, v0 + 0.35]);
    for (let u = 0.25; u < 1.85; u += 0.16) bush(s, u, v0 + 0.17, 3 + r() * 1.2, [LEAF, LEAF_LIGHT, 0x5a9a3a][Math.floor(r() * 3)]);
  }
  waterJar(s, 1.92, 0.3);
  for (let u = 0.1; u < 1.9; u += 0.12) line(s.g, s.p(u, 1.97), s.p(u, 1.97, 3), hex(WOOD_DARK), 0.8);
  return s.c;
}

export function pigSty(): Canvas {
  const s = scene(2, 30);
  earthFloor(s, 0, 0, 2, 2, 91);
  // vũng bùn
  polyUV(s, [[0.2, 0.9, 0], [1.9, 0.9, 0], [1.9, 1.9, 0], [0.2, 1.9, 0]], hex(0x6a5230));
  const [mx, my] = s.p(1.2, 1.5); s.g.fillStyle = hex(0x5a4a3a); s.g.beginPath(); s.g.ellipse(mx, my, 12, 5, 0, 0, Math.PI * 2); s.g.fill();
  // mái che rơm phía sau
  openShed(s, [0.2, 0.15, 1.8, 0.8], 10, 'thatch', 92);
  polyUV(s, [[0.2, 0.15, 0], [1.8, 0.15, 0], [1.8, 0.15, 10], [0.2, 0.15, 10]], hex(darken(WOOD, 0.35)));
  // rào ván
  const rail = (a: [number, number], b: [number, number]) => { for (const z of [2, 5]) line(s.g, s.p(a[0], a[1], z), s.p(b[0], b[1], z), hex(WOOD_LIGHT), 1.2); const n = 6; for (let i = 0; i <= n; i++) post(s, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 6, 0, 1.2); };
  rail([0.2, 1.9], [1.9, 1.9]); rail([1.9, 0.15], [1.9, 1.9]);
  // lợn
  const pig = (u: number, v: number, dir: number) => { const [x, y] = s.p(u, v); const g = s.g; g.fillStyle = hex(0xe0a090); g.beginPath(); g.ellipse(x, y - 3, 6, 3.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0xd09080); g.beginPath(); g.ellipse(x + dir * 6, y - 3.5, 2.5, 2.2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0xb07060); g.fillRect(x + dir * 7.5 - 1, y - 4, 2, 1.5); g.fillStyle = hex(0x8a5a4a); g.fillRect(x - 4, y - 1, 1.5, 2); g.fillRect(x + 2, y - 1, 1.5, 2); };
  pig(0.6, 1.3, 1); pig(1.4, 1.2, -1); pig(1.0, 1.65, 1);
  // máng ăn
  polyUV(s, [[0.3, 1.0, 0], [0.9, 1.0, 0], [0.9, 1.0, 3], [0.3, 1.0, 3]], hex(WOOD_DARK));
  return s.c;
}

export function clayPit(): Canvas {
  const s = scene(2, 14);
  earthFloor(s, 0, 0, 2, 2, 101);
  // hố đào: miệng rộng, đáy sâu (vẽ các bậc lùi dần)
  const CLAY = 0x9a6a4a;
  polyUV(s, [[0.2, 0.3, 0], [1.8, 0.3, 0], [1.8, 1.7, 0], [0.2, 1.7, 0]], hex(darken(CLAY, 0.15)));
  polyUV(s, [[0.45, 0.5, -3], [1.6, 0.5, -3], [1.6, 1.5, -3], [0.45, 1.5, -3]], hex(darken(CLAY, 0.35)));
  polyUV(s, [[0.2, 0.3, 0], [0.45, 0.5, -3], [1.6, 0.5, -3], [1.8, 0.3, 0]], hex(CLAY));
  polyUV(s, [[0.2, 0.3, 0], [0.45, 0.5, -3], [0.45, 1.5, -3], [0.2, 1.7, 0]], hex(lighten(CLAY, 0.1)));
  const [wx, wy] = s.p(1.0, 1.1, -3); s.g.fillStyle = hex(0x5a7a8a); s.g.beginPath(); s.g.ellipse(wx, wy, 9, 4, 0, 0, Math.PI * 2); s.g.fill();
  // đống đất sét, xẻng, thúng
  orePile(s, 1.85, 1.85, CLAY); orePile(s, 1.55, 1.95, CLAY);
  line(s.g, s.p(0.3, 1.9), s.p(0.3, 1.9, 12), hex(WOOD_DARK), 1.2); const [sx, sy] = s.p(0.3, 1.9); s.g.fillStyle = hex(0x6a6a70); s.g.fillRect(sx - 2, sy - 4, 4, 4);
  return s.c;
}

export function cottonField(): Canvas {
  const s = scene(2, 12);
  earthFloor(s, 0, 0, 2, 2, 111);
  const r = rng(112);
  for (const v0 of [0.2, 0.6, 1.0, 1.4]) { bed(s, [0.15, v0 + 0.1, 1.85, v0 + 0.3]); for (let u = 0.22; u < 1.85; u += 0.13) { bush(s, u, v0 + 0.2, 3, 0x4a7a3a); const [x, y] = s.p(u, v0 + 0.2); for (let k = 0; k < 3; k++) { s.g.fillStyle = '#f4f4f0'; s.g.beginPath(); s.g.arc(x - 2 + r() * 4, y - 2 - r() * 2, 0.9, 0, Math.PI * 2); s.g.fill(); } } }
  return s.c;
}

export function teaHill(): Canvas {
  const s = scene(2, 20);
  earthFloor(s, 0, 0, 2, 2, 121);
  // gò đất
  const g = s.g; const [cx, cy] = s.p(1, 1);
  g.fillStyle = hex(0x7a8a4a); g.beginPath(); g.ellipse(cx, cy, 58, 29, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x86964e); g.beginPath(); g.ellipse(cx, cy - 4, 46, 22, 0, 0, Math.PI * 2); g.fill();
  // hàng chè vòng cung đậm
  for (let k = 0; k < 5; k++) {
    const rx = 52 - k * 10, ry = rx / 2, lift = k * 2.5;
    for (let a = 0; a < Math.PI * 2; a += 0.13) { const x = cx + Math.cos(a) * rx, y = cy - lift + Math.sin(a) * ry; g.fillStyle = hex(Math.sin(a) < 0 ? LEAF_DARK : LEAF); g.beginPath(); g.ellipse(x, y - 1.5, 2.4, 1.6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(LEAF_LIGHT); g.beginPath(); g.ellipse(x - 0.6, y - 2.4, 1, 0.6, 0, 0, Math.PI * 2); g.fill(); }
  }
  return s.c;
}

export function mulberryField(): Canvas {
  const s = scene(2, 24);
  earthFloor(s, 0, 0, 2, 2, 131);
  for (const v of [0.35, 0.85, 1.35]) for (let u = 0.3; u < 1.9; u += 0.4) tree(s, u, v, 4.5, 4);
  // lán nuôi tằm: khay tre xếp tầng
  openShed(s, [0.2, 1.55, 1.3, 1.95], 11, 'thatch', 132);
  for (let z = 2; z < 10; z += 3) polyUV(s, [[0.35, 1.6, z], [1.15, 1.6, z], [1.15, 1.9, z], [0.35, 1.9, z]], hex(z % 2 ? 0xd8c890 : 0xc8b880));
  return s.c;
}

export function copperMine(): Canvas { const s = scene(2, 30); earthFloor(s, 0, 0, 2, 2, 141); rockMound(s, 0xb87040); orePile(s, 1.5, 1.6, 0xb87040); orePile(s, 1.8, 1.4, 0xb87040); openShed(s, [0.15, 1.3, 0.7, 1.9], 9, 'thatch', 142); return s.c; }
export function ironMine(): Canvas { const s = scene(2, 30); earthFloor(s, 0, 0, 2, 2, 151); rockMound(s, 0x6a6a74); orePile(s, 1.5, 1.6, 0x6a6a74); orePile(s, 1.8, 1.4, 0x5a5a64); openShed(s, [0.15, 1.3, 0.7, 1.9], 9, 'thatch', 152); return s.c; }

export function saltPan(): Canvas {
  const s = scene(2, 10);
  earthFloor(s, 0, 0, 2, 2, 161);
  // ô muối: lưới 3×3 ô nước lợ viền bờ đất
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const u0 = 0.12 + i * 0.6, v0 = 0.12 + j * 0.6;
    polyUV(s, [[u0, v0, 0], [u0 + 0.54, v0, 0], [u0 + 0.54, v0 + 0.54, 0], [u0, v0 + 0.54, 0]], hex((i + j) % 2 ? 0xbcc8cc : 0xa8c0d0));
    const [x, y] = s.p(u0 + 0.27, v0 + 0.27); s.g.fillStyle = 'rgba(255,255,255,0.5)'; s.g.beginPath(); s.g.ellipse(x - 3, y - 1, 5, 1.5, 0, 0, Math.PI * 2); s.g.fill();
  }
  // đống muối trắng
  for (const [u, v] of [[1.75, 1.85], [1.55, 1.95]] as [number, number][]) orePile(s, u, v, 0xeeeeea);
  return s.c;
}

export function lumberCamp(): Canvas {
  const s = scene(2, 28);
  earthFloor(s, 0, 0, 2, 2, 171);
  tree(s, 0.3, 0.3, 7, 9); tree(s, 0.9, 0.2, 6, 8);
  // gốc cây cụt
  for (const [u, v] of [[1.5, 0.3], [1.7, 0.7]] as [number, number][]) { const [x, y] = s.p(u, v); s.g.fillStyle = hex(WOOD_DARK); s.g.fillRect(x - 3, y - 4, 6, 4); s.g.fillStyle = hex(WOOD_LIGHT); s.g.beginPath(); s.g.ellipse(x, y - 4, 3, 1.5, 0, 0, Math.PI * 2); s.g.fill(); }
  logPile(s, 0.6, 1.5, 4); logPile(s, 1.5, 1.7, 3);
  openShed(s, [1.2, 0.95, 1.85, 1.45], 10, 'thatch', 172);
  // cưa trên giá
  const [gx, gy] = s.p(0.4, 1.9); line(s.g, [gx - 6, gy], [gx - 2, gy - 6], hex(WOOD_DARK), 1.2); line(s.g, [gx + 6, gy], [gx + 2, gy - 6], hex(WOOD_DARK), 1.2); line(s.g, [gx - 8, gy - 7], [gx + 8, gy - 7], hex(0x9a9aa0), 1.5);
  return s.c;
}

// ---------- xưởng ----------
export function kiln(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 181);
  shadow(s, 0.7, 0.7, 0.6, 0.6, 0.2);
  furnace(s, 0.25, 0.25, 0.9, 12, true);
  openShed(s, [1.25, 0.2, 1.9, 1.0], 11, 'tile', 182);
  // chum gốm xếp hàng trong sân
  const r = rng(183);
  for (let i = 0; i < 7; i++) { const [x, y] = s.p(0.3 + r() * 1.5, 1.3 + r() * 0.6); const g = s.g; const c = [0x8a5a3a, 0xa06a40, 0x6a4a3a][i % 3]; g.fillStyle = hex(c); g.beginPath(); g.ellipse(x, y - 3, 3.2, 3.6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(lighten(c, 0.25)); g.beginPath(); g.ellipse(x - 1, y - 4, 1.2, 1.8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0x3a3a4a); g.beginPath(); g.ellipse(x, y - 6.3, 2, 0.9, 0, 0, Math.PI * 2); g.fill(); }
  return s.c;
}

/** Nhà xưởng ván gỗ lợp ngói, có mở cửa rộng. */
function workshopHouse(s: Scene, rect: Rect, seed: number, roof: 'tile' | 'thatch' = 'tile'): void {
  homestead(s, rect[0], rect[1], rect[2], rect[3], { wall: 'plank', roof, wallH: 12, ridge: 24, bays: 2, seed });
}
/** Dây phơi vải / lụa: các dải màu treo giữa hai cột. */
function dryingLine(s: Scene, a: [number, number], b: [number, number], colors: number[], h = 16): void {
  post(s, a[0], a[1], h, 0, 1.2); post(s, b[0], b[1], h, 0, 1.2);
  line(s.g, s.p(a[0], a[1], h), s.p(b[0], b[1], h), hex(WOOD_DARK), 0.8);
  const n = colors.length;
  colors.forEach((c, i) => { const t = (i + 0.5) / n, u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t; polyUV(s, [[u - 0.05, v, h - 1], [u + 0.05, v, h - 1], [u + 0.05, v, h - 11], [u - 0.05, v, h - 11]], hex(c)); });
}

export function loom(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 191);
  workshopHouse(s, [0.2, 0.2, 1.8, 1.0], 192);
  dryingLine(s, [0.3, 1.75], [1.3, 1.75], [0xf0f0e8, 0x6080c0, 0xf0f0e8, 0x4a4a8a, 0xe8e8e0]);
  // kiện bông
  for (const [u, v] of [[1.6, 1.4], [1.8, 1.6]] as [number, number][]) { const [x, y] = s.p(u, v); s.g.fillStyle = '#f4f4f0'; s.g.beginPath(); s.g.ellipse(x, y - 3, 5, 3.5, 0, 0, Math.PI * 2); s.g.fill(); s.g.fillStyle = hex(WOOD_DARK); s.g.fillRect(x - 5, y - 3.5, 10, 0.8); }
  return s.c;
}

export function teaHouse(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 201);
  workshopHouse(s, [0.2, 0.2, 1.8, 1.0], 202);
  // ống khói sao chè
  const [kx, ky] = s.p(0.5, 0.3, 26); s.g.fillStyle = hex(BRICK_DARK); s.g.fillRect(kx - 2, ky - 8, 4, 8); chimney(s, kx, ky - 8);
  // nong phơi chè
  for (const [u, v] of [[0.4, 1.4], [0.9, 1.5], [1.4, 1.4], [0.65, 1.8], [1.15, 1.85]] as [number, number][]) { const [x, y] = s.p(u, v); s.g.fillStyle = hex(0xb89a5a); s.g.beginPath(); s.g.ellipse(x, y, 8, 4, 0, 0, Math.PI * 2); s.g.fill(); s.g.fillStyle = hex(LEAF_DARK); s.g.beginPath(); s.g.ellipse(x, y - 0.5, 6, 2.8, 0, 0, Math.PI * 2); s.g.fill(); }
  return s.c;
}

export function silkWorkshop(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 211);
  workshopHouse(s, [0.2, 0.2, 1.8, 1.0], 212);
  dryingLine(s, [0.3, 1.75], [1.4, 1.75], [0xf0e060, 0xf8f0c0, 0xe8c840, 0xffffff, 0xf0e060, 0xf8f0c0]);
  // thúng kén vàng
  for (const [u, v] of [[1.65, 1.35], [1.85, 1.6]] as [number, number][]) { const [x, y] = s.p(u, v); s.g.fillStyle = hex(0xb89a5a); s.g.beginPath(); s.g.ellipse(x, y - 1, 4.5, 2.5, 0, 0, Math.PI * 2); s.g.fill(); s.g.fillStyle = hex(0xf0e0a0); s.g.beginPath(); s.g.ellipse(x, y - 2.5, 3.5, 1.8, 0, 0, Math.PI * 2); s.g.fill(); }
  return s.c;
}

export function foundry(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 221);
  furnace(s, 0.3, 0.3, 0.7, 16, false);
  openShed(s, [1.2, 0.2, 1.9, 1.0], 12, 'tile', 222);
  // khuôn đúc và thỏi đồng
  const g = s.g;
  for (const [u, v] of [[0.5, 1.5], [0.8, 1.65]] as [number, number][]) { const [x, y] = s.p(u, v); g.fillStyle = hex(0xc89040); g.fillRect(x - 5, y - 3, 10, 3); g.fillStyle = hex(0xe8b060); g.fillRect(x - 5, y - 4, 10, 1); }
  for (const [u, v] of [[1.4, 1.5], [1.7, 1.7]] as [number, number][]) { const [x, y] = s.p(u, v); g.fillStyle = hex(STONE_DARK); g.fillRect(x - 4, y - 4, 8, 4); g.fillStyle = hex(GLOW); g.fillRect(x - 2, y - 3, 4, 1.5); }
  orePile(s, 1.2, 1.85, 0xb87040);
  return s.c;
}

export function smithy(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 231);
  furnace(s, 0.3, 0.3, 0.55, 11, false);
  openShed(s, [0.2, 0.95, 1.85, 1.85], 13, 'tile', 232);
  const g = s.g;
  // đe trên gốc, búa, bễ, giá giáo
  const [ax, ay] = s.p(1.0, 1.4); g.fillStyle = hex(WOOD_DARK); g.fillRect(ax - 3, ay - 5, 6, 5); g.fillStyle = hex(0x4a4a52); g.fillRect(ax - 5, ay - 8, 10, 3); g.fillStyle = hex(0x6a6a74); g.fillRect(ax - 5, ay - 9, 10, 1);
  line(g, [ax + 6, ay - 4], [ax + 10, ay - 10], hex(WOOD_DARK), 1); g.fillStyle = hex(0x4a4a52); g.fillRect(ax + 9, ay - 12, 3, 3);
  const [bx, by] = s.p(0.6, 1.1); g.fillStyle = hex(0x6a4a3a); g.beginPath(); g.ellipse(bx, by - 3, 6, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(WOOD); g.fillRect(bx - 1, by - 8, 2, 5);
  for (let i = 0; i < 4; i++) { const [sx, sy] = s.p(1.75, 1.05 + i * 0.18); line(g, [sx, sy], [sx, sy - 16], hex(WOOD_DARK), 0.8); g.fillStyle = hex(0xd0d0d8); g.fillRect(sx - 1, sy - 18, 2, 3); }
  orePile(s, 1.6, 1.95, 0x5a5a64);
  return s.c;
}

export function productionFrames(): Record<string, Canvas> {
  const list: [string, () => Canvas][] = [
    ['fishWharf', fishWharf], ['vegGarden', vegGarden], ['pigSty', pigSty], ['clayPit', clayPit], ['cottonField', cottonField], ['teaHill', teaHill], ['mulberryField', mulberryField],
    ['copperMine', copperMine], ['ironMine', ironMine], ['saltPan', saltPan], ['lumberCamp', lumberCamp],
    ['kiln', kiln], ['loom', loom], ['teaHouse', teaHouse], ['silkWorkshop', silkWorkshop], ['foundry', foundry], ['smithy', smithy],
  ];
  const out: Record<string, Canvas> = {};
  for (const [k, f] of list) { currentKey = k; out[`buildings/${k}.png`] = f(); }
  currentKey = '';
  return out;
}
// tránh cảnh báo chưa dùng
void poly; void plankWall; void haystack;
