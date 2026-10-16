// Quản trị và quân sự: điếm canh, trại thợ, nha môn, bến cảng, trại lính, thành đất, thành đá, cổng thành, bến thuyền.
// Thành đất / thành đá là ô nâng cao trọn hình thoi (như đê) để các đoạn kề nhau nối liền không lộ khe.
import { darken, hex, lighten, line, poly, polyUV, rng, scene, shadow, type Canvas, type Scene } from './lib';
import { earthFloor, haystack, thatchPlane, waterJar } from './house';
import { plankWall, post, tilePlane } from './buildings';
import { gate as yardGate, homestead, tree, yardWall } from './houses';

const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, WOOD_LIGHT = 0xc09060, STONE = 0x8a8a84, STONE_DARK = 0x5a5a56, STONE_LIGHT = 0xa8a8a0;
const BRICK = 0x9a5a42, BRICK_DARK = 0x6a3a2a, TILE = 0x8a4a3a, TILE_LIGHT = 0xa86050, RED = 0xa82a2a, GOLD = 0xd8b040, STRAW = 0xc9a85c;
const EARTH = 0x8a7046, EARTH_DARK = 0x6e5838, GRASS = 0x6f8f3a;

/** Cột cờ với lá cờ. */
function flag(s: Scene, u: number, v: number, h: number, col: number, z0 = 0): void {
  const [x, y] = s.p(u, v, z0); line(s.g, [x, y], [x, y - h], hex(WOOD_DARK), 1.2);
  poly(s.g, [[x + 1, y - h], [x + 9, y - h + 3], [x + 1, y - h + 7]], hex(col));
}
/** Giá giáo: hàng cán gỗ mũi sáng. */
function spearRack(s: Scene, u0: number, v: number, n: number): void {
  for (let i = 0; i < n; i++) { const [x, y] = s.p(u0 + i * 0.12, v); line(s.g, [x, y], [x, y - 16], hex(WOOD_DARK), 0.8); s.g.fillStyle = hex(0xd0d0d8); s.g.fillRect(x - 1, y - 18, 2, 3); }
  line(s.g, s.p(u0 - 0.05, v, 6), s.p(u0 + (n - 1) * 0.12 + 0.05, v, 6), hex(WOOD), 1);
}

export function watchPost(): Canvas {
  const s = scene(1, 44);
  earthFloor(s, 0, 0, 1, 1, 501);
  shadow(s, 0.55, 0.55, 0.4, 0.4, 0.2);
  // chòi hai tầng: tầng dưới cột tre, tầng trên sàn gỗ có lan can, mái rơm; thang; mõ
  const u0 = 0.25, v0 = 0.25, u1 = 0.75, v1 = 0.75, h1 = 14, h2 = 12;
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) post(s, u, v, h1 + h2, 0, 1.5);
  polyUV(s, [[u0, v1, h1], [u1, v1, h1], [u1, v1, h1 + 2], [u0, v1, h1 + 2]], hex(WOOD_DARK));
  polyUV(s, [[u1, v1, h1], [u1, v0, h1], [u1, v0, h1 + 2], [u1, v1, h1 + 2]], hex(darken(WOOD_DARK, 0.3)));
  polyUV(s, [[u0, v0, h1 + 2], [u1, v0, h1 + 2], [u1, v1, h1 + 2], [u0, v1, h1 + 2]], hex(WOOD));
  for (let u = u0 + 0.08; u < u1; u += 0.1) line(s.g, s.p(u, v1, h1 + 2), s.p(u, v1, h1 + 7), hex(WOOD_LIGHT), 0.8);
  for (let v = v0 + 0.08; v < v1; v += 0.1) line(s.g, s.p(u1, v, h1 + 2), s.p(u1, v, h1 + 7), hex(WOOD_LIGHT), 0.8);
  line(s.g, s.p(u0, v1, h1 + 7), s.p(u1, v1, h1 + 7), hex(WOOD), 1); line(s.g, s.p(u1, v1, h1 + 7), s.p(u1, v0, h1 + 7), hex(WOOD), 1);
  // người gác (chấm) + mõ
  const [mx, my] = s.p(0.5, 0.45, h1 + 2); s.g.fillStyle = hex(0x6a4a2a); s.g.fillRect(mx - 3, my - 5, 6, 4); s.g.fillStyle = hex(WOOD_LIGHT); s.g.fillRect(mx - 2, my - 4, 4, 1);
  thatchPlane(s, [u0 - 0.1, 0.5, h1 + h2 + 7], [u1 + 0.1, 0.5, h1 + h2 + 7], [u1 + 0.1, v0 - 0.12, h1 + h2 - 1], [u0 - 0.1, v0 - 0.12, h1 + h2 - 1], lighten(STRAW, 0.12), 502);
  thatchPlane(s, [u0 - 0.1, 0.5, h1 + h2 + 7], [u1 + 0.1, 0.5, h1 + h2 + 7], [u1 + 0.1, v1 + 0.12, h1 + h2 - 1], [u0 - 0.1, v1 + 0.12, h1 + h2 - 1], STRAW, 503);
  // thang
  const la = s.p(0.95, 0.5, 0), lb = s.p(u1, 0.5, h1 + 2); line(s.g, la, lb, hex(WOOD_LIGHT), 1.2); line(s.g, [la[0] + 3, la[1] - 1], [lb[0] + 3, lb[1] - 1], hex(WOOD_LIGHT), 1.2);
  for (let k = 1; k < 6; k++) { const t = k / 6; line(s.g, [la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t], [la[0] + (lb[0] - la[0]) * t + 3, la[1] + (lb[1] - la[1]) * t - 1], hex(WOOD_DARK), 0.8); }
  flag(s, 0.12, 0.88, 20, RED);
  return s.c;
}

