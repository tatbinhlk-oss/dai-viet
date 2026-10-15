// Thư viện vẽ hình thật bằng canvas (Node, @napi-rs/canvas) cho scripts/gen-art.ts — isometric 2:1, ô 64×32, neo (0.5, 1).
// Mọi hình vẽ theo tọa độ ô (u, v) ∈ [0, N] trên móng N×N và cao z (px): x = W/2 + (u − v)·32, y = (H − N·32) + (u + v)·16 − z.
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

export const TILE_W = 64, TILE_H = 32, HALF_W = 32, HALF_H = 16;

export type Canvas = ReturnType<typeof createCanvas>;
export type Ctx = SKRSContext2D;

/** Mật độ điểm ảnh của hình: ảnh xuất ra to gấp ART_SCALE lần, render hiện ở cỡ 1× (sheet ghi `scale`, Pixi đặt resolution). */
export const ART_SCALE = 2;
/** Canvas w×h đơn vị 1× nhưng điểm ảnh gấp ART_SCALE; mọi lệnh vẽ vẫn theo tọa độ 1× (được phép dùng số lẻ, nét 0,5 px). */
export function canvas(w: number, h: number): Canvas {
  const c = createCanvas(w * ART_SCALE, h * ART_SCALE);
  c.getContext('2d').scale(ART_SCALE, ART_SCALE);
  return c;
}

/** RNG xác định (mulberry32) để nét rơm / vân gỗ giống nhau mỗi lần sinh. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Scene { c: Canvas; g: Ctx; n: number; W: number; H: number; /** (u, v, z) → [x, y] */ p: (u: number, v: number, z?: number) => [number, number] }

/** Ảnh cho móng N×N với phần nhô lên `extra` px trên đỉnh hình thoi. */
export function scene(n: number, extra: number): Scene {
  const W = n * TILE_W, H = n * TILE_H + extra;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const p = (u: number, v: number, z = 0): [number, number] => [W / 2 + (u - v) * HALF_W, H - n * TILE_H + (u + v) * HALF_H - z];
  return { c, g, n, W, H, p };
}

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
/** Trộn hai màu 0xRRGGBB theo t ∈ [0, 1]. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
export const darken = (c: number, t: number): number => mix(c, 0x000000, t);
export const lighten = (c: number, t: number): number => mix(c, 0xffffff, t);

/** Đa giác theo danh sách điểm màn hình. */
export function poly(g: Ctx, pts: [number, number][], fill: string, stroke?: string, lw = 1): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

/** Đa giác theo tọa độ ô (u, v, z). */
export const polyUV = (s: Scene, pts: [number, number, number][], fill: string, stroke?: string, lw = 1): void => poly(s.g, pts.map(([u, v, z]) => s.p(u, v, z)), fill, stroke, lw);

export function line(g: Ctx, a: [number, number], b: [number, number], color: string, lw = 1): void {
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = color; g.lineWidth = lw; g.stroke();
}

/** Vẽ trong vùng cắt là đa giác (dùng cho vân rơm / vân gỗ không tràn ra ngoài mặt). */
export function clipped(g: Ctx, pts: [number, number][], draw: () => void): void {
  g.save();
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.clip();
  draw();
  g.restore();
}

/** Bóng đổ mềm hình elip dưới chân công trình (vẽ trước). */
export function shadow(s: Scene, u: number, v: number, ru: number, rv: number, alpha = 0.25): void {
  const [cx, cy] = s.p(u, v);
  s.g.save();
  s.g.fillStyle = `rgba(20,16,8,${alpha})`;
  s.g.beginPath();
  s.g.ellipse(cx, cy, ru * HALF_W, rv * HALF_H, 0, 0, Math.PI * 2);
  s.g.fill();
  s.g.restore();
}
