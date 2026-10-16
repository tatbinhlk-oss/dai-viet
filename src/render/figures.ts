// Walker: Sprite từ sheet figures (4 hướng × 4 khung đi bộ; xe bò / phu kho / thuyền có bản đầy với kiện hàng tô màu theo loại),
// vị trí nội suy giữa ô hiện tại và ô kế theo progress/15, làm mượt giữa hai snapshot. zIndex = (x + y) × 8 + 3 chung với công trình.
// Thiếu frame thì vẽ hình đơn giản bằng Graphics như trước.
import { Container, Graphics, Sprite } from 'pixi.js';
import { FIG_FIGHTING, FIG_STRIDE } from '../sim';
import { FigureType, TICKS_PER_TILE } from '../sim/state';
import { HALF_H, LAYER_FIGURE, tileToWorld, zIndexOf } from './iso';
import { FIG_COLOR, RES_COLOR } from './palette';
import { frameOf, type Sheets } from './sheets';

const isCarrier = (t: number) => t === FigureType.CartPusher || t === FigureType.Warehouseman || t === FigureType.Boat || t === FigureType.Convoy || t === FigureType.Caravan || t === FigureType.TradeShip;
const DIRS = ['ne', 'se', 'sw', 'nw'];
const FIG_KEYS: string[] = [];
for (const name of Object.keys(FigureType)) { const v = FigureType[name as keyof typeof FigureType]; if (typeof v === 'number') FIG_KEYS[v] = name[0].toLowerCase() + name.slice(1); }
const RES_KEYS = ['none', 'rice', 'fish', 'veg', 'pork', 'clay', 'pottery', 'salt', 'cotton', 'cloth', 'teaLeaf', 'tea', 'cocoon', 'silk', 'copperOre', 'bronze', 'ironOre', 'weapons', 'timber'];

/** Hướng đi từ (x, y) tới (nx, ny): +x = đông nam, +y = tây nam, −x = tây bắc, −y = đông bắc. */
function dirOf(dx: number, dy: number, prev: number): number {
  if (dx > 0) return 1; if (dy > 0) return 2; if (dx < 0) return 3; if (dy < 0) return 0;
  return prev;
}

interface Slot { node: Container; sprite: Sprite | null; cargo: Sprite | null; fallback: Graphics | null; key: string; dir: number }

export class FigureLayer {
  private pool: Slot[] = [];
  private target = new Float32Array(0); // [x, y] × n (pixel thế giới)
  private shown = new Float32Array(0);
  private z = new Int32Array(0);
  private count = 0;

  constructor(private readonly sheets: Sheets, private readonly objects: Container) {}

  setSnapshot(figs: Int16Array): void {
    const n = figs.length / FIG_STRIDE;
    if (this.target.length < n * 2) {
      const t = new Float32Array(n * 2), s = new Float32Array(n * 2), z = new Int32Array(n);
      t.set(this.target); s.set(this.shown); z.set(this.z);
      this.target = t; this.shown = s; this.z = z;
    }
    while (this.pool.length < n) {
      const node = new Container();
      this.objects.addChild(node);
      this.pool.push({ node, sprite: null, cargo: null, fallback: null, key: '', dir: 1 });
    }
    for (let i = 0; i < n; i++) {
      const k = i * FIG_STRIDE;
      const x = figs[k], y = figs[k + 1], nx = figs[k + 2], ny = figs[k + 3], progress = figs[k + 4], type = figs[k + 5], res = figs[k + 6], variant = figs[k + 7];
      const a = tileToWorld(x, y), b = tileToWorld(nx, ny);
      const p = progress / TICKS_PER_TILE;
      const wx = a.wx + (b.wx - a.wx) * p, wy = a.wy + (b.wy - a.wy) * p + HALF_H;
      if (i >= this.count || Math.hypot(this.shown[i * 2] - wx, this.shown[i * 2 + 1] - wy) > 96) { this.shown[i * 2] = wx; this.shown[i * 2 + 1] = wy; }
      this.target[i * 2] = wx; this.target[i * 2 + 1] = wy;
      this.z[i] = zIndexOf(x, y, LAYER_FIGURE);
      const slot = this.pool[i];
      slot.dir = dirOf(nx - x, ny - y, slot.dir);
      const frame = Math.floor(p * 4) % 4;
      const full = isCarrier(type) && res > 0;
      // M8: biến thể hình (giặc theo nguồn, loại xác) và khung đánh nhau (`_fight`, thiếu thì dùng khung đi)
      const v = variant & 15, fighting = (variant & FIG_FIGHTING) !== 0;
      const base = `${FIG_KEYS[type] ?? 'none'}${v ? `_v${v}` : ''}${full ? '_full' : ''}`;
      const fightKey = fighting ? `${base}_fight_${DIRS[slot.dir]}_${frame}` : '';
      const key = fightKey && frameOf(this.sheets.figures, fightKey) ? fightKey : `${base}_${DIRS[slot.dir]}_${frame}`;
      const cargoKey = full || (type === FigureType.Enemy && res > 0) ? `cargo_${RES_KEYS[res] ?? 'none'}` : ''; // giặc vác kiện vừa cướp
      if (slot.key !== key + '|' + cargoKey) { slot.key = key + '|' + cargoKey; this.restyle(slot, type, key, cargoKey, res); }
      slot.node.alpha = type === FigureType.Corpse ? 1 - p * 0.9 : 1; // xác mờ dần
    }
    for (let i = 0; i < this.pool.length; i++) this.pool[i].node.visible = i < n;
    this.count = n;
  }