export function builderPost(): Canvas {
  const s = scene(1, 34);
  earthFloor(s, 0, 0, 1, 1, 511);
  // mái che hở, giá cưa, đống gỗ, gạch, thùng vữa
  for (const [u, v] of [[0.2, 0.15], [0.8, 0.15], [0.2, 0.65], [0.8, 0.65]] as [number, number][]) post(s, u, v, 12, 0, 1.3);
  thatchPlane(s, [0.1, 0.4, 19], [0.9, 0.4, 19], [0.9, 0.05, 11], [0.1, 0.05, 11], lighten(STRAW, 0.12), 512);
  thatchPlane(s, [0.1, 0.4, 19], [0.9, 0.4, 19], [0.9, 0.75, 11], [0.1, 0.75, 11], STRAW, 513);
  const g = s.g;
  const [gx, gy] = s.p(0.35, 0.9); line(g, [gx - 5, gy], [gx - 2, gy - 6], hex(WOOD_DARK), 1); line(g, [gx + 5, gy], [gx + 2, gy - 6], hex(WOOD_DARK), 1); line(g, [gx - 7, gy - 7], [gx + 7, gy - 7], hex(0x9a9aa0), 1.4);
  const [px, py] = s.p(0.85, 0.9); for (let i = 0; i < 3; i++) { g.fillStyle = hex(WOOD_DARK); g.fillRect(px - 6, py - 3 - i * 3, 12, 3); g.fillStyle = hex(WOOD_LIGHT); g.beginPath(); g.ellipse(px - 6, py - 1.5 - i * 3, 1.6, 1.4, 0, 0, Math.PI * 2); g.fill(); }
  const [bx, by] = s.p(0.5, 0.4, 0); for (let i = 0; i < 6; i++) { g.fillStyle = hex(i % 2 ? BRICK : BRICK_DARK); g.fillRect(bx - 6 + (i % 3) * 4, by - 2 - Math.floor(i / 3) * 2.5, 3.5, 2); }
  const [tx, ty] = s.p(0.75, 0.45); g.fillStyle = hex(0x6a6a60); g.beginPath(); g.ellipse(tx, ty - 2, 3.5, 2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0x8a8a80); g.fillRect(tx - 3.5, ty - 5, 7, 3);
  return s.c;
}

export function yamen(): Canvas {
  const s = scene(2, 54);
  earthFloor(s, 0, 0, 2, 2, 521);
  yardWall(s, [0.06, 0.06], [1.94, 0.06]); yardWall(s, [0.06, 0.06], [0.06, 1.94]);
  polyUV(s, [[0.2, 0.25, 0], [1.9, 0.25, 0], [1.9, 1.1, 0], [0.2, 1.1, 0]], hex(STONE_DARK));
  polyUV(s, [[0.2, 0.25, 3], [1.9, 0.25, 3], [1.9, 1.1, 3], [0.2, 1.1, 3]], hex(STONE));
  homestead(s, 0.3, 0.3, 1.8, 1.0, { wall: 'lime', roof: 'tile', wallH: 15, ridge: 32, bays: 3, seed: 522, ornament: true });
  for (let i = 0; i < 3; i++) { const c = 0.3 + ((i + 0.5) / 3) * 1.5; polyUV(s, [[c - 0.12, 1.0, 0], [c + 0.12, 1.0, 0], [c + 0.12, 1.0, 11], [c - 0.12, 1.0, 11]], hex(RED)); line(s.g, s.p(c, 1.0, 0), s.p(c, 1.0, 11), hex(darken(RED, 0.4)), 0.8); }
  // trống, hai cột cờ, bình phong
  const [dx, dy] = s.p(0.5, 1.4); s.g.fillStyle = hex(0x8a3a2a); s.g.fillRect(dx - 4, dy - 8, 8, 7); s.g.fillStyle = hex(0xe8d8b0); s.g.fillRect(dx - 4, dy - 8, 8, 1.2);
  polyUV(s, [[0.9, 1.5, 0], [1.3, 1.5, 0], [1.3, 1.5, 9], [0.9, 1.5, 9]], hex(BRICK)); polyUV(s, [[0.88, 1.5, 9], [1.32, 1.5, 9], [1.32, 1.48, 10.5], [0.88, 1.48, 10.5]], hex(TILE));
  flag(s, 0.25, 1.75, 26, GOLD); flag(s, 1.75, 1.75, 26, RED);
  yardWall(s, [0.06, 1.94], [1.94, 1.94]); yardWall(s, [1.94, 0.06], [1.94, 1.94]);
  yardGate(s, 1.1, 1.94, 0.2, 12);
  return s.c;
}

