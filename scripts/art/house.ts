// Nhà ở — bậc 0 (lều trống chờ dân) và bậc 1 (lều tranh): nền đất nện, vách phên tre, mái rơm hai mái, cửa liếp.
// Mỗi hình vẽ theo tọa độ ô (u, v) trên móng, cao z px; xem lib.ts.
import { clipped, darken, hex, HALF_H, HALF_W, lighten, line, mix, poly, polyUV, rng, scene, shadow, type Canvas, type Scene } from './lib';

// bảng màu lều
const EARTH = 0x8a7046, EARTH_DARK = 0x6e5838, STRAW = 0xc9a85c, STRAW_LIGHT = 0xe0c070, STRAW_DARK = 0x9a7a38;
const BAMBOO = 0xb8a060, BAMBOO_DARK = 0x7a6436, WATTLE = 0xa88a52, WATTLE_DARK = 0x6a5430, DOOR = 0x3a2a18;

/** Nền đất nện (hình thoi hơi nhỏ hơn móng) với vài hòn sỏi. */
export function earthFloor(s: Scene, u0: number, v0: number, u1: number, v1: number, seed: number): void {
  polyUV(s, [[u0, v0, 0], [u1, v0, 0], [u1, v1, 0], [u0, v1, 0]], hex(EARTH));
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    const [x, y] = s.p(u0 + (u1 - u0) * r(), v0 + (v1 - v0) * r());
    s.g.fillStyle = hex(i % 2 ? EARTH_DARK : lighten(EARTH, 0.25));
    s.g.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
}

/** Mái rơm một mặt: tứ giác ridge(a→b) tới eave(c→d) theo (u, v, z), tô nền rồi vân rơm theo chiều dốc. */
function thatchPlane(s: Scene, ridgeA: [number, number, number], ridgeB: [number, number, number], eaveB: [number, number, number], eaveA: [number, number, number], base: number, seed: number): void {
  const pts = [ridgeA, ridgeB, eaveB, eaveA].map(([u, v, z]) => s.p(u, v, z));
  poly(s.g, pts, hex(base));
  const r = rng(seed);
  const lerp = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  clipped(s.g, pts, () => {
    // lớp rơm: các hàng chồng lên nhau từ nóc xuống giọt tranh, mỗi hàng một vệt tối mảnh; trên đó rải sợi rơm ngắn theo chiều dốc
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      line(s.g, s.p(...lerp(ridgeA, eaveA, t)), s.p(...lerp(ridgeB, eaveB, t)), `rgba(70,50,15,${0.22 + k * 0.04})`, 1);
    }
    const n = 140;
    for (let i = 0; i < n; i++) {
      const a = r(), t = r();
      const top = lerp(ridgeA, ridgeB, a), bot = lerp(eaveA, eaveB, a);
      const p0 = lerp(top, bot, t), p1 = lerp(top, bot, Math.min(1, t + 0.05 + r() * 0.08));
      const shade = r();
      const col = shade < 0.3 ? darken(base, 0.12 + r() * 0.1) : shade > 0.7 ? lighten(base, 0.14 + r() * 0.1) : mix(base, STRAW_DARK, 0.15);
      line(s.g, s.p(...p0), s.p(...p1), hex(col), 1);
    }
    // sáng ở gần nóc, tối dần về giọt tranh
    const g0 = s.p(...ridgeA), g1 = s.p(...eaveA);
    const grad = s.g.createLinearGradient(g0[0], g0[1], g0[0], g1[1]);
    grad.addColorStop(0, 'rgba(255,240,180,0.18)'); grad.addColorStop(1, 'rgba(60,40,10,0.22)');
    s.g.fillStyle = grad; s.g.fillRect(0, 0, s.W, s.H);
    const e0 = s.p(...eaveA), e1 = s.p(...eaveB);
    s.g.strokeStyle = 'rgba(60,40,10,0.6)'; s.g.lineWidth = 1.5;
    s.g.beginPath(); s.g.moveTo(e0[0], e0[1]); s.g.lineTo(e1[0], e1[1]); s.g.stroke();
  });
}

/** Vách phên tre: tứ giác đứng, tô nền rồi kẻ nan đứng + hai thanh ngang. */
function wattleWall(s: Scene, a: [number, number], b: [number, number], h: number, base: number, seed: number): void {
  const pts: [number, number][] = [s.p(a[0], a[1], 0), s.p(b[0], b[1], 0), s.p(b[0], b[1], h), s.p(a[0], a[1], h)];
  poly(s.g, pts, hex(base));
  const r = rng(seed);
  clipped(s.g, pts, () => {
    const [x0, y0] = s.p(a[0], a[1], 0), [x1, y1] = s.p(b[0], b[1], 0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 2; d < len; d += 2.5 + r()) {
      const t = d / len, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      line(s.g, [x, y], [x, y - h], hex(r() < 0.5 ? darken(base, 0.22) : lighten(base, 0.12)), 1);
    }
    for (const z of [h * 0.35, h * 0.7]) line(s.g, s.p(a[0], a[1], z), s.p(b[0], b[1], z), hex(darken(base, 0.35)), 1);
  });
}