  private restyle(slot: Slot, type: number, key: string, cargoKey: string, res: number): void {
    const tex = frameOf(this.sheets.figures, key);
    if (tex) {
      if (!slot.sprite) { slot.sprite = new Sprite(); slot.sprite.anchor.set(0.5, 1); slot.node.addChild(slot.sprite); }
      // hình xác / voi không có đủ biến thể thì frameOf đã trả null → xuống dự phòng; ở đây có frame
      slot.sprite.texture = tex;
      slot.sprite.visible = true;
      if (slot.fallback) slot.fallback.visible = false;
      const ctex = cargoKey ? frameOf(this.sheets.figures, cargoKey) : null;
      if (ctex) {
        if (!slot.cargo) { slot.cargo = new Sprite(); slot.cargo.anchor.set(0.5, 1); slot.node.addChild(slot.cargo); }
        slot.cargo.texture = ctex;
        slot.cargo.position.set(0, type === FigureType.Boat || type === FigureType.TradeShip ? -12 : -10);
        slot.cargo.visible = true;
      } else if (slot.cargo) slot.cargo.visible = false;
      return;
    }
    // dự phòng: hình đơn giản như placeholder cũ
    if (!slot.fallback) { slot.fallback = new Graphics(); slot.node.addChild(slot.fallback); }
    if (slot.sprite) slot.sprite.visible = false;
    if (slot.cargo) slot.cargo.visible = false;
    const g = slot.fallback;
    g.visible = true;
    g.clear();
    const color = FIG_COLOR[type] ?? 0xffffff;
    if (isCarrier(type)) {
      g.rect(-7, -10, 14, 8).fill(color);
      if (res) g.rect(-5, -14, 10, 5).fill(RES_COLOR[res] ?? 0xffffff);
    } else if (type === FigureType.Elephant) {
      g.ellipse(0, -10, 12, 7).fill(color).rect(-10, -6, 3, 6).fill(0x3a3a3a).rect(7, -6, 3, 6).fill(0x3a3a3a);
    } else if (type === FigureType.Corpse) {
      g.ellipse(0, -2, 8, 3).fill(color);
    } else {
      g.circle(0, -6, 4).fill(color).rect(-2, -3, 4, 6).fill(0x2a2a2a);
    }
  }

  /** Mỗi frame: trượt vị trí hiển thị về vị trí mục tiêu. */
  update(): void {
    for (let i = 0; i < this.count; i++) {
      const sx = this.shown[i * 2] += (this.target[i * 2] - this.shown[i * 2]) * 0.5;
      const sy = this.shown[i * 2 + 1] += (this.target[i * 2 + 1] - this.shown[i * 2 + 1]) * 0.5;
      const node = this.pool[i].node;
      node.position.set(Math.round(sx), Math.round(sy));
      node.zIndex = this.z[i];
    }
  }
}
