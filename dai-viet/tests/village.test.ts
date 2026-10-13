// Cổng M2: làng tự vận hành — dân đến, ruộng → xe bò → vựa → chợ → nhà, nhà lên bậc.
import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, tick } from '../src/sim';
import { BuildingType, FigureType, Resource, type GameState } from '../src/sim/state';
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY } from '../src/sim/state';
import { gridOffset, T_ROAD } from '../src/sim/map/grid';

const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;

/**
 * Bố cục thử (bản đồ phẳng, sông ở x<4, cửa ngõ ở mép trái):
 *  - trục đường từ cửa ngõ (0,80) sang phải tới x=60, cộng hai đường ngang y=76 và y=84
 *  - 30 nhà dọc hai bên y=77 và y=83, ruộng 2×2 ở phía nam, vựa/chợ/giếng/đình ở giữa
 */
export function buildVillage(s: GameState): void {
  const road = (x: number, y: number) => applyCommand(s, { type: 'build', kind: 'road', x, y });
  for (let x = 4; x <= 60; x++) road(x, 80);
  for (let x = 20; x <= 60; x++) { road(x, 76); road(x, 84); }
  for (let y = 76; y <= 84; y++) { road(20, y); road(40, y); road(60, y); }
  // nhà: hàng y=75 (kề đường 76) và y=85 (kề đường 84), x = 21..59 cách 2, trừ chỗ ngã tư
  let houses = 0;
  for (let x = 22; x <= 58 && houses < 30; x += 2) {
    if (x === 40) continue;
    applyCommand(s, { type: 'build', kind: 'house', x, y: 75 }); houses++;
    if (houses < 30) { applyCommand(s, { type: 'build', kind: 'house', x, y: 85 }); houses++; }
  }
  // giếng kề nhà (phủ 5×5): mỗi 4 ô trên y=74 và y=86
  for (let x = 23; x <= 59; x += 4) { applyCommand(s, { type: 'build', kind: 'well', x, y: 74 }); applyCommand(s, { type: 'build', kind: 'well', x, y: 86 }); }
  // trong lòng khối 77..83: đình (2×2) tại (30,77), chợ (2×2) tại (34,77) và (50,77), vựa (3×3) tại (44,77)
  applyCommand(s, { type: 'build', kind: 'dinh', x: 30, y: 77 });
  applyCommand(s, { type: 'build', kind: 'market', x: 34, y: 77 });
  applyCommand(s, { type: 'build', kind: 'market', x: 50, y: 77 });
  applyCommand(s, { type: 'build', kind: 'granary', x: 44, y: 77 });
  // M3: không có tuần đinh / thợ cả thì nhà cháy và sập
  for (const x of [24, 56]) applyCommand(s, { type: 'build', kind: 'watchPost', x, y: 77 });
  for (const x of [26, 54]) applyCommand(s, { type: 'build', kind: 'builderPost', x, y: 77 });
  // M3: có lao động thì cần đủ việc làm — thêm vườn rau (loại lương thực thứ 2), chợ thứ 3, nha môn
  for (const x of [37, 41, 47]) applyCommand(s, { type: 'build', kind: 'vegGarden', x, y: 77 });
  applyCommand(s, { type: 'build', kind: 'market', x: 21, y: 77 });
  applyCommand(s, { type: 'build', kind: 'yamen', x: 57, y: 77 });
  // ruộng 2×2 kề đường y=84 từ phía nam: y=85..86 chỗ không có nhà → dùng hàng y=81..82 kề đường 84 từ phía bắc
  for (let x = 22; x <= 58; x += 3) {
    if (x >= 39 && x <= 41) continue;
    applyCommand(s, { type: 'build', kind: 'paddy', x, y: 82 });
  }
}

function count(s: GameState, type: BuildingType): number {
  return s.buildings.filter((b) => b.type === type).length;
}