export interface HutOpts { /** mái cao (px) */ ridge?: number; /** tường cao (px) */ wall?: number; /** cửa ở mặt phải (u = u1) hay mặt trái (v = v1) */ doorRight?: boolean; seed: number }

/** Lều tranh trên vùng [u0, u1] × [v0, v1], nóc chạy dọc trục u. */
export function hut(s: Scene, u0: number, v0: number, u1: number, v1: number, o: HutOpts): void {
  const wall = o.wall ?? 9, ridge = o.ridge ?? 19, ov = 0.14, vm = (v0 + v1) / 2;
  const eave = wall - 1;
  shadow(s, (u0 + u1) / 2 + 0.1, (v0 + v1) / 2 + 0.1, (u1 - u0) * 0.75, (v1 - v0) * 0.75, 0.22);
  // vách: mặt trái (v = v1) và mặt phải (u = u1)
  wattleWall(s, [u0, v1], [u1, v1], wall, WATTLE, o.seed + 1);
  wattleWall(s, [u1, v1], [u1, v0], wall, darken(WATTLE, 0.18), o.seed + 2);
  // hồi nhà (tam giác) ở mặt phải u = u1
  polyUV(s, [[u1, v1, wall], [u1, v0, wall], [u1, vm, ridge - 2]], hex(darken(WATTLE, 0.28)));
  line(s.g, s.p(u1, v1, wall), s.p(u1, vm, ridge - 2), hex(BAMBOO_DARK), 1);
  line(s.g, s.p(u1, v0, wall), s.p(u1, vm, ridge - 2), hex(BAMBOO_DARK), 1);
  // cột tre ở góc
  for (const [u, v] of [[u0, v1], [u1, v1], [u1, v0]] as [number, number][]) line(s.g, s.p(u, v, 0), s.p(u, v, wall), hex(BAMBOO_DARK), 1.5);
  // cửa liếp
  if (o.doorRight ?? true) {
    const d0 = vm + 0.14, d1 = vm - 0.14;
    polyUV(s, [[u1, d0, 0], [u1, d1, 0], [u1, d1, wall - 2], [u1, d0, wall - 2]], hex(DOOR));
    for (let z = 1; z < wall - 2; z += 2) line(s.g, s.p(u1, d0, z), s.p(u1, d1, z), 'rgba(200,170,90,0.35)', 1);
    line(s.g, s.p(u1, d0 + 0.03, wall - 2), s.p(u1, d1 - 0.03, wall - 2), hex(BAMBOO), 1.5);
  } else {
    const um = (u0 + u1) / 2, d0 = um - 0.14, d1 = um + 0.14;
    polyUV(s, [[d0, v1, 0], [d1, v1, 0], [d1, v1, wall - 2], [d0, v1, wall - 2]], hex(DOOR));
    for (let z = 1; z < wall - 2; z += 2) line(s.g, s.p(d0, v1, z), s.p(d1, v1, z), 'rgba(200,170,90,0.35)', 1);
    line(s.g, s.p(d0 - 0.03, v1, wall - 2), s.p(d1 + 0.03, v1, wall - 2), hex(BAMBOO), 1.5);
  }
  // mái: mặt sau (hướng lên, sáng) rồi mặt trước (sẫm hơn); nóc chạy dọc u từ u0−ov tới u1+ov ở v = vm
  thatchPlane(s, [u0 - ov, vm, ridge], [u1 + ov, vm, ridge], [u1 + ov, v0 - ov, eave], [u0 - ov, v0 - ov, eave], lighten(STRAW, 0.12), o.seed + 3);
  thatchPlane(s, [u0 - ov, vm, ridge], [u1 + ov, vm, ridge], [u1 + ov, v1 + ov, eave], [u0 - ov, v1 + ov, eave], STRAW, o.seed + 4);
  // nóc: tre buộc
  line(s.g, s.p(u0 - ov, vm, ridge), s.p(u1 + ov, vm, ridge), hex(STRAW_DARK), 2);
  line(s.g, s.p(u0 - ov, vm, ridge + 1), s.p(u1 + ov, vm, ridge + 1), hex(STRAW_LIGHT), 1);
  // vài sợi rơm lòa xòa ở giọt tranh trước
  const r = rng(o.seed + 5);
  for (let i = 0; i < 7; i++) {
    const u = u0 - ov + (u1 - u0 + 2 * ov) * r();
    line(s.g, s.p(u, v1 + ov, eave), s.p(u + 0.02, v1 + ov + 0.04, eave - 2 - r() * 2), hex(STRAW_DARK), 1);
  }
}

