// Toán isometric 2:1. ĐÂY LÀ NƠI DUY NHẤT ghi kích thước ô — mọi file khác import từ đây.
// Sim không biết pixel; chỉ render mới gọi các hàm này.
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2; // 32
export const HALF_H = TILE_H / 2; // 16

/** Tâm trên của ô (x, y) trong tọa độ thế giới (pixel). screenX = (x − y)·32, screenY = (x + y)·16 */
export function tileToWorld(x: number, y: number): { wx: number; wy: number } {
  return { wx: (x - y) * HALF_W, wy: (x + y) * HALF_H };
}

/** Ngược lại: pixel thế giới → ô (số thực; làm tròn xuống để lấy ô). */
export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
}

/**
 * Điểm neo sprite của công trình N×N tại ô góc (x, y): góc DƯỚI CÙNG của hình thoi móng,
 * tức tâm ô (x+N−1, y+N−1) cộng HALF_H. Sprite dùng anchor (0.5, 1) đặt tại điểm này.
 */
export function buildingAnchor(x: number, y: number, size: number): { wx: number; wy: number } {
  const { wx, wy } = tileToWorld(x + size - 1, y + size - 1);
  return { wx, wy: wy + HALF_H };
}

/** Thứ tự vẽ: zIndex = (x + y) × 8 + layer. Layer: 0 đất, 1 nước/ngập, 2 công trình, 3 walker, 4 overlay. */
export const LAYER_GROUND = 0;
export const LAYER_WATER = 1;
export const LAYER_BUILDING = 2;
export const LAYER_FIGURE = 3;
export const LAYER_OVERLAY = 4;
export function zIndexOf(x: number, y: number, layer: number): number {
  return (x + y) * 8 + layer;
}

/** Mức zoom cho phép, để pixel art không vỡ. */
export const ZOOM_LEVELS = [0.5, 1, 2] as const;
