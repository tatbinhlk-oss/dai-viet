// Công trình vẽ thật: giếng (1×1), ruộng lúa (2×2), đình làng (2×2), chợ (2×2), vựa thóc (3×3).
// Dùng chung hệ tọa độ ô (u, v, z) của lib.ts và các bộ phận lều (mái rơm, vách phên) của house.ts.
import { clipped, darken, hex, lighten, line, mix, poly, polyUV, rng, scene, shadow, type Canvas, type Scene } from './lib';
import { earthFloor, haystack, thatchPlane, waterJar, wattleWall } from './house';

const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, WOOD_LIGHT = 0xc09060;
const STONE = 0x8a8a84, STONE_DARK = 0x5a5a56, BRICK = 0x9a5a42, BRICK_DARK = 0x6a3a2a;
const TILE = 0x8a4a3a, TILE_DARK = 0x5a2a22, TILE_LIGHT = 0xa86050;
const MUD = 0x7a7a46, RICE = 0x6aa838, RICE_DARK = 0x4a8028, RICE_LIGHT = 0x9ad050, BUND = 0x8a7046;

/** Cột gỗ đứng tại (u, v) cao h. */
const post = (s: Scene, u: number, v: number, h: number, z0 = 0, w = 1.5): void => line(s.g, s.p(u, v, z0), s.p(u, v, z0 + h), hex(WOOD_DARK), w);

/** Vách ván gỗ đứng từ a tới b, cao h, chân ở z0. */
function plankWall(s: Scene, a: [number, number], b: [number, number], h: number, z0: number, base: number, seed: number): void {
  const pts: [number, number][] = [s.p(a[0], a[1], z0), s.p(b[0], b[1], z0), s.p(b[0], b[1], z0 + h), s.p(a[0], a[1], z0 + h)];
  poly(s.g, pts, hex(base));
  const r = rng(seed);
  clipped(s.g, pts, () => {
    for (let z = 2.5; z < h; z += 3) line(s.g, s.p(a[0], a[1], z0 + z), s.p(b[0], b[1], z0 + z), hex(darken(base, 0.3 + r() * 0.1)), 1);
  });
}

/** Mái ngói một mặt (tứ giác ridge a→b, eave b→a): hàng ngói ngang + rãnh dọc; mặt sáng / tối theo `base`. */
function tilePlane(s: Scene, ridgeA: [number, number, number], ridgeB: [number, number, number], eaveB: [number, number, number], eaveA: [number, number, number], base: number): void {
  const pts = [ridgeA, ridgeB, eaveB, eaveA].map(([u, v, z]) => s.p(u, v, z));
  poly(s.g, pts, hex(base));
  const lerp = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  clipped(s.g, pts, () => {
    const rows = 6;
    for (let k = 1; k <= rows; k++) {
      const t = k / rows;
      line(s.g, s.p(...lerp(ridgeA, eaveA, t)), s.p(...lerp(ridgeB, eaveB, t)), hex(darken(base, 0.35)), 1);
      line(s.g, s.p(...lerp(ridgeA, eaveA, t - 0.5 / rows)), s.p(...lerp(ridgeB, eaveB, t - 0.5 / rows)), hex(lighten(base, 0.12)), 1);
    }
    const cols = 10;
    for (let k = 1; k < cols; k++) {
      const t = k / cols;
      line(s.g, s.p(...lerp(ridgeA, ridgeB, t)), s.p(...lerp(eaveA, eaveB, t)), `rgba(40,16,10,0.35)`, 1);
    }
    const e0 = s.p(...eaveA), e1 = s.p(...eaveB);
    line(s.g, e0, e1, hex(TILE_DARK), 1.5);
  });
}

