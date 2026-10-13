// Walker: pool Graphics, vị trí nội suy giữa ô hiện tại và ô kế theo progress/15, làm mượt giữa hai snapshot.
import { Container, Graphics } from 'pixi.js';
import { FIG_STRIDE } from '../sim';
import { FigureType, TICKS_PER_TILE } from '../sim/state';
import { HALF_H, tileToWorld } from './iso';

const FIG_COLOR: Record<number, number> = {
  [FigureType.DinhRoamer]: 0xf0e0a0,
  [FigureType.MarketTrader]: 0xe07050,
  [FigureType.MarketBuyer]: 0xd0a040,
  [FigureType.CartPusher]: 0x6a4a2a,
  [FigureType.Immigrant]: 0x80c0e0,
};

export class FigureLayer {
  readonly container = new Container();
  private pool: Graphics[] = [];
  private target = new Float32Array(0); // [x, y] × n (pixel thế giới)
  private shown = new Float32Array(0);
  private types = new Int16Array(0);
  private count = 0;

  setSnapshot(figs: Int16Array): void {
    const n = figs.length / FIG_STRIDE;
    if (this.target.length < n * 2) {
      const t = new Float32Array(n * 2), s = new Float32Array(n * 2);
      t.set(this.target); s.set(this.shown);
      this.target = t; this.shown = s;
      this.types = new Int16Array(n);
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
      if (i < n && (g as unknown as { _t?: number })._t !== this.types[i]) {
        (g as unknown as { _t?: number })._t = this.types[i];
        g.clear();
        const t = this.types[i];
        if (t === FigureType.CartPusher) {
          g.rect(-7, -10, 14, 8).fill(FIG_COLOR[t]).rect(-5, -4, 10, 3).fill(0xd8c080);
        } else {
          g.circle(0, -6, 4).fill(FIG_COLOR[t] ?? 0xffffff).rect(-2, -3, 4, 6).fill(0x2a2a2a);
        }
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