/** Chum nước đất nung cạnh cửa. */
export function waterJar(s: Scene, u: number, v: number): void {
  const [x, y] = s.p(u, v);
  const g = s.g;
  g.fillStyle = hex(0x6e4a30);
  g.beginPath(); g.ellipse(x, y - 3, 3.2, 3.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x8a6040);
  g.beginPath(); g.ellipse(x - 1, y - 4, 1.4, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(0x3a3a4a);
  g.beginPath(); g.ellipse(x, y - 6.3, 2, 0.9, 0, 0, Math.PI * 2); g.fill();
}

/** Đống rơm nhỏ. */
export function haystack(s: Scene, u: number, v: number, r0 = 5): void {
  const [x, y] = s.p(u, v);
  const g = s.g, r = rng(Math.round(u * 100 + v * 7));
  g.fillStyle = hex(STRAW_DARK);
  g.beginPath(); g.ellipse(x, y, r0 + 1, (r0 + 1) / 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(STRAW);
  g.beginPath(); g.moveTo(x - r0, y); g.quadraticCurveTo(x, y - r0 * 2.2, x + r0, y); g.closePath(); g.fill();
  for (let i = 0; i < 10; i++) { const a = -r0 + r() * 2 * r0; line(g, [x + a, y - 1], [x + a * 0.6, y - r0 * (0.6 + r() * 1.2)], hex(i % 2 ? STRAW_LIGHT : STRAW_DARK), 1); }
}

/** Hàng rào tre thưa dọc đoạn (u, v) → (u, v) trên mặt đất. */
export function fence(s: Scene, a: [number, number], b: [number, number], h = 5): void {
  const [x0, y0] = s.p(a[0], a[1]), [x1, y1] = s.p(b[0], b[1]);
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / 7));
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; line(s.g, [x, y], [x, y - h], hex(BAMBOO_DARK), 1.5); }
  line(s.g, [x0, y0 - h + 1.5], [x1, y1 - h + 1.5], hex(BAMBOO), 1);
  line(s.g, [x0, y0 - 2], [x1, y1 - 2], hex(BAMBOO), 1);
}

/** Bậc 0: nền chờ dân — đất nện, khung tre dựng dở, cuộn phên, đống rơm. */
export function vacantLot(n: number): Canvas {
  const s = scene(n, 20);
  const seed = 11;
  earthFloor(s, 0, 0, n, n, seed);
  const u0 = 0.25, v0 = 0.3, u1 = n - 0.3, v1 = n - 0.3, h = 12;
  // bốn cột và hai xà
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) line(s.g, s.p(u, v, 0), s.p(u, v, h), hex(BAMBOO_DARK), 1.5);
  line(s.g, s.p(u0, v0, h), s.p(u1, v0, h), hex(BAMBOO), 1.5);
  line(s.g, s.p(u0, v1, h), s.p(u1, v1, h), hex(BAMBOO), 1.5);
  line(s.g, s.p(u0, (v0 + v1) / 2, h + 5), s.p(u1, (v0 + v1) / 2, h + 5), hex(BAMBOO), 1.5);
  line(s.g, s.p(u0, v0, h), s.p(u0, (v0 + v1) / 2, h + 5), hex(BAMBOO_DARK), 1);
  line(s.g, s.p(u1, v0, h), s.p(u1, (v0 + v1) / 2, h + 5), hex(BAMBOO_DARK), 1);
  line(s.g, s.p(u1, v1, h), s.p(u1, (v0 + v1) / 2, h + 5), hex(BAMBOO_DARK), 1);
  // cuộn phên tre và đống rơm chờ lợp
  const [jx, jy] = s.p(n - 0.22, n - 0.55);
  s.g.fillStyle = hex(WATTLE_DARK); s.g.beginPath(); s.g.ellipse(jx, jy - 2, 5, 2.5, 0, 0, Math.PI * 2); s.g.fill();
  s.g.fillStyle = hex(WATTLE); s.g.fillRect(jx - 5, jy - 6, 10, 4);
  s.g.fillStyle = hex(lighten(WATTLE, 0.2)); s.g.beginPath(); s.g.ellipse(jx, jy - 6, 5, 2.5, 0, 0, Math.PI * 2); s.g.fill();
  haystack(s, 0.3, n - 0.25, 4);
  return s.c;
}

/** Bậc 1: lều tranh 1×1. */
export function tent1(): Canvas {
  const s = scene(1, 26);
  earthFloor(s, 0, 0, 1, 1, 3); // nền phủ trọn ô để không lộ nền móng tối của lớp đất
  hut(s, 0.14, 0.16, 0.84, 0.84, { seed: 3 });
  waterJar(s, 0.93, 0.3);
  return s.c;
}

/** Bậc 1 gộp 2×2: hai lều quanh sân đất, đống rơm, rào tre. */
export function tent2(): Canvas {
  const s = scene(2, 28);
  earthFloor(s, 0, 0, 2, 2, 21);
  hut(s, 0.15, 1.1, 0.9, 1.85, { seed: 5, ridge: 20 });
  hut(s, 1.1, 0.18, 1.85, 0.9, { seed: 8, ridge: 18, doorRight: false });
  haystack(s, 1.55, 1.5, 6);
  waterJar(s, 1.0, 1.35);
  fence(s, [0.1, 0.1], [0.95, 0.1]);
  fence(s, [0.1, 0.1], [0.1, 0.95]);
  return s.c;
}

export function houseFrames(): Record<string, Canvas> {
  return { 'houses/house_l0.png': vacantLot(1), 'houses/house_l1.png': tent1(), 'houses/house2_l1.png': tent2() };
}