/** Giếng đất: thành giếng đá, khung gỗ, gàu. */
export function well(): Canvas {
  const s = scene(1, 24);
  earthFloor(s, 0, 0, 1, 1, 41);
  shadow(s, 0.55, 0.55, 0.35, 0.35, 0.2);
  const [cx, cy] = s.p(0.5, 0.5);
  const g = s.g, rx = 11, ry = 5.5, h = 6;
  // thành giếng: hình trụ thấp
  g.fillStyle = hex(STONE_DARK); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.fill();
  g.fillStyle = hex(STONE); g.fillRect(cx - rx, cy - h, rx * 2, h);
  g.fillStyle = hex(STONE_DARK); g.fillRect(cx, cy - h, rx, h);
  g.fillStyle = hex(darken(STONE, 0.2)); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.fill();
  g.fillStyle = hex(lighten(STONE, 0.15)); g.beginPath(); g.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x2a3a4a); g.beginPath(); g.ellipse(cx, cy - h, rx - 3, ry - 2, 0, 0, Math.PI * 2); g.fill(); // nước
  g.fillStyle = hex(0x5a7a9a); g.fillRect(cx - 3, cy - h - 1, 3, 1);
  // viền đá
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; line(g, [cx + Math.cos(a) * rx, cy - h + Math.sin(a) * ry], [cx + Math.cos(a) * rx, cy - h + Math.sin(a) * ry + (Math.sin(a) > 0 ? h : 0)], hex(STONE_DARK), 1); }
  // khung gỗ: hai cột + xà + gàu treo
  post(s, 0.25, 0.75, 20); post(s, 0.75, 0.25, 20);
  line(g, s.p(0.25, 0.75, 20), s.p(0.75, 0.25, 20), hex(WOOD), 2);
  line(g, [cx, cy - 20], [cx, cy - 12], hex(0x3a3a3a), 1);
  g.fillStyle = hex(WOOD); g.fillRect(cx - 2, cy - 12, 4, 3);
  return s.c;
}

/** Ruộng lúa 2×2: bùn ướt, bờ ruộng, bốn thửa với hàng lúa xanh. */
export function paddy(): Canvas {
  const s = scene(2, 6);
  const g = s.g;
  polyUV(s, [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], hex(MUD));
  const r = rng(77);
  // ánh nước loang
  for (let i = 0; i < 10; i++) { const [x, y] = s.p(r() * 2, r() * 2); g.fillStyle = 'rgba(160,190,210,0.25)'; g.beginPath(); g.ellipse(x, y, 4 + r() * 6, 1.5 + r(), 0, 0, Math.PI * 2); g.fill(); }
  // hàng lúa: dọc trục u trong mỗi thửa
  for (let v = 0.18; v < 2; v += 0.22) {
    if (Math.abs(v - 1) < 0.1) continue;
    for (let u = 0.12; u < 2; u += 0.09) {
      if (Math.abs(u - 1) < 0.08) continue;
      const [x, y] = s.p(u, v);
      const h = 3 + Math.floor(r() * 3);
      const col = hex(r() < 0.3 ? RICE_DARK : r() < 0.75 ? RICE : RICE_LIGHT);
      line(g, [x, y], [x - 1, y - h], col, 1); line(g, [x, y], [x + 1, y - h + 1], col, 1);
    }
  }
  // bờ ruộng: viền ngoài + chữ thập trong
  const b = 0.06;
  for (const [a0, a1, b0, b1] of [[0, 0, 2, b], [0, 2 - b, 2, 2], [0, 0, b, 2], [2 - b, 0, 2, 2], [1 - b / 2, 0, 1 + b / 2, 2], [0, 1 - b / 2, 2, 1 + b / 2]]) {
    polyUV(s, [[a0, a1, 2], [b0, a1, 2], [b0, b1, 2], [a0, b1, 2]], hex(BUND));
    polyUV(s, [[a0, b1, 0], [b0, b1, 0], [b0, b1, 2], [a0, b1, 2]], hex(darken(BUND, 0.3)));
  }
  return s.c;
}