export function port(): Canvas {
  const s = scene(2, 44);
  earthFloor(s, 0, 0, 2, 2, 531);
  // cầu tàu gỗ chiếm nửa trước, cọc neo, nhà kho ngói, cần cẩu, thùng hàng
  for (const u of [0.15, 0.7, 1.25, 1.85]) post(s, u, 1.95, 6, 0, 1.5);
  for (const v of [1.2, 1.6]) post(s, 1.95, v, 6, 0, 1.5);
  polyUV(s, [[0.1, 1.05, 6], [2, 1.05, 6], [2, 2, 6], [0.1, 2, 6]], hex(WOOD));
  for (let v = 1.15; v < 2; v += 0.1) line(s.g, s.p(0.1, v, 6), s.p(2, v, 6), hex(WOOD_DARK), 0.6);
  polyUV(s, [[0.1, 2, 0], [2, 2, 0], [2, 2, 6], [0.1, 2, 6]], hex(WOOD_DARK)); polyUV(s, [[2, 2, 0], [2, 1.05, 0], [2, 1.05, 6], [2, 2, 6]], hex(darken(WOOD_DARK, 0.3)));
  for (const [u, v] of [[0.3, 1.9], [1.0, 1.9], [1.7, 1.9]] as [number, number][]) { post(s, u, v, 7, 6, 2); const [x, y] = s.p(u, v, 13); s.g.fillStyle = hex(WOOD_LIGHT); s.g.fillRect(x - 1.5, y - 1, 3, 2); }
  homestead(s, 0.2, 0.2, 1.3, 0.9, { wall: 'plank', roof: 'tile', wallH: 12, ridge: 24, bays: 2, seed: 532 });
  // cần cẩu gỗ
  const [cx, cy] = s.p(1.65, 0.6); line(s.g, [cx, cy], [cx, cy - 26], hex(WOOD_DARK), 2); line(s.g, [cx, cy - 24], [cx + 16, cy - 14], hex(WOOD_DARK), 1.6); line(s.g, [cx + 16, cy - 14], [cx + 16, cy - 4], hex(0x3a3a3a), 0.8); line(s.g, [cx, cy - 20], [cx + 10, cy - 18], hex(WOOD), 1);
  s.g.fillStyle = hex(WOOD_DARK); s.g.fillRect(cx + 12, cy - 4, 8, 6); s.g.fillStyle = hex(WOOD); s.g.fillRect(cx + 12, cy - 4, 8, 1);
  const r = rng(533); for (let i = 0; i < 4; i++) { const [x, y] = s.p(0.4 + r() * 1.2, 1.2 + r() * 0.5, 6); s.g.fillStyle = hex(i % 2 ? WOOD_DARK : 0xd8c8a0); if (i % 2) { s.g.fillRect(x - 5, y - 6, 10, 6); s.g.fillStyle = hex(WOOD); s.g.fillRect(x - 5, y - 6, 10, 1); } else { s.g.beginPath(); s.g.ellipse(x, y - 2.5, 4.5, 3, 0, 0, Math.PI * 2); s.g.fill(); } }
  flag(s, 1.9, 0.3, 24, 0x3060c0);
  return s.c;
}

export function barracks(): Canvas {
  const s = scene(2, 50);
  earthFloor(s, 0, 0, 2, 2, 541);
  // hàng rào gỗ nhọn bao quanh
  const pal = (a: [number, number], b: [number, number]) => { const n = 14; for (let i = 0; i <= n; i++) { const u = a[0] + ((b[0] - a[0]) * i) / n, v = a[1] + ((b[1] - a[1]) * i) / n; const [x, y] = s.p(u, v); line(s.g, [x, y], [x, y - 9], hex(i % 2 ? WOOD_DARK : WOOD), 1.6); s.g.fillStyle = hex(WOOD_LIGHT); s.g.fillRect(x - 0.8, y - 10, 1.6, 1.5); } line(s.g, s.p(a[0], a[1], 5), s.p(b[0], b[1], 5), hex(WOOD), 1); };
  pal([0.06, 0.06], [1.94, 0.06]); pal([0.06, 0.06], [0.06, 1.94]);
  homestead(s, 0.25, 0.25, 1.85, 0.95, { wall: 'plank', roof: 'tile', wallH: 13, ridge: 26, bays: 3, seed: 542 });
  spearRack(s, 0.35, 1.35, 6);
  // bù nhìn tập, trống, cờ
  const [tx, ty] = s.p(1.5, 1.4); line(s.g, [tx, ty], [tx, ty - 14], hex(WOOD_DARK), 1.5); line(s.g, [tx - 6, ty - 10], [tx + 6, ty - 10], hex(WOOD), 1.2); s.g.fillStyle = hex(STRAW); s.g.beginPath(); s.g.arc(tx, ty - 15, 2.5, 0, Math.PI * 2); s.g.fill();
  const [dx, dy] = s.p(1.75, 1.75); s.g.fillStyle = hex(0x8a3a2a); s.g.fillRect(dx - 4, dy - 7, 8, 6); s.g.fillStyle = hex(0xe8d8b0); s.g.fillRect(dx - 4, dy - 7, 8, 1.2);
  pal([0.06, 1.94], [0.9, 1.94]); pal([1.3, 1.94], [1.94, 1.94]); pal([1.94, 0.06], [1.94, 1.94]);
  post(s, 0.9, 1.94, 13, 0, 2); post(s, 1.3, 1.94, 13, 0, 2); line(s.g, s.p(0.88, 1.94, 13), s.p(1.32, 1.94, 13), hex(WOOD_DARK), 2);
  flag(s, 0.2, 1.75, 28, RED);
  return s.c;
}

