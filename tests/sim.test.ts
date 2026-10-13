import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, takeSnapshot, tick } from '../src/sim';
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY } from '../src/sim/state';
import { GRID_CELLS, gridOffset, T_FLOODPLAIN, T_ROAD, T_WATER } from '../src/sim/map/grid';
import { buildingAnchor, tileToWorld, worldToTile, zIndexOf, TILE_H, TILE_W } from '../src/render/iso';

describe('sim headless', () => {
  it('chạy 1 năm = 50 × 16 × 12 tick và sang năm 1', () => {
    const s = createSim(1);
    const ticks = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) tick(s);
    const ms = performance.now() - t0;
    expect(s.time).toMatchObject({ tick: 0, day: 0, month: 0, year: 1, totalDays: 192 });
    expect(ms).toBeLessThan(2000);
  });

  it('cùng seed sinh cùng bản đồ (deterministic)', () => {
    const a = createSim(42), b = createSim(42), c = createSim(43);
    expect(a.grid.terrain).toEqual(b.grid.terrain);
    expect(a.grid.terrain).not.toEqual(c.grid.terrain);
  });

  it('bản đồ có sông và vùng ngập hợp lý', () => {
    const s = createSim(7);
    let water = 0, flood = 0;
    for (let i = 0; i < GRID_CELLS; i++) {
      if (s.grid.terrain[i] & T_WATER) water++;
      if (s.grid.terrain[i] & T_FLOODPLAIN) flood++;
    }
    expect(water / GRID_CELLS).toBeGreaterThan(0.02);
    expect(water / GRID_CELLS).toBeLessThan(0.12);
    expect(flood).toBeGreaterThan(water); // bãi bồi rộng hơn lòng sông
  });

  it('lệnh build/raze đi qua applyCommand và ghi dirty', () => {
    const s = createSim(3);
    // tìm ô đất trống
    let x = 0, y = 0;
    outer: for (y = 0; y < 160; y++) for (x = 0; x < 160; x++) if (s.grid.terrain[gridOffset(x, y)] === 0) break outer;
    applyCommand(s, { type: 'build', kind: 'road', x, y });
    expect(s.grid.terrain[gridOffset(x, y)] & T_ROAD).toBeTruthy();
    expect(s.dirty.has(gridOffset(x, y))).toBe(true);
    const snap = takeSnapshot(s, false);
    expect(snap.changed?.offsets.length).toBe(1);
    expect(s.dirty.size).toBe(0);
    applyCommand(s, { type: 'build', kind: 'house', x, y }); // không đặt được lên đường
    expect(s.buildings.length).toBe(1);
    applyCommand(s, { type: 'raze', x, y });
    expect(s.grid.terrain[gridOffset(x, y)] & T_ROAD).toBeFalsy();
    applyCommand(s, { type: 'build', kind: 'house', x, y });
    expect(s.buildings.length).toBe(2);
  });
});

describe('iso 64×32', () => {
  it('hằng số và phép chiếu thuận/nghịch khớp nhau', () => {
    expect([TILE_W, TILE_H]).toEqual([64, 32]);
    for (const [x, y] of [[0, 0], [5, 3], [159, 159], [3, 100]]) {
      const { wx, wy } = tileToWorld(x, y);
      expect(wx).toBe((x - y) * 32);
      expect(wy).toBe((x + y) * 16);
      // điểm ngay dưới đỉnh trên một chút phải rơi vào đúng ô
      expect(worldToTile(wx, wy + 1)).toEqual({ x, y });
    }
  });
  it('điểm neo công trình 2×2 là góc dưới hình thoi ô (x+1, y+1)', () => {
    const a = buildingAnchor(10, 10, 2);
    expect(a).toEqual({ wx: 0, wy: 22 * 16 + 16 });
  });
  it('zIndex tăng theo x+y rồi layer', () => {
    expect(zIndexOf(1, 1, 2)).toBeLessThan(zIndexOf(2, 1, 0));
    expect(zIndexOf(1, 1, 0)).toBeLessThan(zIndexOf(1, 1, 2));
  });
});