/** Đình làng 2×2: nền gạch, cột gỗ, lòng đình tối, mái ngói lớn uốn góc, sân trước có cây đa nhỏ. */
export function dinh(): Canvas {
  const s = scene(2, 52);
  const g = s.g;
  earthFloor(s, 0, 0, 2, 2, 55);
  shadow(s, 1.1, 1.1, 1.0, 1.0, 0.22);
  // nền gạch cao 4 px, u ∈ [0.1, 1.9], v ∈ [0.35, 1.9]
  const u0 = 0.1, v0 = 0.35, u1 = 1.9, v1 = 1.9, pz = 4, wall = 22, ridge = 42, ov = 0.14, vm = (v0 + v1) / 2;
  // cây đa nhỏ ở góc sau: vẽ trước để mái che lên
  { const [tx, ty] = s.p(0.22, 0.14); line(g, [tx, ty], [tx, ty - 7], hex(WOOD_DARK), 1.5); g.fillStyle = hex(0x3f6a2a); g.beginPath(); g.ellipse(tx, ty - 10, 6, 4.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0x5a8a3a); g.beginPath(); g.ellipse(tx - 2, ty - 12, 3, 2, 0, 0, Math.PI * 2); g.fill(); }
  polyUV(s, [[u0, v1, 0], [u1, v1, 0], [u1, v1, pz], [u0, v1, pz]], hex(BRICK));
  polyUV(s, [[u1, v1, 0], [u1, v0, 0], [u1, v0, pz], [u1, v1, pz]], hex(BRICK_DARK));
  polyUV(s, [[u0, v0, pz], [u1, v0, pz], [u1, v1, pz], [u0, v1, pz]], hex(lighten(BRICK, 0.25)));
  line(g, s.p(u0, v1, 2), s.p(u1, v1, 2), hex(BRICK_DARK), 1); line(g, s.p(u1, v1, 2), s.p(u1, v0, 2), hex(darken(BRICK_DARK, 0.3)), 1);
  // lòng đình: hai vách sau tối, hở mặt trước
  const i0 = 0.28, i1 = 1.72, j0 = 0.5, j1 = 1.75;
  polyUV(s, [[i0, j0, pz], [i1, j0, pz], [i1, j0, pz + wall], [i0, j0, pz + wall]], hex(0x2a1e14));
  polyUV(s, [[i0, j0, pz], [i0, j1, pz], [i0, j1, pz + wall], [i0, j0, pz + wall]], hex(0x1e160e));
  // bàn thờ / hương án sâu trong
  polyUV(s, [[0.8, 0.62, pz], [1.3, 0.62, pz], [1.3, 0.62, pz + 7], [0.8, 0.62, pz + 7]], hex(0x7a2a2a));
  g.fillStyle = hex(0xd8b040); const [ax, ay] = s.p(1.05, 0.62, pz + 7); g.fillRect(ax - 2, ay - 3, 4, 3);
  // cột gỗ (hàng trước và hông)
  for (const u of [i0, 0.76, 1.24, i1]) post(s, u, j1, wall, pz, 2);
  for (const v of [0.9, 1.3]) post(s, i1, v, wall, pz, 2);
  // mái ngói hai mái, nóc dọc trục u, chìa rộng
  tilePlane(s, [u0 - ov, vm, pz + ridge], [u1 + ov, vm, pz + ridge], [u1 + ov, v0 - ov, pz + wall - 2], [u0 - ov, v0 - ov, pz + wall - 2], TILE_LIGHT);
  tilePlane(s, [u0 - ov, vm, pz + ridge], [u1 + ov, vm, pz + ridge], [u1 + ov, v1 + ov, pz + wall - 2], [u0 - ov, v1 + ov, pz + wall - 2], TILE);
  // hồi mái (tam giác) bên phải
  polyUV(s, [[u1 + ov, v0 - ov, pz + wall - 2], [u1 + ov, v1 + ov, pz + wall - 2], [u1 + ov, vm, pz + ridge]], hex(0x4a3020));
  // nóc: bờ nóc trắng xám, hai đầu đao cong
  line(g, s.p(u0 - ov, vm, pz + ridge), s.p(u1 + ov, vm, pz + ridge), hex(0xd8d0c0), 2);
  for (const [u, dir] of [[u0 - ov, -1], [u1 + ov, 1]] as [number, number][]) {
    const [x, y] = s.p(u, vm, pz + ridge);
    g.strokeStyle = hex(0xd8d0c0); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dir * 3, y - 1, x + dir * 4, y - 5); g.stroke();
  }
  // đầu đao ở 4 góc mái (vuốt cong lên)
  for (const [u, v] of [[u0 - ov, v0 - ov], [u1 + ov, v0 - ov], [u0 - ov, v1 + ov], [u1 + ov, v1 + ov]] as [number, number][]) {
    const [x, y] = s.p(u, v, pz + wall - 2);
    const dx = u > 1 ? 1 : -1;
    g.strokeStyle = hex(TILE_DARK); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - dx * 3, y + 1); g.quadraticCurveTo(x + dx, y + 1, x + dx * 2, y - 3); g.stroke();
  }
  waterJar(s, 1.85, 1.95);
  return s.c;
}