/** Ô thành nâng cao trọn hình thoi (như đê): hai mặt trước là sườn / tường, mặt trên là đỉnh. */
function rampart(s: Scene, h: number, side: number, sideDark: number, top: number): void {
  polyUV(s, [[0, 1, 0], [1, 1, 0], [1, 1, h], [0, 1, h]], hex(side));
  polyUV(s, [[1, 1, 0], [1, 0, 0], [1, 0, h], [1, 1, h]], hex(sideDark));
  polyUV(s, [[0, 0, h], [1, 0, h], [1, 1, h], [0, 1, h]], hex(top));
}

export function earthWall(): Canvas {
  const s = scene(1, 16);
  const h = 14;
  rampart(s, h, EARTH, EARTH_DARK, mix2(EARTH, GRASS));
  const r = rng(551); const g = s.g;
  // vân đất nện, cỏ mọc chân, chông tre trên đỉnh
  for (let z = 2; z < h; z += 3) { line(g, s.p(0, 1, z), s.p(1, 1, z), hex(darken(EARTH, 0.25)), 0.6); line(g, s.p(1, 1, z), s.p(1, 0, z), hex(darken(EARTH_DARK, 0.25)), 0.6); }
  for (let i = 0; i < 8; i++) { const u = r(); const [x, y] = s.p(u, 1, 0.5); line(g, [x, y], [x + 0.5, y - 2 - r()], hex(GRASS), 0.7); const [x2, y2] = s.p(1, u, 0.5); line(g, [x2, y2], [x2 - 0.5, y2 - 2 - r()], hex(darken(GRASS, 0.2)), 0.7); }
  for (let i = 0; i < 5; i++) { const [x, y] = s.p(0.2 + i * 0.15, 0.5, h); line(g, [x, y], [x + (r() - 0.5) * 2, y - 6], hex(WOOD_DARK), 1); g.fillStyle = hex(WOOD_LIGHT); g.fillRect(x - 0.6, y - 7, 1.2, 1.2); }
  return s.c;
}
function mix2(a: number, b: number): number { return ((((a >> 16) + (b >> 16)) >> 1) << 16) | (((((a >> 8) & 255) + ((b >> 8) & 255)) >> 1) << 8) | (((a & 255) + (b & 255)) >> 1); }

export function stoneWall(): Canvas {
  const s = scene(1, 26);
  const h = 20;
  rampart(s, h, STONE, STONE_DARK, STONE_LIGHT);
  const r = rng(561); const g = s.g;
  // khối đá xếp hàng so le
  for (let z = 0; z < h; z += 3.5) { const off = (z / 3.5) % 2 ? 0.12 : 0; line(g, s.p(0, 1, z), s.p(1, 1, z), hex(darken(STONE, 0.4)), 0.7); line(g, s.p(1, 1, z), s.p(1, 0, z), hex(darken(STONE_DARK, 0.3)), 0.7); for (let u = off; u < 1; u += 0.25) { line(g, s.p(u, 1, z), s.p(u, 1, z + 3.5), hex(darken(STONE, 0.35)), 0.6); line(g, s.p(1, u, z), s.p(1, u, z + 3.5), hex(darken(STONE_DARK, 0.3)), 0.6); } }
  for (let i = 0; i < 6; i++) { const [x, y] = s.p(r(), 1, r() * h); g.fillStyle = hex(lighten(STONE, 0.2)); g.fillRect(x, y, 2, 1); }
  // lỗ châu mai trên đỉnh: dãy khối nhỏ dọc hai cạnh sau (không che mặt trước)
  for (let t = 0.1; t < 1; t += 0.25) { polyUV(s, [[t, 0.02, h], [t + 0.12, 0.02, h], [t + 0.12, 0.02, h + 4], [t, 0.02, h + 4]], hex(STONE)); polyUV(s, [[t, 0.02, h + 4], [t + 0.12, 0.02, h + 4], [t + 0.12, 0.12, h + 4], [t, 0.12, h + 4]], hex(STONE_LIGHT)); polyUV(s, [[0.02, t, h], [0.02, t + 0.12, h], [0.02, t + 0.12, h + 4], [0.02, t, h + 4]], hex(STONE_DARK)); polyUV(s, [[0.02, t, h + 4], [0.02, t + 0.12, h + 4], [0.12, t + 0.12, h + 4], [0.12, t, h + 4]], hex(STONE_LIGHT)); }
  return s.c;
}

