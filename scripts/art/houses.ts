// Nhà ở bậc 2–10 (1×1), bản gộp 2×2 (bậc 2–9) và phủ đệ 3×3 (bậc 10). Một hàm `homestead()` tham số hóa:
// vách (đất / ván / vôi / gạch), mái (rơm / lá / ngói), cao tường, số gian, một hay hai tầng; bậc cao có sân, tường gạch, cổng, cây, ao.
import { darken, hex, lighten, line, poly, polyUV, rng, scene, shadow, type Canvas, type Scene } from './lib';
import { earthFloor, haystack, thatchPlane, waterJar } from './house';
import { plankWall, post, tilePlane } from './buildings';

const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, TILE = 0x8a4a3a, TILE_LIGHT = 0xa86050;
const EARTH_WALL = 0xb89a6a, LIME = 0xe8e0d0, BRICK = 0x9a5a42, BRICK_DARK = 0x6a3a2a, LEAF = 0x8a8a44, STRAW = 0xc9a85c, DOOR = 0x3a2a18;

type Wall = 'earth' | 'plank' | 'lime' | 'brick';
type Roof = 'thatch' | 'leaf' | 'tile';
export interface HomeOpts { wall: Wall; roof: Roof; wallH: number; ridge: number; bays?: number; storeys?: 1 | 2; seed: number; /** cửa ở mặt phải (u = u1) thay vì mặt trước (v = v1) */ doorRight?: boolean; ornament?: boolean }

/** Vách phẳng một mặt (đất / vôi / gạch) từ a tới b, cao h từ z0. */
function flatWall(s: Scene, a: [number, number], b: [number, number], h: number, z0: number, kind: Wall, shade: number, seed: number): void {
  const base = kind === 'earth' ? EARTH_WALL : kind === 'lime' ? LIME : BRICK;
  const col = darken(base, shade);
  const pts: [number, number][] = [s.p(a[0], a[1], z0), s.p(b[0], b[1], z0), s.p(b[0], b[1], z0 + h), s.p(a[0], a[1], z0 + h)];
  poly(s.g, pts, hex(col));
  if (kind === 'brick') { const r = rng(seed); for (let z = 2; z < h; z += 2.5) line(s.g, s.p(a[0], a[1], z0 + z), s.p(b[0], b[1], z0 + z), hex(darken(col, 0.3 + r() * 0.1)), 0.6); }
  if (kind === 'earth') line(s.g, s.p(a[0], a[1], z0 + 1.5), s.p(b[0], b[1], z0 + 1.5), hex(darken(col, 0.35)), 1.2); // chân tường sẫm
  if (kind === 'lime') { line(s.g, s.p(a[0], a[1], z0 + 2), s.p(b[0], b[1], z0 + 2), hex(0x8a7a60), 1.5); line(s.g, s.p(a[0], a[1], z0 + h - 0.6), s.p(b[0], b[1], z0 + h - 0.6), hex(WOOD_DARK), 1); }
}

/** Cửa (tối) trên mặt v = v1 giữa u0..u1 hoặc mặt u = u1 giữa v0..v1. */
function door(s: Scene, face: 'front' | 'right', c: number, k: number, half: number, z0: number, h: number, frame = true): void {
  if (face === 'front') polyUV(s, [[c - half, k, z0], [c + half, k, z0], [c + half, k, z0 + h], [c - half, k, z0 + h]], hex(DOOR));
  else polyUV(s, [[k, c + half, z0], [k, c - half, z0], [k, c - half, z0 + h], [k, c + half, z0 + h]], hex(DOOR));
  if (frame) {
    const a = face === 'front' ? s.p(c - half, k, z0 + h) : s.p(k, c + half, z0 + h), b = face === 'front' ? s.p(c + half, k, z0 + h) : s.p(k, c - half, z0 + h);
    line(s.g, a, b, hex(WOOD), 1.2);
  }
}