/** Chợ 2×2: sân đất, ba lều quán lợp rơm trên cột, thúng hàng nhiều màu, cột phướn. */
export function market(): Canvas {
  const s = scene(2, 30);
  const g = s.g;
  earthFloor(s, 0, 0, 2, 2, 23);
  const stall = (u0: number, v0: number, u1: number, v1: number, seed: number) => {
    const h = 11, vm = (v0 + v1) / 2;
    shadow(s, (u0 + u1) / 2 + 0.05, vm + 0.05, (u1 - u0) * 0.6, (v1 - v0) * 0.6, 0.18);
    // hàng hóa trên sạp
    polyUV(s, [[u0 + 0.05, v0 + 0.05, 3], [u1 - 0.05, v0 + 0.05, 3], [u1 - 0.05, v1 - 0.05, 3], [u0 + 0.05, v1 - 0.05, 3]], hex(WOOD));
    const r = rng(seed);
    const cols = [0xe8e0c0, 0x60b040, 0xd08060, 0xc07040, 0x6080c0, 0xf0f0f0];
    for (let i = 0; i < 5; i++) { const [x, y] = s.p(u0 + 0.12 + (u1 - u0 - 0.24) * r(), v0 + 0.12 + (v1 - v0 - 0.24) * r(), 3); g.fillStyle = hex(cols[Math.floor(r() * cols.length)]); g.beginPath(); g.ellipse(x, y - 2, 3, 2, 0, 0, Math.PI * 2); g.fill(); }
    for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) post(s, u, v, h);
    thatchPlane(s, [u0 - 0.08, vm, h + 5], [u1 + 0.08, vm, h + 5], [u1 + 0.08, v0 - 0.1, h - 1], [u0 - 0.08, v0 - 0.1, h - 1], lighten(0xc9a85c, 0.12), seed + 1);
    thatchPlane(s, [u0 - 0.08, vm, h + 5], [u1 + 0.08, vm, h + 5], [u1 + 0.08, v1 + 0.1, h - 1], [u0 - 0.08, v1 + 0.1, h - 1], 0xc9a85c, seed + 2);
  };
  stall(0.15, 0.15, 0.95, 0.85, 31);
  stall(1.1, 0.2, 1.85, 0.9, 37);
  stall(0.15, 1.1, 0.9, 1.85, 43);
  // thúng hàng rời ở sân, cột phướn
  const r = rng(47);
  for (let i = 0; i < 4; i++) { const [x, y] = s.p(1.15 + 0.6 * r(), 1.15 + 0.6 * r()); g.fillStyle = hex(0xb89a5a); g.beginPath(); g.ellipse(x, y - 1, 4, 2.2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(i % 2 ? 0xe8e0c0 : 0x60b040); g.beginPath(); g.ellipse(x, y - 2.5, 3, 1.5, 0, 0, Math.PI * 2); g.fill(); }
  const [fx, fy] = s.p(1.92, 1.1);
  line(g, [fx, fy], [fx, fy - 24], hex(WOOD_DARK), 1.5);
  poly(g, [[fx + 1, fy - 24], [fx + 8, fy - 21], [fx + 1, fy - 16]], hex(0xd03030));
  return s.c;
}

