// Walker: pool Graphics, vị trí nội suy giữa ô hiện tại và ô kế theo progress/15, làm mượt giữa hai snapshot.
import { Container, Graphics } from 'pixi.js';
import { FIG_STRIDE } from '../sim';
import { FigureType, TICKS_PER_TILE } from '../sim/state';
import { HALF_H, tileToWorld } from './iso';

// màu áo theo loại walker (placeholder trước khi có sprite)
const FIG_COLOR: Partial<Record<FigureType, number>> = {
  [FigureType.DinhRoamer]: 0xf0e0a0,
  [FigureType.MarketTrader]: 0xe07050,
  [FigureType.MarketBuyer]: 0xd0a040,
  [FigureType.CartPusher]: 0x6a4a2a,
  [FigureType.Immigrant]: 0x80c0e0,
  [FigureType.Emigrant]: 0x8090a0,
  [FigureType.LaborSeeker]: 0xb0b0b0,
  [FigureType.Monk]: 0xe8a030,
  [FigureType.Teacher]: 0x4a6aa0,
  [FigureType.Healer]: 0x5aa070,
  [FigureType.WellKeeper]: 0x60a0d0,
  [FigureType.Actor]: 0xd04080,
  [FigureType.Watchman]: 0xc03020,
  [FigureType.Builder]: 0x3a5a9a,
  [FigureType.TaxCollector]: 0x202020,
  [FigureType.Warehouseman]: 0x8a6a4a,
  [FigureType.Protester]: 0xe0e040,
  [FigureType.Thief]: 0x402040,
  [FigureType.Rioter]: 0xff2010,
  [FigureType.LevyWorker]: 0xc8a060,
  [FigureType.Boat]: 0x8a6a3a,
};
// màu kiện hàng trên xe bò / quang gánh, theo Resource
const RES_COLOR = [0, 0xf0f0d8, 0x80a8c0, 0x60b040, 0xd08080, 0xa06040, 0xc07040, 0xffffff, 0xf0f0f0, 0x6080c0, 0x4a8a30, 0x8a6a30, 0xf0e8c0, 0xe8c840, 0xb87040, 0xc89040, 0x707078, 0x9090a0, 0x8a5a2a];
const isCarrier = (t: number) => t === FigureType.CartPusher || t === FigureType.Warehouseman || t === FigureType.Boat;

export class FigureLayer {
  readonly container = new Container();
  private pool: Graphics[] = [];
  private target = new Float32Array(0); // [x, y] × n (pixel thế giới)
  private shown = new Float32Array(0);
  private types = new Int16Array(0);
  private res = new Int16Array(0);
  private count = 0;

  setSnapshot(figs: Int16Array): void {
    const n = figs.length / FIG_STRIDE;
    if (this.target.length < n * 2) {
      const t = new Float32Array(n * 2), s = new Float32Array(n * 2);
      t.set(this.target); s.set(this.shown);
      this.target = t; this.shown = s;
      this.types = new Int16Array(n);
      this.res = new Int16Array(n);
    }
    for (let i = 0; i < n; i++) {
      const k = i * FIG_STRIDE;
      const a = tileToWorld(figs[k], figs[k + 1]);
      const b = tileToWorld(figs[k + 2], figs[k + 3]);
      const p = figs[k + 4] / TICKS_PER_TILE;
      const wx = a.wx + (b.wx - a.wx) * p, wy = a.wy + (b.wy - a.wy) * p + HALF_H;
      // figure mới xuất hiện (hoặc đổi slot xa) → không trượt từ vị trí cũ
      if (i >= this.count || Math.hypot(this.shown[i * 2] - wx, this.shown[i * 2 + 1] - wy) > 96) {
        this.shown[i * 2] = wx; this.shown[i * 2 + 1] = wy;
      }
      this.target[i * 2] = wx; this.target[i * 2 + 1] = wy;
      this.types[i] = figs[k + 5];
      this.res[i] = figs[k + 6];
    }
    this.count = n;
    while (this.pool.length < n) {
      const g = new Graphics();
      this.pool.push(g);
      this.container.addChild(g);
    }
    for (let i = 0; i < this.pool.length; i++) {
      const g = this.pool[i];
      g.visible = i < n;
      if (i >= n) continue;
      const key = this.types[i] * 64 + this.res[i]; // vẽ lại khi đổi loại hoặc đổi hàng đang chở
      const gg = g as unknown as { _k?: number };
      if (gg._k === key) continue;
      gg._k = key;
      g.clear();
      const t = this.types[i];
      const color = FIG_COLOR[t as FigureType] ?? 0xffffff;
      if (t === FigureType.Boat) {
        // thuyền nan: thân dài nằm trên mặt nước, kiện hàng ở giữa
        g.poly([-14, -4, -8, -8, 8, -8, 14, -4, 8, 0, -8, 0]).fill(color);
        if (this.res[i]) g.rect(-4, -12, 8, 5).fill(RES_COLOR[this.res[i]] ?? 0xffffff);
      } else if (isCarrier(t)) {
        g.rect(-7, -10, 14, 8).fill(color);
        if (this.res[i]) g.rect(-5, -14, 10, 5).fill(RES_COLOR[this.res[i]] ?? 0xffffff);
      } else if (t === FigureType.LevyWorker) {
        // phu đê: nhóm ba người
        for (const dx of [-6, 0, 6]) g.circle(dx, -6, 3).fill(color).rect(dx - 2, -3, 4, 5).fill(0x3a2a1a);
      } else {
        g.circle(0, -6, 4).fill(color).rect(-2, -3, 4, 6).fill(0x2a2a2a);
        if (t === FigureType.MarketBuyer) g.rect(-7, -8, 3, 3).fill(0xd8c080).rect(4, -8, 3, 3).fill(0xd8c080);
      }
    }
  }

  /** Mỗi frame: trượt vị trí hiển thị về vị trí mục tiêu. */
  update(): void {
    for (let i = 0; i < this.count; i++) {
      const sx = this.shown[i * 2] += (this.target[i * 2] - this.shown[i * 2]) * 0.5;
      const sy = this.shown[i * 2 + 1] += (this.target[i * 2 + 1] - this.shown[i * 2 + 1]) * 0.5;
      const g = this.pool[i];
      g.position.set(Math.round(sx), Math.round(sy));
      g.zIndex = sy;
    }
  }
}