/** Ngôi nhà trên vùng [u0, u1] × [v0, v1], nóc dọc trục u, cửa ở mặt trước (v = v1). */
export function homestead(s: Scene, u0: number, v0: number, u1: number, v1: number, o: HomeOpts): void {
  const g = s.g;
  const storeys = o.storeys ?? 1, wall = o.wallH * storeys, ridge = o.ridge, ov = o.roof === 'tile' ? 0.14 : 0.12, vm = (v0 + v1) / 2;
  shadow(s, (u0 + u1) / 2 + 0.1, (v0 + v1) / 2 + 0.1, (u1 - u0) * 0.75, (v1 - v0) * 0.75, 0.22);
  // vách trước và phải
  if (o.wall === 'plank') { plankWall(s, [u0, v1], [u1, v1], wall, 0, WOOD, o.seed + 1); plankWall(s, [u1, v1], [u1, v0], wall, 0, darken(WOOD, 0.2), o.seed + 2); }
  else { flatWall(s, [u0, v1], [u1, v1], wall, 0, o.wall, 0, o.seed + 1); flatWall(s, [u1, v1], [u1, v0], wall, 0, o.wall, 0.18, o.seed + 2); }
  // hồi nhà
  polyUV(s, [[u1, v1, wall], [u1, v0, wall], [u1, vm, ridge - 2]], hex(o.wall === 'plank' ? darken(WOOD, 0.35) : o.wall === 'lime' ? 0xc8c0b0 : darken(o.wall === 'earth' ? EARTH_WALL : BRICK, 0.3)));
  // cột góc / khung gỗ nhà vôi
  for (const [u, v] of [[u0, v1], [u1, v1], [u1, v0]] as [number, number][]) post(s, u, v, wall, 0, 1.2);
  // cửa và cửa sổ
  const bays = o.bays ?? 1;
  if (o.doorRight) door(s, 'right', vm, u1, 0.13, 0, o.wallH - 2);
  else for (let i = 0; i < bays; i++) { const c = u0 + ((i + 0.5) / bays) * (u1 - u0); door(s, 'front', c, v1, Math.min(0.13, (u1 - u0) / bays / 3), 0, o.wallH - 2); if (bays > 1 && i < bays - 1) post(s, u0 + ((i + 1) / bays) * (u1 - u0), v1, wall, 0, 1); }
  if (storeys === 2) {
    // sàn tầng hai + lan can + cửa sổ tầng trên
    line(g, s.p(u0, v1, o.wallH), s.p(u1, v1, o.wallH), hex(WOOD_DARK), 1.5);
    line(g, s.p(u1, v1, o.wallH), s.p(u1, v0, o.wallH), hex(WOOD_DARK), 1.5);
    for (let u = u0 + 0.1; u < u1; u += 0.15) line(g, s.p(u, v1 + 0.04, o.wallH), s.p(u, v1 + 0.04, o.wallH + 3), hex(WOOD), 0.8);
    line(g, s.p(u0, v1 + 0.04, o.wallH + 3), s.p(u1, v1 + 0.04, o.wallH + 3), hex(WOOD), 1);
    for (let i = 0; i < Math.max(2, bays); i++) { const c = u0 + ((i + 0.5) / Math.max(2, bays)) * (u1 - u0); polyUV(s, [[c - 0.08, v1, o.wallH + 4], [c + 0.08, v1, o.wallH + 4], [c + 0.08, v1, o.wallH + 8], [c - 0.08, v1, o.wallH + 8]], hex(0x2a3a4a)); }
  } else if (!o.doorRight && o.wall !== 'earth') {
    polyUV(s, [[u1, v0 + 0.3, 4], [u1, v0 + 0.5, 4], [u1, v0 + 0.5, wall - 3], [u1, v0 + 0.3, wall - 3]], hex(0x2a3a4a)); // cửa sổ hông
  }
  // mái
  const eave = wall - 1;
  if (o.roof === 'tile') {
    tilePlane(s, [u0 - ov, vm, ridge], [u1 + ov, vm, ridge], [u1 + ov, v0 - ov, eave], [u0 - ov, v0 - ov, eave], TILE_LIGHT);
    tilePlane(s, [u0 - ov, vm, ridge], [u1 + ov, vm, ridge], [u1 + ov, v1 + ov, eave], [u0 - ov, v1 + ov, eave], TILE);
    line(g, s.p(u0 - ov, vm, ridge), s.p(u1 + ov, vm, ridge), hex(o.ornament ? 0xd8d0c0 : 0x4a2a22), o.ornament ? 2 : 1.5);
    if (o.ornament) for (const [u, d] of [[u0 - ov, -1], [u1 + ov, 1]] as [number, number][]) { const [x, y] = s.p(u, vm, ridge); g.strokeStyle = hex(0xd8d0c0); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + d * 2, y - 1, x + d * 3, y - 4); g.stroke(); }
  } else {
    const base = o.roof === 'leaf' ? LEAF : STRAW;
    thatchPlane(s, [u0 - ov, vm, ridge], [u1 + ov, vm, ridge], [u1 + ov, v0 - ov, eave], [u0 - ov, v0 - ov, eave], lighten(base, 0.12), o.seed + 3);
    thatchPlane(s, [u0 - ov, vm, ridge], [u1 + ov, vm, ridge], [u1 + ov, v1 + ov, eave], [u0 - ov, v1 + ov, eave], base, o.seed + 4);
    line(g, s.p(u0 - ov, vm, ridge), s.p(u1 + ov, vm, ridge), hex(darken(base, 0.35)), 2);
  }
}