export function gate(): Canvas {
  const s = scene(1, 40);
  // lầu cổng gạch: khối vuông có vòm cổng ở hai mặt trước (đường chạy qua bên dưới), lầu gỗ và mái ngói bên trên
  const h = 16;
  polyUV(s, [[0.12, 0.88, 0], [0.88, 0.88, 0], [0.88, 0.88, h], [0.12, 0.88, h]], hex(BRICK));
  polyUV(s, [[0.88, 0.88, 0], [0.88, 0.12, 0], [0.88, 0.12, h], [0.88, 0.88, h]], hex(BRICK_DARK));
  polyUV(s, [[0.12, 0.12, h], [0.88, 0.12, h], [0.88, 0.88, h], [0.12, 0.88, h]], hex(lighten(BRICK, 0.2)));
  for (let z = 2; z < h; z += 2.5) { line(s.g, s.p(0.12, 0.88, z), s.p(0.88, 0.88, z), 'rgba(60,30,20,0.45)', 0.6); line(s.g, s.p(0.88, 0.88, z), s.p(0.88, 0.12, z), 'rgba(40,20,10,0.45)', 0.6); }
  // vòm cổng hai mặt
  const arch = (face: 'front' | 'right') => { const pts: [number, number][] = []; for (let k = 0; k <= 8; k++) { const t = k / 8, c = 0.5 + (t - 0.5) * 0.44, z = 11 * Math.sqrt(1 - Math.pow((t - 0.5) * 2, 2)); pts.push(face === 'front' ? s.p(c, 0.88, z) : s.p(0.88, 1 - c, z)); } pts.push(face === 'front' ? s.p(0.72, 0.88, 0) : s.p(0.88, 0.28, 0)); pts.push(face === 'front' ? s.p(0.28, 0.88, 0) : s.p(0.88, 0.72, 0)); poly(s.g, pts, hex(0x1e160e)); };
  arch('front'); arch('right');
  // lầu gỗ trên: lan can, cột, mái ngói
  for (let u = 0.15; u < 0.88; u += 0.1) line(s.g, s.p(u, 0.9, h), s.p(u, 0.9, h + 4), hex(WOOD), 0.8);
  line(s.g, s.p(0.12, 0.9, h + 4), s.p(0.88, 0.9, h + 4), hex(WOOD_DARK), 1);
  for (const [u, v] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]] as [number, number][]) post(s, u, v, 10, h, 1.5);
  polyUV(s, [[0.2, 0.2, h], [0.8, 0.2, h], [0.8, 0.2, h + 10], [0.2, 0.2, h + 10]], hex(RED));
  tilePlane(s, [0.05, 0.5, h + 18], [0.95, 0.5, h + 18], [0.95, 0.05, h + 9], [0.05, 0.05, h + 9], TILE_LIGHT);
  tilePlane(s, [0.05, 0.5, h + 18], [0.95, 0.5, h + 18], [0.95, 0.95, h + 9], [0.05, 0.95, h + 9], TILE);
  line(s.g, s.p(0.05, 0.5, h + 18), s.p(0.95, 0.5, h + 18), hex(0xd8d0c0), 1.5);
  return s.c;
}

export function dock(): Canvas {
  const s = scene(1, 22);
  earthFloor(s, 0, 0, 1, 1, 571);
  // cầu gỗ nhỏ trên cọc, cọc neo, dây, thúng
  for (const [u, v] of [[0.2, 0.95], [0.6, 0.95], [0.95, 0.95], [0.95, 0.5]] as [number, number][]) post(s, u, v, 5, 0, 1.3);
  polyUV(s, [[0.1, 0.4, 5], [1, 0.4, 5], [1, 1, 5], [0.1, 1, 5]], hex(WOOD));
  for (let v = 0.5; v < 1; v += 0.1) line(s.g, s.p(0.1, v, 5), s.p(1, v, 5), hex(WOOD_DARK), 0.6);
  polyUV(s, [[0.1, 1, 0], [1, 1, 0], [1, 1, 5], [0.1, 1, 5]], hex(WOOD_DARK)); polyUV(s, [[1, 1, 0], [1, 0.4, 0], [1, 0.4, 5], [1, 1, 5]], hex(darken(WOOD_DARK, 0.3)));
  for (const [u, v] of [[0.3, 0.9], [0.8, 0.9]] as [number, number][]) { post(s, u, v, 6, 5, 1.8); const [x, y] = s.p(u, v, 11); s.g.fillStyle = hex(WOOD_LIGHT); s.g.fillRect(x - 1.5, y - 1, 3, 1.5); }
  const [a, b] = [s.p(0.3, 0.9, 10), s.p(0.8, 0.9, 10)]; s.g.strokeStyle = hex(0x3a3a3a); s.g.lineWidth = 0.7; s.g.beginPath(); s.g.moveTo(a[0], a[1]); s.g.quadraticCurveTo((a[0] + b[0]) / 2, a[1] + 4, b[0], b[1]); s.g.stroke();
  const [bx, by] = s.p(0.6, 0.55, 5); s.g.fillStyle = hex(0xb89a5a); s.g.beginPath(); s.g.ellipse(bx, by - 1, 4, 2.2, 0, 0, Math.PI * 2); s.g.fill(); s.g.fillStyle = hex(0x80a8c0); s.g.beginPath(); s.g.ellipse(bx, by - 2.5, 3, 1.5, 0, 0, Math.PI * 2); s.g.fill();
  waterJar(s, 0.2, 0.25);
  return s.c;
}