describe('làng M2 (bản đồ phẳng)', () => {
  it('bố cục đặt được và có đủ công trình', () => {
    const s = createSim(1, { flat: true });
    buildVillage(s);
    expect(count(s, BuildingType.House)).toBe(30);
    expect(count(s, BuildingType.Paddy)).toBeGreaterThanOrEqual(8);
    expect(count(s, BuildingType.Granary)).toBe(1);
    expect(count(s, BuildingType.Market)).toBe(3);
    expect(count(s, BuildingType.VegGarden)).toBe(3);
    expect(count(s, BuildingType.Yamen)).toBe(1);
    expect(s.grid.terrain[gridOffset(4, 80)] & T_ROAD).toBeTruthy();
  });

  it('sau 5 năm: ≥300 dân, chuỗi lúa chạy, nhà lên bậc ≥3, không walker kẹt', () => {
    const s = createSim(1, { flat: true });
    buildVillage(s);
    let maxFigures = 0, cartsSeen = 0, tradersSeen = 0;
    const t0 = performance.now();
    for (let i = 0; i < TICKS_PER_YEAR * 5; i++) {
      tick(s);
      if (i % 500 === 0) {
        let n = 0;
        for (const f of s.figures) {
          if (f.type === FigureType.None) continue;
          n++;
          if (f.type === FigureType.CartPusher) cartsSeen++;
          if (f.type === FigureType.MarketTrader) tradersSeen++;
        }
        maxFigures = Math.max(maxFigures, n);
      }
    }
    const ms = performance.now() - t0;
    const houses = s.buildings.filter((b) => b.type === BuildingType.House);
    const avgLevel = houses.reduce((a, b) => a + b.level, 0) / houses.length;
    const granary = s.buildings.find((b) => b.type === BuildingType.Granary)!;
    const fed = houses.filter((h) => h.store[Resource.Rice] > 0).length;
    // eslint-disable-next-line no-console
    console.log({ population: s.population, capacity: s.housingCapacity, avgLevel: avgLevel.toFixed(2), granary: granary.store[Resource.Rice], employed: s.labor.employed, workforce: s.labor.workforce, sentiment: s.sentiment, treasury: s.treasury, fed, maxFigures, cartsSeen, tradersSeen, ms: Math.round(ms) });
    expect(s.population).toBeGreaterThanOrEqual(300);
    expect(cartsSeen).toBeGreaterThan(0);
    expect(tradersSeen).toBeGreaterThan(0);
    expect(avgLevel).toBeGreaterThanOrEqual(3);
    expect(fed).toBeGreaterThanOrEqual(houses.length * 0.8);
    expect(maxFigures).toBeLessThan(200); // không rò rỉ walker
    expect(ms).toBeLessThan(20000);
  });

  it('phá đường giữa chừng không làm crash và walker tự về', () => {
    const s = createSim(2, { flat: true });
    buildVillage(s);
    for (let i = 0; i < TICKS_PER_YEAR; i++) tick(s);
    applyCommand(s, { type: 'raze', x: 40, y: 80 });
    applyCommand(s, { type: 'raze', x: 30, y: 76 });
    for (let i = 0; i < TICKS_PER_YEAR; i++) tick(s);
    let n = 0;
    for (const f of s.figures) if (f.type !== FigureType.None) n++;
    expect(n).toBeLessThan(200);
    expect(s.population).toBeGreaterThan(0);
  });

  it('cùng seed → cùng kết quả (deterministic)', () => {
    const a = createSim(7, { flat: true }), b = createSim(7, { flat: true });
    buildVillage(a); buildVillage(b);
    for (let i = 0; i < TICKS_PER_YEAR; i++) { tick(a); tick(b); }
    expect(a.population).toBe(b.population);
    expect(a.buildings.map((x) => x.level + ':' + x.population + ':' + x.store.join(','))).toEqual(b.buildings.map((x) => x.level + ':' + x.population + ':' + x.store.join(',')));
  });
});