/** Tường gạch thấp (sân) dọc đoạn a→b trên mặt đất, cao h, có mái ngói mỏng. */
export function yardWall(s: Scene, a: [number, number], b: [number, number], h = 6): void {
  const n: [number, number] = a[0] === b[0] ? [0.05, 0] : [0, 0.05]; // bề dày
  polyUV(s, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], h], [a[0], a[1], h]], hex(BRICK));
  polyUV(s, [[b[0], b[1], 0], [b[0] + n[0], b[1] + n[1], 0], [b[0] + n[0], b[1] + n[1], h], [b[0], b[1], h]], hex(BRICK_DARK));
  polyUV(s, [[a[0], a[1], h], [b[0], b[1], h], [b[0] + n[0], b[1] + n[1], h], [a[0] + n[0], a[1] + n[1], h]], hex(TILE));
  line(s.g, s.p(a[0], a[1], h), s.p(b[0], b[1], h), hex(darken(TILE, 0.4)), 0.8);
}

/** Cổng nhỏ có mái ngói tại điểm c trên tường dọc trục u (mặt trước v = k). */
export function gate(s: Scene, c: number, k: number, half = 0.14, h = 10): void {
  post(s, c - half, k, h, 0, 1.5); post(s, c + half, k, h, 0, 1.5);
  polyUV(s, [[c - half - 0.06, k - 0.08, h - 2], [c + half + 0.06, k - 0.08, h - 2], [c + half + 0.06, k + 0.08, h - 2], [c - half - 0.06, k + 0.08, h - 2]], hex(TILE_LIGHT));
  polyUV(s, [[c - half - 0.06, k + 0.08, h - 2], [c + half + 0.06, k + 0.08, h - 2], [c + half + 0.06, k - 0.08, h + 1], [c - half - 0.06, k - 0.08, h + 1]], hex(TILE));
  line(s.g, s.p(c - half - 0.06, k - 0.08, h + 1), s.p(c + half + 0.06, k - 0.08, h + 1), hex(0x4a2a22), 1);
}