/** Hàng rào gỗ nhọn (dùng chung trại lính / trại cung thủ). */
function palisade(s: Scene, a: [number, number], b: [number, number], n = 14): void {
  for (let i = 0; i <= n; i++) { const u = a[0] + ((b[0] - a[0]) * i) / n, v = a[1] + ((b[1] - a[1]) * i) / n; const [x, y] = s.p(u, v); line(s.g, [x, y], [x, y - 9], hex(i % 2 ? WOOD_DARK : WOOD), 1.6); s.g.fillStyle = hex(WOOD_LIGHT); s.g.fillRect(x - 0.8, y - 10, 1.6, 1.5); }
  line(s.g, s.p(a[0], a[1], 5), s.p(b[0], b[1], 5), hex(WOOD), 1);
}

/** M8: chòi canh biên — tháp gỗ cao bốn cột, sàn gác có lan can, mái rơm, thang dài, cờ đỏ trên đỉnh, đống củi báo hiệu dưới chân. */
export function watchtower(): Canvas {
  const s = scene(1, 66);
  earthFloor(s, 0, 0, 1, 1, 581);
  shadow(s, 0.55, 0.55, 0.42, 0.42, 0.2);
  const u0 = 0.3, v0 = 0.3, u1 = 0.7, v1 = 0.7, h1 = 34, h2 = 11;
  // chân cột xòe rộng hơn sàn: vẽ cột nghiêng từ góc ô vào sàn
  for (const [[ua, va], [ub, vb]] of [[[0.15, 0.15], [u0, v0]], [[0.85, 0.15], [u1, v0]], [[0.15, 0.85], [u0, v1]], [[0.85, 0.85], [u1, v1]]] as [[number, number], [number, number]][]) line(s.g, s.p(ua, va, 0), s.p(ub, vb, h1), hex(WOOD_DARK), 1.6);
  // giằng chéo hai mặt trước
  for (const z of [10, 22]) { line(s.g, s.p(0.15 + (u0 - 0.15) * (z / h1), 0.85 - (0.85 - v1) * (z / h1), z), s.p(0.85 - (0.85 - u1) * ((z + 10) / h1), 0.85 - (0.85 - v1) * ((z + 10) / h1), z + 10), hex(WOOD), 0.9); line(s.g, s.p(0.85 - (0.85 - u1) * (z / h1), 0.85 - (0.85 - v1) * (z / h1), z), s.p(0.85 - (0.85 - u1) * ((z + 10) / h1), 0.15 + (v0 - 0.15) * ((z + 10) / h1), z + 10), hex(WOOD), 0.9); }
  // sàn gác dày + lan can
  polyUV(s, [[u0 - 0.06, v1 + 0.06, h1], [u1 + 0.06, v1 + 0.06, h1], [u1 + 0.06, v1 + 0.06, h1 + 2], [u0 - 0.06, v1 + 0.06, h1 + 2]], hex(WOOD_DARK));
  polyUV(s, [[u1 + 0.06, v1 + 0.06, h1], [u1 + 0.06, v0 - 0.06, h1], [u1 + 0.06, v0 - 0.06, h1 + 2], [u1 + 0.06, v1 + 0.06, h1 + 2]], hex(darken(WOOD_DARK, 0.3)));
  polyUV(s, [[u0 - 0.06, v0 - 0.06, h1 + 2], [u1 + 0.06, v0 - 0.06, h1 + 2], [u1 + 0.06, v1 + 0.06, h1 + 2], [u0 - 0.06, v1 + 0.06, h1 + 2]], hex(WOOD));
  for (let u = u0 - 0.02; u <= u1 + 0.06; u += 0.09) line(s.g, s.p(u, v1 + 0.06, h1 + 2), s.p(u, v1 + 0.06, h1 + 7), hex(WOOD_LIGHT), 0.8);
  for (let v = v0 - 0.02; v <= v1 + 0.06; v += 0.09) line(s.g, s.p(u1 + 0.06, v, h1 + 2), s.p(u1 + 0.06, v, h1 + 7), hex(WOOD_LIGHT), 0.8);
  line(s.g, s.p(u0 - 0.06, v1 + 0.06, h1 + 7), s.p(u1 + 0.06, v1 + 0.06, h1 + 7), hex(WOOD), 1); line(s.g, s.p(u1 + 0.06, v1 + 0.06, h1 + 7), s.p(u1 + 0.06, v0 - 0.06, h1 + 7), hex(WOOD), 1);
  // người gác cầm giáo và mõ treo
  const [px, py] = s.p(0.5, 0.5, h1 + 2); s.g.fillStyle = hex(0x5a3a2a); s.g.fillRect(px - 2.5, py - 9, 5, 6); s.g.fillStyle = hex(0xd8a878); s.g.fillRect(px - 1.5, py - 12, 3, 3); line(s.g, [px + 4, py - 2], [px + 4, py - 18], hex(WOOD_DARK), 0.9);
  const [mx, my] = s.p(u0, v1 + 0.06, h1 + 7); s.g.fillStyle = hex(WOOD_LIGHT); s.g.fillRect(mx - 2, my + 1, 4, 3);
  // cột mái và mái rơm bốn mái dốc
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) post(s, u, v, h2, h1 + 2, 1.2);
  thatchPlane(s, [u0 - 0.14, 0.5, h1 + 2 + h2 + 7], [u1 + 0.14, 0.5, h1 + 2 + h2 + 7], [u1 + 0.14, v0 - 0.16, h1 + 2 + h2 - 2], [u0 - 0.14, v0 - 0.16, h1 + 2 + h2 - 2], lighten(STRAW, 0.12), 582);
  thatchPlane(s, [u0 - 0.14, 0.5, h1 + 2 + h2 + 7], [u1 + 0.14, 0.5, h1 + 2 + h2 + 7], [u1 + 0.14, v1 + 0.16, h1 + 2 + h2 - 2], [u0 - 0.14, v1 + 0.16, h1 + 2 + h2 - 2], STRAW, 583);
  // thang dài từ chân lên sàn
  const la = s.p(0.97, 0.6, 0), lb = s.p(u1 + 0.06, 0.6, h1 + 2); line(s.g, la, lb, hex(WOOD_LIGHT), 1.2); line(s.g, [la[0] + 3, la[1] - 1], [lb[0] + 3, lb[1] - 1], hex(WOOD_LIGHT), 1.2);
  for (let k = 1; k < 10; k++) { const t = k / 10; line(s.g, [la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t], [la[0] + (lb[0] - la[0]) * t + 3, la[1] + (lb[1] - la[1]) * t - 1], hex(WOOD_DARK), 0.8); }
  // đống củi báo hiệu
  const [fx, fy] = s.p(0.2, 0.85); for (let i = 0; i < 4; i++) line(s.g, [fx - 4 + i * 2.5, fy], [fx - 1 + (i - 1.5) * 1.2, fy - 6], hex(i % 2 ? WOOD_DARK : WOOD), 1.2);
  flag(s, 0.5, 0.5, 14, RED, h1 + 2 + h2 + 7);
  return s.c;
}

