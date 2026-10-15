// QoL: bản đồ thu nhỏ vẽ trong Pixi (sprite HUD từ canvas 2D, 2 px một ô theo chiếu isometric giống màn chính: px = x − y, py = (x + y) / 2),
// không dùng phần tử DOM đè lên canvas WebGL vì trình ghép lớp có thể bỏ vẽ vùng bị đè.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GRID_SIZE, T_BUILDING, T_FLOODED, T_FLOODPLAIN, T_RESERVED, T_ROAD, T_WATER } from '../sim/map/grid';
import { BuildingType, isDike, isWall } from '../sim/state';

const GRASS = [[0x6f, 0x8e, 0x3a], [0x6f, 0x8e, 0x3a], [0x7f, 0x9a, 0x44], [0x8a, 0x94, 0x4e], [0x9a, 0x94, 0x60]];
function tileRgb(t: number, e: number, bt: number): [number, number, number] {
  if (t & T_WATER) return [0x3a, 0x6a, 0x9a];
  if (t & T_FLOODED) return [0x5a, 0x86, 0xb0];
  if (bt) {
    if (bt === BuildingType.House) return [0xd8, 0xc8, 0xa0];
    if (isDike(bt as BuildingType)) return [0xb8, 0x9a, 0x5a];
    if (isWall(bt as BuildingType)) return [0x9a, 0x9a, 0x9a];
    return [0xc0, 0x80, 0x50];
  }
  if (t & T_BUILDING) return [0xc0, 0x80, 0x50];
  if (t & T_ROAD) return [0xa0, 0x84, 0x5a];
  if (t & T_RESERVED) return [0x2c, 0x2a, 0x22];
  if (t & T_FLOODPLAIN) return [0x9c, 0x9a, 0x5a];
  const g = GRASS[Math.min(4, e)];
  return [g[0], g[1], g[2]];
}

// ảnh nguồn: rộng 2·N px (x − y + N − 1 ở cột 2 px), cao N px (hàng (x + y) / 2)
const W = GRID_SIZE * 2, H = GRID_SIZE;

export class Minimap {
  readonly node = new Container();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly texture: Texture;
  private readonly sprite: Sprite;
  private readonly frame = new Graphics();
  private readonly border = new Graphics();
  private hash = 0;
  private scale = 0.5;

  constructor() {
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(W, H);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.sprite = new Sprite(this.texture);
    this.node.addChild(this.border, this.sprite, this.frame);
    this.node.eventMode = 'none';
  }

  /** Đặt góc dưới-phải của HUD theo cỡ màn hình; màn hẹp thu nhỏ. */
  layout(screenW: number, screenH: number): void {
    const px = screenW <= 700 || screenH <= 520 ? 128 : 192; // rộng; cao bằng một nửa
    this.scale = px / W;
    this.sprite.scale.set(this.scale);
    this.node.position.set(screenW - px - 10, screenH - px / 2 - 28);
    this.border.clear().rect(-1, -1, px + 2, px / 2 + 2).stroke({ color: 0x7a6540, width: 1 });
  }
  /** Ô dưới điểm màn hình (sx, sy) nếu nằm trong bản đồ thu nhỏ; null nếu ngoài. */
  hit(sx: number, sy: number): { x: number; y: number } | null {
    if (!this.node.visible) return null;
    const lx = (sx - this.node.position.x) / this.scale, ly = (sy - this.node.position.y) / this.scale;
    if (lx < 0 || ly < 0 || lx >= W || ly >= H) return null;
    // px = x − y + N − 1 (cột 2 px), py = (x + y) / 2 → x = (px' + 2py) / 2, y = (2py − px') / 2 với px' = lx/2 − (N − 1)
    const p = lx / 2 - (GRID_SIZE - 1);
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
      for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
        const i = y * GRID_SIZE + x;
        const [r, g, b] = tileRgb(tiles.terrain[i], tiles.elevation[i], tiles.bType[i]);
        const px = (x - y + GRID_SIZE - 1) * 2, py = Math.floor((x + y) / 2);
        // mỗi ô một hình thoi nhỏ: 2 px ngang ở hàng py (ô chẵn/lẻ lệch nhau nửa hàng, vẽ gọn thành 2 px)
        for (let k = 0; k < 2; k++) { const idx = (py * W + px + k) * 4; d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255; }
      }
      this.ctx.putImageData(this.img, 0, 0);
      this.texture.source.update();
    }
    this.frame.clear();
    const pts = corners.flatMap(([x, y]) => [((x - y + GRID_SIZE - 1) * 2 + 1) * this.scale, ((x + y) / 2) * this.scale]);
    this.frame.poly(pts).stroke({ color: 0xfff6e0, width: 1 });
  }
}