/** Cây xanh tán tròn. */
export function tree(s: Scene, u: number, v: number, r = 6, h = 7): void {
  const [x, y] = s.p(u, v);
  line(s.g, [x, y], [x, y - h], hex(WOOD_DARK), 1.5);
  s.g.fillStyle = hex(0x3f6a2a); s.g.beginPath(); s.g.ellipse(x, y - h - r * 0.5, r, r * 0.75, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(0x5a8a3a); s.g.beginPath(); s.g.ellipse(x - r * 0.3, y - h - r * 0.8, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); s.g.fill();
}

/** Ao nhỏ. */
export function pond(s: Scene, u: number, v: number, ru: number, rv: number): void {
  const [x, y] = s.p(u, v);
  s.g.fillStyle = hex(0x6a5a40); s.g.beginPath(); s.g.ellipse(x, y, ru * 32 + 1.5, rv * 16 + 1, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(0x4a7a9a); s.g.beginPath(); s.g.ellipse(x, y, ru * 32, rv * 16, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(0x5a9a4a); for (const [dx, dy] of [[-4, 1], [3, -1], [1, 2]]) { s.g.beginPath(); s.g.ellipse(x + dx, y + dy, 2, 1.2, 0, 0, Math.PI * 2); s.g.fill(); }
}

/** Thông số nhà theo bậc (1×1). */
const LEVEL: Record<number, HomeOpts> = {
  2: { wall: 'earth', roof: 'thatch', wallH: 10, ridge: 20, seed: 12, doorRight: true },
  3: { wall: 'earth', roof: 'thatch', wallH: 11, ridge: 21, seed: 13 },
  4: { wall: 'plank', roof: 'leaf', wallH: 11, ridge: 21, seed: 14 },
  5: { wall: 'plank', roof: 'tile', wallH: 12, ridge: 22, seed: 15 },
  6: { wall: 'lime', roof: 'tile', wallH: 12, ridge: 24, bays: 3, seed: 16 },
  7: { wall: 'lime', roof: 'tile', wallH: 13, ridge: 26, bays: 3, seed: 17, ornament: true },
  8: { wall: 'lime', roof: 'tile', wallH: 11, ridge: 32, bays: 2, storeys: 2, seed: 18 },
  9: { wall: 'brick', roof: 'tile', wallH: 11, ridge: 32, bays: 2, storeys: 2, seed: 19, ornament: true },
  10: { wall: 'brick', roof: 'tile', wallH: 12, ridge: 34, bays: 3, storeys: 2, seed: 20, ornament: true },
};

export function house1(level: number): Canvas {
  const o = LEVEL[level];
  const s = scene(1, 44);
  earthFloor(s, 0, 0, 1, 1, level * 3);
  if (level >= 6) { yardWall(s, [0.06, 0.94], [0.94, 0.94], 5); gate(s, 0.5, 0.94, 0.1, 8); }
  homestead(s, 0.12, 0.12, 0.86, level >= 6 ? 0.7 : 0.84, o);
  if (level <= 4) waterJar(s, 0.94, 0.3);
  if (level === 3) for (let u = 0.1; u < 0.9; u += 0.12) line(s.g, s.p(u, 0.95), s.p(u, 0.95, 4), hex(WOOD_DARK), 1);
  if (level >= 4 && level <= 7) tree(s, 0.1, 0.1, 4, 5);
  return s.c;
}

/** Bản gộp 2×2 bậc 2–9. */
export function house2(level: number): Canvas {
  const o = LEVEL[level];
  const s = scene(2, 56);
  earthFloor(s, 0, 0, 2, 2, level * 5);
  if (level <= 5) {
    homestead(s, 0.15, 1.1, 0.9, 1.85, { ...o, seed: o.seed + 100 });
    homestead(s, 1.1, 0.18, 1.85, 0.9, { ...o, seed: o.seed + 200, doorRight: !o.doorRight });
    haystack(s, 1.55, 1.5, 6);
    waterJar(s, 1.0, 1.35);
    if (level >= 3) for (let u = 0.1; u < 1.9; u += 0.12) line(s.g, s.p(u, 1.95), s.p(u, 1.95, 4), hex(WOOD_DARK), 1);
    tree(s, 0.3, 0.3, 6, 7);
  } else {
    // nhà chính dài + nhà ngang, sân gạch, tường bao, cổng, cây, (ao ở bậc 9)
    yardWall(s, [0.06, 0.06], [1.94, 0.06]); yardWall(s, [0.06, 0.06], [0.06, 1.94]);
    tree(s, 0.3, 0.35, 7, 8);
    homestead(s, 0.25, 0.3, 1.85, 1.0, { ...o, bays: level >= 7 ? 5 : 3, seed: o.seed + 100 });
    homestead(s, 0.2, 1.15, 0.8, 1.8, { ...o, bays: 1, storeys: 1, wallH: Math.min(o.wallH, 11), ridge: 20, seed: o.seed + 200, ornament: false });
    if (level === 9) pond(s, 1.5, 1.5, 0.3, 0.3); else waterJar(s, 1.0, 1.3);
    yardWall(s, [0.06, 1.94], [1.94, 1.94]); yardWall(s, [1.94, 0.06], [1.94, 1.94]);
    gate(s, 1.4, 1.94, 0.16, 11);
  }
  return s.c;
}

/** Phủ đệ 3×3 (bậc 10): nhà chính hai tầng, hai nhà ngang, tường bao, cổng tam quan, vườn, ao. */
export function house3(): Canvas {
  const o = LEVEL[10];
  const s = scene(3, 70);
  earthFloor(s, 0, 0, 3, 3, 77);
  yardWall(s, [0.06, 0.06], [2.94, 0.06], 7); yardWall(s, [0.06, 0.06], [0.06, 2.94], 7);
  tree(s, 0.35, 0.4, 7, 8); tree(s, 2.65, 0.4, 7, 8);
  homestead(s, 0.6, 0.3, 2.5, 1.1, { ...o, bays: 5, seed: 300 });
  homestead(s, 0.2, 1.3, 0.85, 2.3, { ...o, bays: 1, storeys: 1, wallH: 12, ridge: 24, seed: 310, ornament: false });
  homestead(s, 2.2, 1.3, 2.85, 2.3, { ...o, bays: 1, storeys: 1, wallH: 12, ridge: 24, seed: 320, ornament: false, doorRight: true });
  pond(s, 1.5, 1.75, 0.4, 0.4);
  // sân lát gạch quanh ao
  polyUV(s, [[1.0, 2.35, 0.5], [2.0, 2.35, 0.5], [2.0, 2.9, 0.5], [1.0, 2.9, 0.5]], hex(0xa08060));
  yardWall(s, [0.06, 2.94], [2.94, 2.94], 7); yardWall(s, [2.94, 0.06], [2.94, 2.94], 7);
  gate(s, 1.5, 2.94, 0.3, 14);
  gate(s, 1.5, 2.94, 0.5, 11);
  return s.c;
}

export function houseLevelFrames(): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (let l = 2; l <= 10; l++) out[`houses/house_l${l}.png`] = house1(l);
  for (let l = 2; l <= 9; l++) out[`houses/house2_l${l}.png`] = house2(l);
  out['houses/house3_l10.png'] = house3();
  return out;
}