/** Vựa thóc 3×3: nhà sàn gỗ trên cột, mái rơm lớn, thang, bao thóc và nong phơi lúa ngoài sân. */
export function granary(): Canvas {
  const s = scene(3, 54);
  const g = s.g;
  earthFloor(s, 0, 0, 3, 3, 61);
  shadow(s, 1.55, 1.45, 1.3, 1.3, 0.22);
  const u0 = 0.3, v0 = 0.25, u1 = 2.7, v1 = 2.2, stilt = 9, wall = 16, ridge = 40, ov = 0.18, vm = (v0 + v1) / 2;
  // cột sàn
  for (const u of [u0, 0.9, 1.5, 2.1, u1]) post(s, u, v1, stilt, 0, 2);
  for (const v of [0.75, 1.25, 1.75]) post(s, u1, v, stilt, 0, 2);
  // sàn + vách ván
  polyUV(s, [[u0, v1, stilt], [u1, v1, stilt], [u1, v1, stilt + 2], [u0, v1, stilt + 2]], hex(WOOD_DARK));
  polyUV(s, [[u1, v1, stilt], [u1, v0, stilt], [u1, v0, stilt + 2], [u1, v1, stilt + 2]], hex(darken(WOOD_DARK, 0.3)));
  plankWall(s, [u0, v1], [u1, v1], wall, stilt + 2, WOOD, 62);
  plankWall(s, [u1, v1], [u1, v0], wall, stilt + 2, darken(WOOD, 0.2), 63);
  // hồi
  polyUV(s, [[u1, v1, stilt + 2 + wall], [u1, v0, stilt + 2 + wall], [u1, vm, stilt + 2 + ridge - 3]], hex(darken(WOOD, 0.35)));
  // cửa sổ nhỏ mặt trước và cửa chính có thang
  polyUV(s, [[1.35, v1, stilt + 8], [1.65, v1, stilt + 8], [1.65, v1, stilt + 14], [1.35, v1, stilt + 14]], hex(0x2a1e14));
  polyUV(s, [[u1, 1.3, stilt + 2], [u1, 0.95, stilt + 2], [u1, 0.95, stilt + 13], [u1, 1.3, stilt + 13]], hex(0x2a1e14));
  const la = s.p(u1 + 0.35, 1.12, 0), lb = s.p(u1, 1.12, stilt + 2);
  line(g, la, lb, hex(WOOD_LIGHT), 1.5); line(g, [la[0] + 3, la[1] - 1], [lb[0] + 3, lb[1] - 1], hex(WOOD_LIGHT), 1.5);
  for (let k = 1; k < 5; k++) { const t = k / 5; line(g, [la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t], [la[0] + (lb[0] - la[0]) * t + 3, la[1] + (lb[1] - la[1]) * t - 1], hex(WOOD_DARK), 1); }
  // mái rơm lớn
  thatchPlane(s, [u0 - ov, vm, stilt + 2 + ridge], [u1 + ov, vm, stilt + 2 + ridge], [u1 + ov, v0 - ov, stilt + 2 + wall - 2], [u0 - ov, v0 - ov, stilt + 2 + wall - 2], lighten(0xc9a85c, 0.12), 64);
  thatchPlane(s, [u0 - ov, vm, stilt + 2 + ridge], [u1 + ov, vm, stilt + 2 + ridge], [u1 + ov, v1 + ov, stilt + 2 + wall - 2], [u0 - ov, v1 + ov, stilt + 2 + wall - 2], 0xc9a85c, 65);
  line(g, s.p(u0 - ov, vm, stilt + 2 + ridge), s.p(u1 + ov, vm, stilt + 2 + ridge), hex(0x9a7a38), 2);
  // sân: nong phơi lúa, bao thóc, đống rơm
  polyUV(s, [[0.1, 2.35, 0], [0.9, 2.35, 0], [0.9, 2.9, 0], [0.1, 2.9, 0]], hex(0xd8b848));
  polyUV(s, [[0.14, 2.39, 1], [0.86, 2.39, 1], [0.86, 2.86, 1], [0.14, 2.86, 1]], hex(0xe8cc60));
  const r = rng(66);
  for (let i = 0; i < 4; i++) { const [x, y] = s.p(1.3 + 0.9 * r(), 2.45 + 0.4 * r()); g.fillStyle = hex(0xd8c8a0); g.beginPath(); g.ellipse(x, y - 2, 4, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(0xb0a080); g.fillRect(x - 1, y - 5, 2, 1); }
  haystack(s, 2.7, 2.6, 5);
  return s.c;
}

export function buildingFrames(): Record<string, Canvas> {
  return { 'buildings/well.png': well(), 'buildings/paddy.png': paddy(), 'buildings/dinh.png': dinh(), 'buildings/market.png': market(), 'buildings/granary.png': granary() };
}
// tránh cảnh báo chưa dùng
void mix; void wattleWall;