/** M8: trại cung thủ — rào gỗ nhọn, nhà ván mái rơm, hai bia rơm tập bắn, giá cung, bó tên, cờ vàng. */
export function archerCamp(): Canvas {
  const s = scene(2, 50);
  earthFloor(s, 0, 0, 2, 2, 591);
  palisade(s, [0.06, 0.06], [1.94, 0.06]); palisade(s, [0.06, 0.06], [0.06, 1.94]);
  homestead(s, 0.25, 0.2, 1.25, 0.95, { wall: 'plank', roof: 'thatch', wallH: 12, ridge: 24, bays: 2, seed: 592 });
  // bãi tập: hai bia rơm tròn trên cọc, vạch đứng bắn
  for (const [u, v] of [[1.6, 0.35], [1.75, 0.7]] as [number, number][]) {
    const [x, y] = s.p(u, v); line(s.g, [x, y], [x, y - 10], hex(WOOD_DARK), 1.2);
    for (const [r, col] of [[6, 0xd8c890], [4.2, 0xb02020], [2.4, 0xe8e0d0], [1, 0x202020]] as [number, number][]) { s.g.fillStyle = hex(col); s.g.beginPath(); s.g.ellipse(x, y - 14, r, r * 0.9, 0, 0, Math.PI * 2); s.g.fill(); }
    line(s.g, [x - 3, y - 15], [x + 1, y - 13], hex(WOOD_LIGHT), 0.8); // tên cắm
  }
  const [vx, vy] = s.p(1.05, 1.1); line(s.g, [vx - 10, vy + 5], [vx + 10, vy - 5], hex(0xe8e0d0), 1); // vạch vôi
  // giá cung: hàng cung cong treo trên xà
  const u0 = 0.3, v = 1.45; line(s.g, s.p(u0, v, 14), s.p(u0 + 0.7, v, 14), hex(WOOD), 1.2); post(s, u0, v, 14, 0, 1.3); post(s, u0 + 0.7, v, 14, 0, 1.3);
  for (let i = 0; i < 5; i++) { const [x, y] = s.p(u0 + 0.1 + i * 0.13, v, 13); s.g.strokeStyle = hex(WOOD_DARK); s.g.lineWidth = 1; s.g.beginPath(); s.g.moveTo(x, y); s.g.quadraticCurveTo(x + 3.5, y + 5, x, y + 10); s.g.stroke(); line(s.g, [x, y], [x, y + 10], hex(0xe8e0d0), 0.5); }
  // thùng tên
  const [bx, by] = s.p(1.3, 1.5); s.g.fillStyle = hex(WOOD_DARK); s.g.fillRect(bx - 4, by - 7, 8, 7); s.g.fillStyle = hex(WOOD); s.g.fillRect(bx - 4, by - 7, 8, 1.5); for (let i = 0; i < 5; i++) { line(s.g, [bx - 3 + i * 1.5, by - 7], [bx - 3.5 + i * 1.6, by - 15], hex(0xd8c8a0), 0.7); s.g.fillStyle = hex(0xd0d0d8); s.g.fillRect(bx - 4 + i * 1.6, by - 16.5, 1.2, 1.8); }
  palisade(s, [0.06, 1.94], [0.85, 1.94], 6); palisade(s, [1.25, 1.94], [1.94, 1.94], 5); palisade(s, [1.94, 0.06], [1.94, 1.94]);
  post(s, 0.85, 1.94, 13, 0, 2); post(s, 1.25, 1.94, 13, 0, 2); line(s.g, s.p(0.83, 1.94, 13), s.p(1.27, 1.94, 13), hex(WOOD_DARK), 2);
  flag(s, 0.18, 1.75, 28, GOLD);
  return s.c;
}

