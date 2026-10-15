// Kho và dịch vụ: kho (3×3), chùa, lớp học thầy đồ, nhà thuốc, giếng gạch, sân diễn chèo, trường học, thủy đình,
// miếu Hà Bá, đàn tế Tiên nông, Văn Miếu (3×3), Quốc Tử Giám (3×3), vườn cây, ao sen.
import { darken, hex, lighten, line, poly, polyUV, rng, scene, shadow, type Canvas, type Scene } from './lib';
import { earthFloor, thatchPlane, waterJar } from './house';
import { plankWall, post, tilePlane } from './buildings';
import { gate, homestead, pond, tree, yardWall } from './houses';
import { COLOR } from '../../src/render/palette';

const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, WOOD_LIGHT = 0xc09060, STONE = 0x8a8a84, STONE_DARK = 0x5a5a56, STONE_LIGHT = 0xa8a8a0;
const BRICK = 0x9a5a42, BRICK_DARK = 0x6a3a2a, TILE = 0x8a4a3a, TILE_LIGHT = 0xa86050, RED = 0xa82a2a, GOLD = 0xd8b040, STRAW = 0xc9a85c;

/** Lư hương đá / đỉnh đồng tại (u, v). */
function incense(s: Scene, u: number, v: number, z = 0): void {
  const [x, y] = s.p(u, v, z); const g = s.g;
  g.fillStyle = hex(0x4a4a52); g.fillRect(x - 3, y - 5, 6, 4); g.fillStyle = hex(0x6a6a74); g.fillRect(x - 3.5, y - 6, 7, 1.2);
  g.fillStyle = hex(0x2a2a30); g.fillRect(x - 3, y - 1.5, 1.2, 1.5); g.fillRect(x + 1.8, y - 1.5, 1.2, 1.5);
  for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(220,220,220,${0.3 - k * 0.08})`; g.beginPath(); g.ellipse(x + k, y - 8 - k * 3, 1.2 + k * 0.5, 1 + k * 0.4, 0, 0, Math.PI * 2); g.fill(); }
}
/** Cột cờ / phướn tại (u, v) cao h, màu cờ. */
function banner(s: Scene, u: number, v: number, h: number, col: number): void {
  const [x, y] = s.p(u, v); line(s.g, [x, y], [x, y - h], hex(WOOD_DARK), 1.2);
  poly(s.g, [[x + 1, y - h], [x + 7, y - h + 3], [x + 1, y - h + 7]], hex(col));
}
/** Bậc nền đá (hoặc gạch) cao z quanh vùng. */
function platform(s: Scene, u0: number, v0: number, u1: number, v1: number, z: number, col: number): void {
  polyUV(s, [[u0, v1, 0], [u1, v1, 0], [u1, v1, z], [u0, v1, z]], hex(col));
  polyUV(s, [[u1, v1, 0], [u1, v0, 0], [u1, v0, z], [u1, v1, z]], hex(darken(col, 0.25)));
  polyUV(s, [[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]], hex(lighten(col, 0.2)));
}
/** Tháp nhỏ (tháp chuông / tháp mộ) nhiều tầng thu dần tại (u, v). */
function stupa(s: Scene, u: number, v: number, tiers: number): void {
  const g = s.g;
  let z = 0, w = 0.22;
  for (let i = 0; i < tiers; i++) {
    const h = 7 - i;
    polyUV(s, [[u - w, v + w, z], [u + w, v + w, z], [u + w, v + w, z + h], [u - w, v + w, z + h]], hex(BRICK));
    polyUV(s, [[u + w, v + w, z], [u + w, v - w, z], [u + w, v - w, z + h], [u + w, v + w, z + h]], hex(BRICK_DARK));
    polyUV(s, [[u - w - 0.04, v - w - 0.04, z + h], [u + w + 0.04, v - w - 0.04, z + h], [u + w + 0.04, v + w + 0.04, z + h], [u - w - 0.04, v + w + 0.04, z + h]], hex(TILE));
    z += h + 1.5; w -= 0.04;
  }
  const [x, y] = s.p(u, v, z); g.fillStyle = hex(GOLD); g.beginPath(); g.ellipse(x, y - 1.5, 1.5, 2, 0, 0, Math.PI * 2); g.fill();
}

export function warehouse(): Canvas {
  const s = scene(3, 60);
  earthFloor(s, 0, 0, 3, 3, 301);
  homestead(s, 0.3, 0.3, 2.7, 1.8, { wall: 'plank', roof: 'tile', wallH: 16, ridge: 36, bays: 3, seed: 302 });
  // thùng gỗ, bao tải, kiện hàng ở sân
  const r = rng(303); const g = s.g;
  for (let i = 0; i < 5; i++) { const [x, y] = s.p(0.4 + r() * 2.2, 2.1 + r() * 0.6); g.fillStyle = hex(WOOD_DARK); g.fillRect(x - 5, y - 6, 10, 6); g.fillStyle = hex(WOOD); g.fillRect(x - 5, y - 6, 10, 1.2); g.fillStyle = hex(WOOD_LIGHT); g.fillRect(x - 4, y - 4, 8, 0.8); }
  for (let i = 0; i < 4; i++) { const [x, y] = s.p(1.8 + r() * 1.0, 2.3 + r() * 0.5); g.fillStyle = hex(0xd8c8a0); g.beginPath(); g.ellipse(x, y - 2.5, 4.5, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0xb0a080); g.fillRect(x - 1, y - 5.5, 2, 1); }
  return s.c;
}

export function temple(): Canvas {
  const s = scene(2, 52);
  earthFloor(s, 0, 0, 2, 2, 311);
  tree(s, 0.25, 0.25, 7, 8);
  platform(s, 0.3, 0.35, 1.9, 1.3, 3, STONE);
  homestead(s, 0.4, 0.45, 1.8, 1.2, { wall: 'lime', roof: 'tile', wallH: 14, ridge: 30, bays: 3, seed: 312, ornament: true });
  // cửa sơn đỏ đè lên cửa tối
  for (let i = 0; i < 3; i++) { const c = 0.4 + ((i + 0.5) / 3) * 1.4; polyUV(s, [[c - 0.11, 1.2, 0], [c + 0.11, 1.2, 0], [c + 0.11, 1.2, 10], [c - 0.11, 1.2, 10]], hex(RED)); line(s.g, s.p(c, 1.2, 0), s.p(c, 1.2, 10), hex(darken(RED, 0.4)), 0.8); }
  stupa(s, 1.75, 1.7, 4);
  incense(s, 1.05, 1.55);
  banner(s, 0.25, 1.7, 22, GOLD);
  return s.c;
}

export function school(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 321);
  homestead(s, 0.2, 0.25, 1.8, 1.05, { wall: 'earth', roof: 'thatch', wallH: 11, ridge: 23, bays: 2, seed: 322 });
  // sân: chõng tre học trò, bảng gỗ, rào tre
  const g = s.g;
  for (const [u, v] of [[0.5, 1.4], [1.0, 1.5], [1.5, 1.4]] as [number, number][]) { polyUV(s, [[u - 0.18, v - 0.12, 4], [u + 0.18, v - 0.12, 4], [u + 0.18, v + 0.12, 4], [u - 0.18, v + 0.12, 4]], hex(WOOD_LIGHT)); for (const [du, dv] of [[-0.15, -0.09], [0.15, -0.09], [-0.15, 0.09], [0.15, 0.09]]) post(s, u + du, v + dv, 4, 0, 1); }
  const [bx, by] = s.p(1.85, 0.8); g.fillStyle = hex(WOOD_DARK); g.fillRect(bx - 1, by - 14, 2, 14); g.fillStyle = hex(0x2a2a28); g.fillRect(bx - 7, by - 20, 14, 8); g.fillStyle = hex(0xf0e8d0); g.fillRect(bx - 5, by - 18, 2, 1); g.fillRect(bx - 1, by - 16, 3, 1);
  for (let u = 0.1; u < 1.9; u += 0.12) line(g, s.p(u, 1.95), s.p(u, 1.95, 4), hex(WOOD_DARK), 0.8);
  return s.c;
}

export function clinic(): Canvas {
  const s = scene(1, 40);
  earthFloor(s, 0, 0, 1, 1, 331);
  homestead(s, 0.12, 0.12, 0.86, 0.7, { wall: 'lime', roof: 'tile', wallH: 12, ridge: 24, bays: 1, seed: 332 });
  // nong phơi thuốc, chum, bảng hiệu
  const g = s.g;
  for (const [u, v] of [[0.3, 0.86], [0.62, 0.9]] as [number, number][]) { const [x, y] = s.p(u, v); g.fillStyle = hex(0xb89a5a); g.beginPath(); g.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0x8a6a3a); g.beginPath(); g.ellipse(x, y - 0.5, 4.5, 2.2, 0, 0, Math.PI * 2); g.fill(); }
  waterJar(s, 0.93, 0.4);
  const [sx, sy] = s.p(0.86, 0.72, 9); g.fillStyle = hex(0x2a2a28); g.fillRect(sx - 4, sy - 4, 8, 4); g.fillStyle = hex(GOLD); g.fillRect(sx - 2.5, sy - 3, 5, 2);
  return s.c;
}

export function brickWell(): Canvas {
  const s = scene(1, 30);
  earthFloor(s, 0, 0, 1, 1, 341);
  shadow(s, 0.55, 0.55, 0.4, 0.4, 0.2);
  const [cx, cy] = s.p(0.5, 0.5); const g = s.g, rx = 11, ry = 5.5, h = 7;
  g.fillStyle = hex(BRICK_DARK); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.fill();
  g.fillStyle = hex(BRICK); g.fillRect(cx - rx, cy - h, rx * 2, h);
  g.fillStyle = hex(BRICK_DARK); g.fillRect(cx, cy - h, rx, h);
  g.fillStyle = hex(darken(BRICK, 0.15)); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.fill();
  for (let z = 1.5; z < h; z += 2.2) line(g, [cx - rx, cy - z], [cx + rx, cy - z], 'rgba(60,30,20,0.45)', 0.6);
  g.fillStyle = hex(lighten(BRICK, 0.3)); g.beginPath(); g.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x2a3a4a); g.beginPath(); g.ellipse(cx, cy - h, rx - 3, ry - 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x5a7a9a); g.fillRect(cx - 3, cy - h - 1, 3, 1);
  // mái ngói nhỏ trên 4 cột
  for (const [u, v] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]] as [number, number][]) post(s, u, v, 18, 0, 1.2);
  tilePlane(s, [0.12, 0.5, 26], [0.88, 0.5, 26], [0.88, 0.12, 17], [0.12, 0.12, 17], TILE_LIGHT);
  tilePlane(s, [0.12, 0.5, 26], [0.88, 0.5, 26], [0.88, 0.88, 17], [0.12, 0.88, 17], TILE);
  line(g, s.p(0.12, 0.5, 26), s.p(0.88, 0.5, 26), hex(0x4a2a22), 1.5);
  return s.c;
}

export function theater(): Canvas {
  const s = scene(2, 40);
  earthFloor(s, 0, 0, 2, 2, 351);
  // sân khấu gỗ nâng cao phía sau, phông đỏ, mái rơm che
  platform(s, 0.25, 0.2, 1.75, 0.95, 5, WOOD);
  polyUV(s, [[0.3, 0.25, 5], [1.7, 0.25, 5], [1.7, 0.25, 21], [0.3, 0.25, 21]], hex(RED));
  for (let u = 0.45; u < 1.7; u += 0.25) line(s.g, s.p(u, 0.25, 5), s.p(u, 0.25, 21), hex(darken(RED, 0.3)), 0.8);
  polyUV(s, [[0.85, 0.25, 7], [1.15, 0.25, 7], [1.15, 0.25, 17], [0.85, 0.25, 17]], hex(GOLD));
  for (const [u, v] of [[0.3, 0.25], [1.7, 0.25], [0.3, 0.95], [1.7, 0.95]] as [number, number][]) post(s, u, v, 20, 5, 1.5);
  thatchPlane(s, [0.2, 0.6, 32], [1.8, 0.6, 32], [1.8, 0.1, 24], [0.2, 0.1, 24], lighten(STRAW, 0.12), 352);
  thatchPlane(s, [0.2, 0.6, 32], [1.8, 0.6, 32], [1.8, 1.05, 24], [0.2, 1.05, 24], STRAW, 353);
  // trống chầu, chiếu khán giả, cờ phướn
  const [dx, dy] = s.p(1.55, 0.8, 5); s.g.fillStyle = hex(0x8a3a2a); s.g.fillRect(dx - 3, dy - 6, 6, 5); s.g.fillStyle = hex(0xe8d8b0); s.g.fillRect(dx - 3, dy - 6, 6, 1);
  for (const [u, v, c] of [[0.5, 1.3, 0xc8b070], [1.0, 1.35, 0xb8a060], [1.5, 1.3, 0xc8b070], [0.75, 1.65, 0xb8a060], [1.25, 1.65, 0xc8b070]] as [number, number, number][]) polyUV(s, [[u - 0.2, v - 0.12, 0.5], [u + 0.2, v - 0.12, 0.5], [u + 0.2, v + 0.12, 0.5], [u - 0.2, v + 0.12, 0.5]], hex(c));
  banner(s, 0.15, 1.85, 24, RED); banner(s, 1.85, 1.85, 24, GOLD);
  return s.c;
}

export function academy(): Canvas {
  const s = scene(2, 50);
  earthFloor(s, 0, 0, 2, 2, 361);
  yardWall(s, [0.06, 0.06], [1.94, 0.06]); yardWall(s, [0.06, 0.06], [0.06, 1.94]);
  tree(s, 0.3, 0.3, 6, 7);
  homestead(s, 0.3, 0.3, 1.85, 1.05, { wall: 'lime', roof: 'tile', wallH: 14, ridge: 30, bays: 3, seed: 362, ornament: true });
  // bia đá nhỏ, lư hương
  const [bx, by] = s.p(0.5, 1.5); s.g.fillStyle = hex(STONE); s.g.fillRect(bx - 3, by - 10, 6, 9); s.g.fillStyle = hex(STONE_DARK); s.g.fillRect(bx - 4, by - 2, 8, 2);
  incense(s, 1.05, 1.5);
  yardWall(s, [0.06, 1.94], [1.94, 1.94]); yardWall(s, [1.94, 0.06], [1.94, 1.94]);
  gate(s, 1.4, 1.94, 0.16, 11);
  return s.c;
}

export function puppetStage(): Canvas {
  const s = scene(2, 44);
  earthFloor(s, 0, 0, 2, 2, 371);
  // ao chiếm gần hết, bờ gạch
  polyUV(s, [[0.1, 0.1, 0], [1.9, 0.1, 0], [1.9, 1.9, 0], [0.1, 1.9, 0]], hex(BRICK_DARK));
  polyUV(s, [[0.16, 0.16, 0], [1.84, 0.16, 0], [1.84, 1.84, 0], [0.16, 1.84, 0]], hex(COLOR.water));
  const r = rng(372); const g = s.g;
  for (let i = 0; i < 6; i++) { const [x, y] = s.p(0.3 + r() * 1.4, 0.3 + r() * 1.4); g.strokeStyle = 'rgba(200,225,240,0.5)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x, y - 1.5, x + 5, y); g.stroke(); }
  // thủy đình trên cột giữa ao: nền, cột, mái ngói hai tầng, mành che
  for (const [u, v] of [[0.55, 0.45], [1.25, 0.45], [0.55, 1.0], [1.25, 1.0]] as [number, number][]) post(s, u, v, 6, 0, 1.5);
  platform(s, 0.5, 0.4, 1.3, 1.05, 6, WOOD);
  polyUV(s, [[0.55, 0.45, 6], [1.25, 0.45, 6], [1.25, 0.45, 20], [0.55, 0.45, 20]], hex(RED));
  polyUV(s, [[0.6, 1.0, 6], [1.2, 1.0, 6], [1.2, 1.0, 17], [0.6, 1.0, 17]], hex(0xd8c890)); for (let u = 0.64; u < 1.2; u += 0.06) line(g, s.p(u, 1.0, 6), s.p(u, 1.0, 17), hex(0xa8905a), 0.6); // mành tre
  for (const [u, v] of [[0.55, 0.45], [1.25, 0.45], [0.55, 1.0], [1.25, 1.0]] as [number, number][]) post(s, u, v, 14, 6, 1.5);
  tilePlane(s, [0.45, 0.72, 30], [1.35, 0.72, 30], [1.35, 0.35, 20], [0.45, 0.35, 20], TILE_LIGHT); tilePlane(s, [0.45, 0.72, 30], [1.35, 0.72, 30], [1.35, 1.1, 20], [0.45, 1.1, 20], TILE);
  tilePlane(s, [0.6, 0.72, 40], [1.2, 0.72, 40], [1.2, 0.5, 32], [0.6, 0.5, 32], TILE_LIGHT); tilePlane(s, [0.6, 0.72, 40], [1.2, 0.72, 40], [1.2, 0.95, 32], [0.6, 0.95, 32], TILE);
  line(g, s.p(0.6, 0.72, 40), s.p(1.2, 0.72, 40), hex(0xd8d0c0), 1.5);
  // con rối trên mặt nước
  for (const [u, v, c] of [[0.8, 1.35, 0xe03030], [1.0, 1.45, 0xf0d040], [1.2, 1.35, 0x3060c0]] as [number, number, number][]) { const [x, y] = s.p(u, v); g.fillStyle = hex(c); g.fillRect(x - 1.5, y - 6, 3, 4); g.fillStyle = hex(0xd8a878); g.fillRect(x - 1.5, y - 8, 3, 2); }
  return s.c;
}

export function shrine(): Canvas {
  const s = scene(1, 34);
  earthFloor(s, 0, 0, 1, 1, 381);
  platform(s, 0.2, 0.2, 0.8, 0.8, 3, STONE);
  polyUV(s, [[0.3, 0.3, 3], [0.7, 0.3, 3], [0.7, 0.3, 15], [0.3, 0.3, 15]], hex(RED));
  polyUV(s, [[0.3, 0.3, 3], [0.3, 0.7, 3], [0.3, 0.7, 15], [0.3, 0.3, 15]], hex(darken(RED, 0.2)));
  polyUV(s, [[0.7, 0.3, 3], [0.7, 0.7, 3], [0.7, 0.7, 15], [0.7, 0.3, 15]], hex(darken(RED, 0.3)));
  polyUV(s, [[0.3, 0.7, 3], [0.7, 0.7, 3], [0.7, 0.7, 15], [0.3, 0.7, 15]], hex(darken(RED, 0.15)));
  polyUV(s, [[0.42, 0.7, 3], [0.58, 0.7, 3], [0.58, 0.7, 11], [0.42, 0.7, 11]], hex(0x2a1e14));
  tilePlane(s, [0.22, 0.5, 22], [0.78, 0.5, 22], [0.78, 0.22, 14], [0.22, 0.22, 14], TILE_LIGHT); tilePlane(s, [0.22, 0.5, 22], [0.78, 0.5, 22], [0.78, 0.78, 14], [0.22, 0.78, 14], TILE);
  line(s.g, s.p(0.22, 0.5, 22), s.p(0.78, 0.5, 22), hex(0xd8d0c0), 1.5);
  incense(s, 0.5, 0.92);
  banner(s, 0.9, 0.3, 18, GOLD);
  return s.c;
}

export function altar(): Canvas {
  const s = scene(1, 20);
  earthFloor(s, 0, 0, 1, 1, 391);
  platform(s, 0.1, 0.1, 0.9, 0.9, 3, STONE);
  platform(s, 0.25, 0.25, 0.75, 0.75, 6, STONE_LIGHT);
  incense(s, 0.5, 0.5, 6);
  // bó lúa cúng, hai cờ
  const [x, y] = s.p(0.7, 0.6, 6); s.g.fillStyle = hex(0xe0c860); s.g.beginPath(); s.g.moveTo(x - 3, y); s.g.quadraticCurveTo(x, y - 7, x + 3, y); s.g.closePath(); s.g.fill();
  banner(s, 0.08, 0.5, 16, RED); banner(s, 0.5, 0.08, 16, GOLD);
  return s.c;
}

/** Khu văn miếu / trường lớn 3×3: tường bao, cổng, nhà chính, hai dãy bia hoặc nhà ngang, ao. */
function compound(s: Scene, seed: number, main: Parameters<typeof homestead>[5], wings: boolean, stelae: boolean, tower: boolean): void {
  earthFloor(s, 0, 0, 3, 3, seed);
  yardWall(s, [0.06, 0.06], [2.94, 0.06], 7); yardWall(s, [0.06, 0.06], [0.06, 2.94], 7);
  tree(s, 0.3, 0.3, 7, 8); tree(s, 2.7, 0.3, 7, 8);
  platform(s, 0.55, 0.25, 2.55, 1.25, 3, STONE);
  homestead(s, 0.65, 0.35, 2.45, 1.15, main);
  if (wings) { homestead(s, 0.2, 1.4, 0.85, 2.4, { wall: 'lime', roof: 'tile', wallH: 12, ridge: 24, bays: 1, seed: seed + 1 }); homestead(s, 2.2, 1.4, 2.85, 2.4, { wall: 'lime', roof: 'tile', wallH: 12, ridge: 24, bays: 1, seed: seed + 2, doorRight: true }); }
  if (stelae) for (const side of [0.35, 2.65]) for (let v = 1.45; v < 2.5; v += 0.3) { const [x, y] = s.p(side, v); s.g.fillStyle = hex(STONE); s.g.fillRect(x - 3, y - 9, 6, 8); s.g.fillStyle = hex(STONE_DARK); s.g.fillRect(x - 4, y - 2, 8, 2); s.g.fillStyle = hex(STONE_LIGHT); s.g.fillRect(x - 2, y - 8, 4, 1); }
  pond(s, 1.5, 1.85, 0.35, 0.35);
  if (tower) { // gác nhỏ trên cổng (Khuê Văn Các): hai tầng, cửa tròn
    for (const [u, v] of [[1.3, 2.75], [1.7, 2.75], [1.3, 3.0], [1.7, 3.0]] as [number, number][]) post(s, u, v, 14, 0, 1.5);
    polyUV(s, [[1.3, 3.0, 14], [1.7, 3.0, 14], [1.7, 3.0, 26], [1.3, 3.0, 26]], hex(RED)); polyUV(s, [[1.7, 3.0, 14], [1.7, 2.75, 14], [1.7, 2.75, 26], [1.7, 3.0, 26]], hex(darken(RED, 0.25)));
    const [cx, cy] = s.p(1.5, 3.0, 20); s.g.fillStyle = hex(GOLD); s.g.beginPath(); s.g.arc(cx, cy, 3, 0, Math.PI * 2); s.g.fill();
    tilePlane(s, [1.22, 2.87, 34], [1.78, 2.87, 34], [1.78, 2.65, 26], [1.22, 2.65, 26], TILE_LIGHT); tilePlane(s, [1.22, 2.87, 34], [1.78, 2.87, 34], [1.78, 3.1, 26], [1.22, 3.1, 26], TILE);
    line(s.g, s.p(1.22, 2.87, 34), s.p(1.78, 2.87, 34), hex(0xd8d0c0), 1.5);
  }
  yardWall(s, [0.06, 2.94], [2.94, 2.94], 7); yardWall(s, [2.94, 0.06], [2.94, 2.94], 7);
  if (!tower) gate(s, 1.5, 2.94, 0.3, 14);
}
export function vanMieu(): Canvas {
  const s = scene(3, 70);
  compound(s, 401, { wall: 'lime', roof: 'tile', wallH: 16, ridge: 36, bays: 5, seed: 402, ornament: true }, false, true, false);
  incense(s, 1.5, 1.35, 3);
  return s.c;
}
export function quocTuGiam(): Canvas {
  const s = scene(3, 70);
  compound(s, 411, { wall: 'brick', roof: 'tile', wallH: 13, ridge: 40, bays: 5, storeys: 2, seed: 412, ornament: true }, true, false, true);
  return s.c;
}

export function garden(): Canvas {
  const s = scene(1, 24);
  const g = s.g;
  polyUV(s, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], hex(0x6a9a3a));
  const r = rng(421);
  for (let i = 0; i < 10; i++) { const [x, y] = s.p(0.1 + r() * 0.8, 0.1 + r() * 0.8); g.fillStyle = hex(r() < 0.5 ? 0x5a8a30 : 0x7ab048); line(g, [x, y], [x, y - 2], hex(0x5a8a30), 0.6); }
  // lối đi gạch chữ thập, luống hoa, cây nhỏ
  polyUV(s, [[0.44, 0, 0.3], [0.56, 0, 0.3], [0.56, 1, 0.3], [0.44, 1, 0.3]], hex(0xb8a080)); polyUV(s, [[0, 0.44, 0.3], [1, 0.44, 0.3], [1, 0.56, 0.3], [0, 0.56, 0.3]], hex(0xb8a080));
  for (const [u, v, c] of [[0.25, 0.25, 0xe05060], [0.75, 0.25, 0xf0d040], [0.25, 0.75, 0xf0f0f0], [0.75, 0.75, 0xe080c0]] as [number, number, number][]) { for (let i = 0; i < 6; i++) { const [x, y] = s.p(u + (r() - 0.5) * 0.25, v + (r() - 0.5) * 0.25); g.fillStyle = hex(0x4a7a2a); g.beginPath(); g.ellipse(x, y, 2, 1.2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(c); g.fillRect(x - 0.6, y - 1.5, 1.2, 1.2); } }
  tree(s, 0.5, 0.5, 5, 7);
  return s.c;
}

export function lotusPond(): Canvas {
  const s = scene(1, 10);
  earthFloor(s, 0, 0, 1, 1, 431);
  polyUV(s, [[0.08, 0.08, 0], [0.92, 0.08, 0], [0.92, 0.92, 0], [0.08, 0.92, 0]], hex(STONE_DARK));
  polyUV(s, [[0.14, 0.14, 0], [0.86, 0.14, 0], [0.86, 0.86, 0], [0.14, 0.86, 0]], hex(0x3a6a7a));
  const r = rng(432); const g = s.g;
  for (let i = 0; i < 9; i++) { const [x, y] = s.p(0.22 + r() * 0.56, 0.22 + r() * 0.56); g.fillStyle = hex(r() < 0.5 ? 0x4a8a3a : 0x5a9a4a); g.beginPath(); g.ellipse(x, y, 3.5, 2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0x3a6a7a); g.fillRect(x, y - 2, 1, 2); }
  for (let i = 0; i < 4; i++) { const [x, y] = s.p(0.25 + r() * 0.5, 0.25 + r() * 0.5); line(g, [x, y], [x, y - 5], hex(0x4a7a3a), 0.8); g.fillStyle = hex(0xf080a0); g.beginPath(); g.ellipse(x, y - 6, 2.2, 1.8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0xf8c0d0); g.beginPath(); g.ellipse(x - 0.5, y - 6.5, 1, 0.8, 0, 0, Math.PI * 2); g.fill(); }
  return s.c;
}

export function serviceFrames(): Record<string, Canvas> {
  const list: [string, () => Canvas][] = [
    ['warehouse', warehouse], ['temple', temple], ['school', school], ['clinic', clinic], ['brickWell', brickWell], ['theater', theater], ['academy', academy],
    ['puppetStage', puppetStage], ['shrine', shrine], ['altar', altar], ['vanMieu', vanMieu], ['quocTuGiam', quocTuGiam], ['garden', garden], ['lotusPond', lotusPond],
  ];
  const out: Record<string, Canvas> = {};
  for (const [k, f] of list) out[`buildings/${k}.png`] = f();
  return out;
}
void plankWall; void poly;
