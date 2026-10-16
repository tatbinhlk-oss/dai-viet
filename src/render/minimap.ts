// QoL: bản đồ thu nhỏ vẽ trong Pixi (sprite HUD từ canvas 2D, 2 px một ô theo chiếu isometric giống màn chính: px = x − y, py = (x + y) / 2),
// không dùng phần tử DOM đè lên canvas WebGL vì trình ghép lớp có thể bỏ vẽ vùng bị đè.
// M7: chỉ phóng to vùng đất đã cấp (không tính ô T_RESERVED) cho vừa khung — đất chưa cấp bao quanh không chiếm chỗ; khung nhìn vẽ dày 2 px.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GRID_SIZE, T_BUILDING, T_FLOODED, T_FLOODPLAIN, T_RESERVED, T_ROAD, T_WATER } from '../sim/map/grid';
import { BuildingType, isDike, isWall } from '../sim/state';

const GRASS = [[0x6f, 0x8e, 0x3a], [0x6f, 0x8e, 0x3a], [0x7f, 0x9a, 0x44], [0x8a, 0x94, 0x4e], [0x9a, 0x94, 0x60]];
function tileRgb(t: number, e: number, bt: number): [number, number, number] {
  if (t & T_WATER) return t & T_ROAD ? [0x9a, 0x7a, 0x4a] : [0x3a, 0x6a, 0x9a]; // M7: cầu
  if (t & T_FLOODED) return [0x5a, 0x86, 0xb0];
  if (bt) {
    if (bt === BuildingType.House) return [0xd8, 0xc8, 0xa0];
    if (isDike(bt as BuildingType)) return [0xb8, 0x9a, 0x5a];
    if (isWall(bt as BuildingType)) return [0x9a, 0x9a, 0x9a];
    return [0xc0, 0x80, 0x50];
  }
  if (t & T_BUILDING) return [0xc0, 0x80, 0x50];
  if (t & T_ROAD) return [0xa0, 0x84, 0x5a];
  if (t & T_RESERVED) return [0x4a, 0x4e, 0x36];
  if (t & T_FLOODPLAIN) return [0x9c, 0x9a, 0x5a];
  const g = GRASS[Math.min(4, e)];
  return [g[0], g[1], g[2]];
}

// ảnh nguồn: rộng 2·N px (ô ở cột px = x − y + N − 1, rộng 2 px), cao N px (hàng py = (x + y) / 2)
const W = GRID_SIZE * 2, H = GRID_SIZE;

export class Minimap {
  readonly node = new Container();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly texture: Texture;
  private readonly sprite: Sprite;
  private readonly frame = new Graphics();
  private readonly markers = new Graphics(); // M8: chấm đỏ nhấp nháy nơi giặc vào
  private markerPts: [number, number][] = [];
  private readonly border = new Graphics();
  private readonly mask = new Graphics();
  private hash = 0;
  /** khung HUD (px màn hình) */
  private box = { w: 192, h: 96 };
  /** ảnh nguồn → HUD: hud = (src − o) · scale */
  private scale = 0.5;
  private ox = 0;
  private oy = 0;
  /** vùng đất đã cấp trong ảnh nguồn (px) */
  private bounds = { x0: 0, y0: 0, x1: W, y1: H };

  constructor() {
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(W, H);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.sprite = new Sprite(this.texture);
    this.node.addChild(this.border, this.sprite, this.frame, this.markers, this.mask);
    this.sprite.mask = this.mask;
    this.frame.mask = this.mask;
    this.markers.mask = this.mask;
    this.node.eventMode = 'none';
  }