/** M8: tàu voi — mái rơm lớn trên sáu cột, voi đứng trong, đống cỏ, máng nước, cọc xích, vải đỏ. */
export function elephantStable(): Canvas {
  const s = scene(2, 62);
  earthFloor(s, 0, 0, 2, 2, 601);
  const g = s.g;
  // sân: cọc xích và máng nước phía trước
  const [cx, cy] = s.p(1.7, 1.7); post(s, 1.7, 1.7, 9, 0, 2); g.strokeStyle = hex(0x4a4a50); g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - 7); g.quadraticCurveTo(cx - 8, cy - 2, cx - 14, cy - 6); g.stroke();
  const [tx, ty] = s.p(0.35, 1.7); g.fillStyle = hex(WOOD_DARK); g.fillRect(tx - 8, ty - 5, 16, 5); g.fillStyle = hex(0x4a8ac0); g.fillRect(tx - 7, ty - 4.5, 14, 2);
  haystack(s, 1.65, 0.35, 6);
  // sáu cột và mái rơm cao
  const u0 = 0.2, v0 = 0.2, u1 = 1.5, v1 = 1.35, h = 26;
  for (const [u, v] of [[u0, v0], [0.85, v0], [u1, v0], [u0, v1], [0.85, v1], [u1, v1]] as [number, number][]) post(s, u, v, h, 0, 2);
  // voi trong chuồng (nhìn nghiêng, đầu về phải)
  const E = 0x6e6a70, ED = 0x4a4650, EL = 0x8a868e;
  const [ex, ey] = s.p(0.85, 0.85);
  for (const dx of [-12, -5, 6, 12]) { g.fillStyle = hex(ED); g.fillRect(ex + dx, ey - 10, 4, 10); }
  g.fillStyle = hex(E); g.beginPath(); g.ellipse(ex, ey - 17, 16, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(EL); g.beginPath(); g.ellipse(ex - 2, ey - 21, 10, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(E); g.beginPath(); g.ellipse(ex + 16, ey - 19, 7, 6.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(ED); g.beginPath(); g.ellipse(ex + 10, ey - 19, 4, 6, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = hex(E); g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex + 21, ey - 16); g.quadraticCurveTo(ex + 27, ey - 9, ex + 24, ey - 2); g.stroke(); g.lineCap = 'butt';
  for (const dy of [0, 2.5]) line(g, [ex + 19, ey - 15 + dy], [ex + 26, ey - 12 + dy], hex(0xf0e8d0), 1.5);
  g.fillStyle = hex(RED); g.fillRect(ex - 8, ey - 27, 14, 5); g.fillStyle = hex(GOLD); g.fillRect(ex - 8, ey - 23, 14, 1); // vải phủ lưng
  line(g, [ex - 16, ey - 19], [ex - 20, ey - 10], hex(ED), 1.2);
  // xà và mái
  line(g, s.p(u0, v1, h), s.p(u1, v1, h), hex(WOOD_DARK), 1.5); line(g, s.p(u0, v0, h), s.p(u1, v0, h), hex(WOOD_DARK), 1.5);
  thatchPlane(s, [u0 - 0.15, (v0 + v1) / 2, h + 16], [u1 + 0.15, (v0 + v1) / 2, h + 16], [u1 + 0.15, v0 - 0.2, h - 1], [u0 - 0.15, v0 - 0.2, h - 1], lighten(STRAW, 0.1), 602);
  thatchPlane(s, [u0 - 0.15, (v0 + v1) / 2, h + 16], [u1 + 0.15, (v0 + v1) / 2, h + 16], [u1 + 0.15, v1 + 0.2, h - 1], [u0 - 0.15, v1 + 0.2, h - 1], STRAW, 603);
  line(g, s.p(u0 - 0.15, (v0 + v1) / 2, h + 16), s.p(u1 + 0.15, (v0 + v1) / 2, h + 16), hex(darken(STRAW, 0.35)), 1.5);
  yardWall(s, [0.06, 1.94], [1.94, 1.94], 5); yardWall(s, [1.94, 0.06], [1.94, 1.94], 5);
  flag(s, 0.12, 1.8, 24, RED);
  return s.c;
}

export function militaryFrames(): Record<string, Canvas> {
  const list: [string, () => Canvas][] = [['watchPost', watchPost], ['builderPost', builderPost], ['yamen', yamen], ['port', port], ['barracks', barracks], ['earthWall', earthWall], ['stoneWall', stoneWall], ['gate', gate], ['dock', dock], ['watchtower', watchtower], ['archerCamp', archerCamp], ['elephantStable', elephantStable]];
  const out: Record<string, Canvas> = {};
  for (const [k, f] of list) out[`buildings/${k}.png`] = f();
  return out;
}
void plankWall; void tree; void shadow; void STONE_LIGHT;
