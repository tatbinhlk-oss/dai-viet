// Khói bay: frame hoạt ảnh riêng `smoke_<key>_<k>` (SMOKE_FRAMES khung lặp) đè lên công trình có ống khói — vị trí miệng ống
// do hàm vẽ lò ghi lại (production.ts → CHIMNEYS, tọa độ so với đáy giữa hình). Mỗi khung: các cụm khói đi lên, nở ra, mờ dần,
// hơi lượn và trôi sang phải; pha lệch nhau theo khung nên lặp liền mạch.
import { canvas, type Canvas } from './lib';

export const SMOKE_FRAMES = 6;
export interface Chimney { dx: number; dy: number; /** kích thước móng để biết cỡ ảnh */ n: number }

export function smokeFrame(chimneys: Chimney[], k: number): Canvas {
  const n = chimneys[0]?.n ?? 2;
  const W = n * 64, H = n * 32 + 90;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const puffs = 6, rise = 40;
  for (const ch of chimneys) {
    const x0 = W / 2 + ch.dx, y0 = H + ch.dy;
    for (let i = 0; i < puffs; i++) {
      const t = ((i / puffs) + k / SMOKE_FRAMES) % 1; // 0 = vừa ra khỏi ống, 1 = tan
      const x = x0 + Math.sin(t * 7 + i * 1.7) * 2.5 + t * 9, y = y0 - 2 - t * rise;
      const r = 2 + t * 5.5, a = 0.5 * (1 - t) * (t < 0.08 ? t / 0.08 : 1);
      g.fillStyle = `rgba(215,212,205,${a.toFixed(3)})`;
      g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(245,245,240,${(a * 0.5).toFixed(3)})`;
      g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}

export function smokeFrames(sources: Record<string, Chimney[]>): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (const [key, chimneys] of Object.entries(sources)) for (let k = 0; k < SMOKE_FRAMES; k++) out[`buildings/smoke_${key}_${k}.png`] = smokeFrame(chimneys, k);
  return out;
}