  /** Đặt góc dưới-phải của HUD theo cỡ màn hình; màn hẹp thu nhỏ. */
  layout(screenW: number, screenH: number): void {
    const px = screenW <= 700 || screenH <= 520 ? 128 : 208; // rộng; cao bằng 0,6 lần
    this.box = { w: px, h: Math.round(px * 0.6) };
    this.node.position.set(screenW - px - 10, screenH - this.box.h - 28);
    this.border.clear().rect(-1, -1, px + 2, this.box.h + 2).fill({ color: 0x1a1a14 }).stroke({ color: 0x7a6540, width: 1 });
    this.mask.clear().rect(0, 0, px, this.box.h).fill({ color: 0xffffff });
    this.fit();
  }
  /** Phóng vùng đất đã cấp cho vừa khung, căn giữa. */
  private fit(): void {
    const b = this.bounds, bw = Math.max(8, b.x1 - b.x0), bh = Math.max(4, b.y1 - b.y0);
    this.scale = Math.min(this.box.w / bw, this.box.h / bh);
    this.ox = b.x0 - (this.box.w / this.scale - bw) / 2;
    this.oy = b.y0 - (this.box.h / this.scale - bh) / 2;
    this.sprite.scale.set(this.scale);
    this.sprite.position.set(-this.ox * this.scale, -this.oy * this.scale);
  }
  /** Ô dưới điểm màn hình (sx, sy) nếu nằm trong bản đồ thu nhỏ; null nếu ngoài. */
  hit(sx: number, sy: number): { x: number; y: number } | null {
    if (!this.node.visible) return null;
    const hx = sx - this.node.position.x, hy = sy - this.node.position.y;
    if (hx < 0 || hy < 0 || hx >= this.box.w || hy >= this.box.h) return null;
    const lx = hx / this.scale + this.ox, ly = hy / this.scale + this.oy;
    if (lx < 0 || ly < 0 || lx >= W || ly >= H) return null;
    // px = x − y + N − 1, py = (x + y) / 2 → x = (px' + 2py) / 2, y = (2py − px') / 2 với px' = lx − (N − 1)
    const p = lx - (GRID_SIZE - 1);
    const x = Math.floor((p + 2 * ly) / 2), y = Math.floor((2 * ly - p) / 2);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null;
    return { x, y };
  }
  /** Vẽ lại nền khi lưới đổi (băm nhanh) và khung vùng đang nhìn. */
  update(tiles: { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array }, corners: [number, number][]): void {
    let h = 7;
    for (let i = 0; i < tiles.terrain.length; i += 7) h = (Math.imul(h, 31) + tiles.terrain[i] + tiles.bType[i] * 131) | 0;
    if (h !== this.hash) {
      this.hash = h;
      const d = this.img.data;
      d.fill(0);
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
        const i = y * GRID_SIZE + x;
        const t = tiles.terrain[i];
        const [r, g, b] = tileRgb(t, tiles.elevation[i], tiles.bType[i]);
        const px = x - y + GRID_SIZE - 1, py = Math.floor((x + y) / 2);
        if (!(t & T_RESERVED)) { if (px < x0) x0 = px; if (px + 2 > x1) x1 = px + 2; if (py < y0) y0 = py; if (py + 1 > y1) y1 = py + 1; }
        // mỗi ô một hình thoi nhỏ: 2 px ngang ở hàng py (ô chẵn/lẻ lệch nhau nửa hàng, vẽ gọn thành 2 px)
        for (let k = 0; k < 2; k++) { const idx = (py * W + px + k) * 4; d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255; }
      }
      this.ctx.putImageData(this.img, 0, 0);
      this.texture.source.update();
      const m = 6; // lề: thấy một chút đất chưa cấp bao quanh
      const nb = x1 > x0 ? { x0: Math.max(0, x0 - m), y0: Math.max(0, y0 - m / 2), x1: Math.min(W, x1 + m), y1: Math.min(H, y1 + m / 2) } : { x0: 0, y0: 0, x1: W, y1: H };
      if (nb.x0 !== this.bounds.x0 || nb.y0 !== this.bounds.y0 || nb.x1 !== this.bounds.x1 || nb.y1 !== this.bounds.y1) { this.bounds = nb; this.fit(); }
    }
    this.frame.clear();
    const pts = corners.flatMap(([x, y]) => [(x - y + GRID_SIZE - this.ox) * this.scale, ((x + y) / 2 - this.oy) * this.scale]);
    this.frame.poly(pts).stroke({ color: 0xfff6e0, width: 2 });
    this.markers.clear();
    const on = Math.floor(performance.now() / 400) % 2 === 0;
    for (const [x, y] of this.markerPts) {
      const px = (x - y + GRID_SIZE - this.ox) * this.scale, py = ((x + y) / 2 - this.oy) * this.scale;
      this.markers.circle(px, py, on ? 4 : 3).fill({ color: 0xff3020, alpha: 0.95 }).stroke({ color: 0xfff0e0, width: 1 });
    }
  }
  /** M8: ô đánh dấu (mép giặc sắp vào) — vẽ lại ở lần update kế. */
  setMarkers(pts: [number, number][]): void { this.markerPts = pts; }
}
