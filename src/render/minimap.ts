// QoL: bản đồ thu nhỏ vẽ trong Pixi (sprite HUD từ một canvas 2D 160×160, 1 px một ô) — không dùng phần tử DOM đè lên canvas WebGL
// vì trình ghép lớp có thể bỏ vẽ vùng bị đè. Trục x sang phải, y xuống (không xoay isometric để dễ đọc).
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

export class Minimap {
  readonly node = new Container();
  readonly size = GRID_SIZE;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly texture: Texture;
  private readonly sprite: Sprite;
  private readonly frame = new Graphics();
  private readonly border = new Graphics();
  private hash = 0;
  private scale = 1;

  constructor() {
    this.canvas.width = GRID_SIZE; this.canvas.height = GRID_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(GRID_SIZE, GRID_SIZE);
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.sprite = new Sprite(this.texture);
    this.node.addChild(this.border, this.sprite, this.frame);
    this.node.eventMode = 'none';
  }

  /** Đặt góc dưới-phải của HUD theo cỡ màn hình; màn hẹp thu nhỏ còn 96 px. */
  layout(screenW: number, screenH: number): void {
    const px = screenW <= 700 || screenH <= 520 ? 96 : 160;
    this.scale = px / GRID_SIZE;
    this.sprite.scale.set(this.scale);
    this.node.position.set(screenW - px - 10, screenH - px - 28);
    this.border.clear().rect(-1, -1, px + 2, px + 2).stroke({ color: 0x7a6540, width: 1 });
  }
  /** Ô dưới điểm màn hình (sx, sy) nếu nằm trong bản đồ thu nhỏ; null nếu ngoài. */
  hit(sx: number, sy: number): { x: number; y: number } | null {
    if (!this.node.visible) return null;
    const lx = (sx - this.node.position.x) / this.scale, ly = (sy - this.node.position.y) / this.scale;
    if (lx < 0 || ly < 0 || lx >= GRID_SIZE || ly >= GRID_SIZE) return null;
    return { x: Math.floor(lx), y: Math.floor(ly) };
  }
  /** Vẽ lại nền khi lưới đổi (băm nhanh) và khung vùng đang nhìn. */
  update(tiles: { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array }, corners: [number, number][]): void {
    let h = 7;
    for (let i = 0; i < tiles.terrain.length; i += 7) h = (Math.imul(h, 31) + tiles.terrain[i] + tiles.bType[i] * 131) | 0;
    if (h !== this.hash) {
      this.hash = h;
      const d = this.img.data;
      for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const [r, g, b] = tileRgb(tiles.terrain[i], tiles.elevation[i], tiles.bType[i]);
        const k = i * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      }
      this.ctx.putImageData(this.img, 0, 0);
      this.texture.source.update();
    }
    this.frame.clear();
    const pts = corners.flatMap(([x, y]) => [(x + 0.5) * this.scale, (y + 0.5) * this.scale]);
    this.frame.poly(pts).stroke({ color: 0xfff6e0, width: 1 });
  }
}
