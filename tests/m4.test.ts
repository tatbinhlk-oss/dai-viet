// Kiểm tra từng cơ chế M4 (lũ, đê, phù sa, cống, thuyền nan) trên bản đồ phẳng: sông x<4, bãi bồi x<70 (cao độ 1),
// đất cao x<100 (cao độ 2), núi x≥100 (cao độ 3).
import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, tick } from '../src/sim';
import { BuildingType, FigureType, isDike, LaborCat, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { GRID_CELLS, gridOffset, isRoad, T_BUILDING, T_FLOODED, T_ROAD, T_SUNKEN, T_UNPROTECTED } from '../src/sim/map/grid';
import { findPath, passRoad } from '../src/sim/map/routing';
import { applyFlood, computeFlood } from '../src/sim/flood/floodFill';
import { endOfSeason, paddyYield, updateFloodedBuildings } from '../src/sim/flood/consequences';
import { rollPeak, SEASON_DAYS, waterLevel } from '../src/sim/flood/season';
import { breachDike, updateDikes } from '../src/sim/buildings/dike';
import { chooseCartDestination } from '../src/sim/figures/cartpusher';
import { decayServices } from '../src/sim/buildings/house';
import { updateDesirability } from '../src/sim/map/desirability';
import { legacyDike } from '../src/sim/scenario/demo';
import { flood } from '../src/sim/buildings/defs';
import { roadAccess } from '../src/sim/buildings/spawn';

const build = (s: GameState, kind: string, x: number, y: number): GameState['buildings'][number] => {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind, x, y });
  expect(s.buildings.length, `đặt ${kind} tại ${x},${y}`).toBe(n + 1);
  return s.buildings[n];
};
const roadLine = (s: GameState, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) applyCommand(s, { type: 'build', kind: 'road', x, y }); };
const days = (s: GameState, n: number) => { for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s); };
const flat = () => { const s = createSim(1, { flat: true }); s.treasury = 1e6; return s; };
const dikeAt = (s: GameState, x: number, y: number) => s.buildings[s.grid.buildingId[gridOffset(x, y)]];
const count = (buf: Uint8Array) => { let n = 0; for (let i = 0; i < buf.length; i++) if (buf[i] === 1) n++; return n; };

describe('mùa lũ', () => {
  it('mực nước lên 24 ngày, giữ 16, rút 24; đỉnh quay theo 45/35/15/5', () => {
    expect(SEASON_DAYS).toBe(64);
    for (const peak of [1, 2, 3, 4]) {
      expect(waterLevel(peak, 0)).toBe(1);
      expect(waterLevel(peak, 23)).toBe(peak);
      expect(waterLevel(peak, 30)).toBe(peak);
      expect(waterLevel(peak, 40)).toBe(peak);
      expect(waterLevel(peak, 63)).toBe(0);
      for (let d = 1; d < 24; d++) expect(waterLevel(peak, d)).toBeGreaterThanOrEqual(waterLevel(peak, d - 1));
    }
    expect(waterLevel(4, 6)).toBe(2);
    const s = flat();
    const n = [0, 0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) n[rollPeak(s)]++;
    expect(n[1] / 40).toBeGreaterThan(40); expect(n[1] / 40).toBeLessThan(50);
    expect(n[2] / 40).toBeGreaterThan(30); expect(n[2] / 40).toBeLessThan(40);
    expect(n[3] / 40).toBeGreaterThan(11); expect(n[3] / 40).toBeLessThan(19);
    expect(n[4] / 40).toBeGreaterThan(2); expect(n[4] / 40).toBeLessThan(8);
  });

  it('nha môn báo trước từ tháng 4, lũ về ngày 1 tháng 6, rút hết tháng 9', () => {
    const s = flat();
    roadLine(s, 10, 30, 30);
    const house = build(s, 'house', 12, 31); house.population = 50; house.level = 1;
    const yamen = build(s, 'yamen', 20, 31); yamen.housesCovered = 200;
    days(s, 3 * 16); // tới tháng 4
    expect(s.time.month).toBe(3);
    tick(s);
    days(s, 1);
    expect(s.flood.nextPeak).toBeGreaterThanOrEqual(1);
    expect(s.flood.forecast).toBeGreaterThanOrEqual(1);
    expect(s.events.some((e) => e.startsWith('Nha môn báo'))).toBe(true);
    days(s, 2 * 16); // qua ngày 1 tháng 6
    expect(s.time.month).toBe(5);
    expect(s.flood.dayInSeason).toBeGreaterThanOrEqual(0);
    expect(s.flood.peak).toBeGreaterThanOrEqual(1);
    expect(s.events.some((e) => e.startsWith('Lũ về'))).toBe(true);
    days(s, 64);
    expect(s.flood.dayInSeason).toBe(-1);
    expect(s.flood.level).toBe(0);
    expect(s.time.month).toBe(9);
  });
});

describe('flood-fill và đê', () => {
  it('lan khi cao độ + cao đê < mực lũ; tuyến đê kín chặn, hở một ô thì ngập hết', () => {
    const s = flat();
    const buf = new Uint8Array(GRID_CELLS);
    computeFlood(s.grid, 1, buf); expect(count(buf)).toBe(0); // không có đất cao độ 0
    computeFlood(s.grid, 2, buf); expect(count(buf)).toBe(66 * 160); // cả bãi bồi x=4..69
    computeFlood(s.grid, 3, buf); expect(count(buf)).toBe(96 * 160); // + đất cao
    computeFlood(s.grid, 4, buf); expect(count(buf)).toBe(GRID_CELLS - 4 * 160); // trừ sông
    legacyDike(s, 7, 0, 159, 3); // cao 2 trên cao độ 1 → cao trình 3
    computeFlood(s.grid, 2, buf); expect(count(buf)).toBe(3 * 160); // chỉ dải x=4..6
    computeFlood(s.grid, 3, buf); expect(count(buf)).toBe(3 * 160);
    computeFlood(s.grid, 4, buf); expect(count(buf)).toBe(GRID_CELLS - 4 * 160); // tràn đê
    applyCommand(s, { type: 'raze', x: 7, y: 80 });
    computeFlood(s.grid, 2, buf); expect(count(buf)).toBe(66 * 160 - 159); // hở một ô → ngập cả vùng sau đê (trừ 159 ô đê)
  });

  it('vẽ lại lên đoạn đê = tôn cao (tối đa 4); đường vắt được qua đê; phá đường trước rồi mới phá đê', () => {
    const s = flat();
    const d = build(s, 'dike', 7, 10);
    expect([d.height, d.targetHeight, d.integrity]).toEqual([0, 1, 100]);
    for (let i = 0; i < 5; i++) applyCommand(s, { type: 'build', kind: 'dike', x: 7, y: 10 });
    expect(d.targetHeight).toBe(4);
    expect(s.buildings.length).toBe(2);
    applyCommand(s, { type: 'build', kind: 'road', x: 7, y: 10 });
    const o = gridOffset(7, 10);
    expect(s.grid.terrain[o] & (T_ROAD | T_BUILDING)).toBe(T_ROAD | T_BUILDING);
    expect(isRoad(s.grid, o)).toBe(true);
    applyCommand(s, { type: 'raze', x: 7, y: 10 });
    expect(s.grid.terrain[o] & T_ROAD).toBe(0);
    expect(d.type).toBe(BuildingType.Dike);
    applyCommand(s, { type: 'raze', x: 7, y: 10 });
    expect(d.type).toBe(BuildingType.None);
    expect(s.grid.dike[o]).toBe(0);
  });

  it('cống mở cho nước qua, đóng thì chắn', () => {
    const s = flat();
    legacyDike(s, 7, 0, 159, 3);
    applyCommand(s, { type: 'raze', x: 7, y: 80 });
    const c = build(s, 'sluice', 7, 80);
    c.height = 2; c.targetHeight = 2;
    applyCommand(s, { type: 'openSluice', buildingId: c.id, open: false });
    s.flood.dikesChanged = false;
    // đồng bộ lưới: openSluice chỉ ghi khi đổi trạng thái → mở rồi đóng
    applyCommand(s, { type: 'openSluice', buildingId: c.id, open: true });
    expect(s.grid.dike[gridOffset(7, 80)]).toBe(0);
    const buf = new Uint8Array(GRID_CELLS);
    computeFlood(s.grid, 2, buf); expect(count(buf)).toBe(66 * 160 - 159); // nước qua cống vào trong (159 ô đê còn lại không ngập)
    applyCommand(s, { type: 'openSluice', buildingId: c.id, open: false });
    expect(s.grid.dike[gridOffset(7, 80)]).toBe(2);
    computeFlood(s.grid, 2, buf); expect(count(buf)).toBe(3 * 160);
  });

  it('nước chạm đê mòn (mực − cao + 1) × 2 mỗi ngày; ngoài mùa −1 mỗi 4 ngày; hết bền thì vỡ thành đất trũng', () => {
    const s = flat();
    legacyDike(s, 7, 40, 42, 3);
    const d = dikeAt(s, 7, 41);
    expect(d.height).toBe(2);
    s.grid.terrain[gridOffset(6, 41)] |= T_FLOODED; // nước tới chân đê
    updateDikes(s, 1, true); expect(d.integrity).toBe(100); // mực 1 < cao 2: không mòn
    updateDikes(s, 2, true); expect(d.integrity).toBe(98);
    updateDikes(s, 3, true); expect(d.integrity).toBe(94);
    updateDikes(s, 4, true); expect(d.integrity).toBe(88);
    const e = dikeAt(s, 7, 40);
    s.grid.terrain[gridOffset(6, 40)] &= ~T_FLOODED;
    updateDikes(s, 4, true); expect(e.integrity).toBe(100); // không chạm nước
    s.time.totalDays = 8;
    updateDikes(s, 0, false); expect(e.integrity).toBe(99);
    s.time.totalDays = 9;
    updateDikes(s, 0, false); expect(e.integrity).toBe(99);
    d.integrity = 3;
    updateDikes(s, 3, true);
    expect(d.type).toBe(BuildingType.None);
    const o = gridOffset(7, 41);
    expect(s.grid.terrain[o] & T_SUNKEN).toBeTruthy();
    expect(s.grid.elevation[o]).toBe(0);
    expect(s.grid.dike[o]).toBe(0);
    expect(s.flood.breachesThisYear).toBe(1);
    expect(s.flood.breachMoodPeriods).toBe(flood.consequences.breachMoodPeriods);
    expect(s.events.at(-1)).toContain('Vỡ đê');
  });

  it('thợ cả đi qua đặt độ bền về 100', () => {
    const s = flat();
    legacyDike(s, 7, 40, 60, 3);
    roadLine(s, 8, 8, 40); for (let y = 40; y <= 60; y++) applyCommand(s, { type: 'build', kind: 'road', x: 8, y });
    const house = build(s, 'house', 10, 44); house.population = 20; house.level = 1;
    build(s, 'builderPost', 9, 50);
    applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Engineering, priority: 1 });
    for (let y = 40; y <= 60; y++) dikeAt(s, 7, y).integrity = 50;
    days(s, 40);
    expect(dikeAt(s, 7, 50).integrity).toBeGreaterThanOrEqual(95); // đặt 100 rồi mòn ≤ 1 mỗi 4 ngày
    expect(dikeAt(s, 7, 51).integrity).toBeGreaterThanOrEqual(95);
  });

  it('phu đê từ đình làng tới đắp: mức đầu 30 ngày-người + đào một ô bãi bồi thành đất trũng', () => {
    const s = flat();
    roadLine(s, 10, 30, 30);
    const house = build(s, 'house', 12, 31); house.population = 60; house.level = 1;
    const dinh = build(s, 'dinh', 20, 31); dinh.housesCovered = 200;
    for (let y = 28; y <= 31; y++) build(s, 'dike', 7, y);
    days(s, 2);
    expect(dinh.numWorkers).toBeGreaterThan(0);
    days(s, 6);
    const gang = s.figures.find((f) => f.type === FigureType.LevyWorker);
    expect(gang).toBeDefined();
    expect(gang!.loads).toBe(flood.dike.gangSize);
    // 4 đoạn × 30 ngày-người / 20 người = 6 ngày đắp + đi lại
    days(s, 20);
    for (let y = 28; y <= 31; y++) expect(dikeAt(s, 7, y).height, `đoạn ${y}`).toBe(1);
    let sunken = 0;
    for (let o = 0; o < GRID_CELLS; o++) if (s.grid.terrain[o] & T_SUNKEN) sunken++;
    expect(sunken).toBe(4);
    expect(s.grid.dike[gridOffset(7, 30)]).toBe(1);
    days(s, 20);
    expect(s.figures.some((f) => f.type === FigureType.LevyWorker)).toBe(false); // hết việc, về đình
    expect(dinh.figureId2).toBe(0);
  });
});

describe('hậu quả ngập', () => {
  function floodTiles(s: GameState, b: { x: number; y: number; size: number }): void {
    for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) s.grid.terrain[gridOffset(b.x + dx, b.y + dy)] |= T_FLOODED;
  }
  it('nhà tụt 1 bậc, nửa dân bỏ đi, −3 lòng dân 6 kỳ; lều bị xóa', () => {
    const s = flat();
    const big = build(s, 'house', 20, 20); big.population = 17; big.level = 5;
    const tent = build(s, 'house', 22, 20); tent.population = 5; tent.level = 1;
    floodTiles(s, big); floodTiles(s, tent);
    expect(updateFloodedBuildings(s)).toBe(2);
    expect(big.level).toBe(4);
    expect(big.population).toBe(8);
    expect(big.floodMoodPeriods).toBe(6);
    expect(big.flooded).toBe(true);
    expect(tent.type).toBe(BuildingType.None);
    expect(s.figures.filter((f) => f.type === FigureType.Emigrant).length).toBeGreaterThan(0);
    expect(updateFloodedBuildings(s)).toBe(0); // chỉ áp một lần
  });
  it('vựa mất 50% lương thực; xưởng, kho, chợ mất hết hàng; giếng nhiễm bẩn cấp nước kém một bậc', () => {
    const s = flat();
    const g = build(s, 'granary', 20, 20); g.store[Resource.Rice] = 1000; g.store[Resource.Fish] = 300;
    const k = build(s, 'kiln', 24, 20); k.store[Resource.Clay] = 200; k.progress = 100;
    const w = build(s, 'warehouse', 27, 20); w.store[Resource.Salt] = 400;
    const m = build(s, 'market', 31, 20); m.store[Resource.Veg] = 200;
    const well = build(s, 'well', 34, 20);
    const brick = build(s, 'brickWell', 42, 20); brick.numWorkers = 4;
    const h1 = build(s, 'house', 33, 21); h1.population = 5; h1.level = 1; // chỉ trong tầm giếng thường
    const h2 = build(s, 'house', 43, 21); h2.population = 5; h2.level = 1; // chỉ trong tầm giếng gạch
    for (const b of [g, k, w, m, well, brick]) floodTiles(s, b);
    updateFloodedBuildings(s);
    expect([g.store[Resource.Rice], g.store[Resource.Fish]]).toEqual([500, 150]);
    expect([k.store[Resource.Clay], k.progress, w.store[Resource.Salt], m.store[Resource.Veg]]).toEqual([0, 0, 0, 0]);
    expect(well.pollutedDays).toBe(32);
    decayServices(s);
    expect(h1.water).toBe(0); // giếng thường nhiễm bẩn: không nước
    expect(h2.water).toBe(1); // giếng gạch nhiễm bẩn: như giếng thường
    well.pollutedDays = 0; brick.pollutedDays = 0;
    decayServices(s);
    expect([h1.water, h2.water]).toEqual([1, 2]);
  });
  it('ruộng ngập: tiến độ về 0, hết mùa được phù sa ×1,5; 5 năm không ngập thì bạc màu −10%', () => {
    const s = flat();
    const p = build(s, 'paddy', 20, 20); p.progress = 150;
    floodTiles(s, p);
    updateFloodedBuildings(s);
    expect(p.progress).toBe(0);
    expect(p.floodedThisSeason).toBe(true);
    expect(endOfSeason(s).silted).toBe(1);
    expect(paddyYield(p)).toBe(1.5);
    endOfSeason(s);
    expect(p.silted).toBe(false);
    expect(paddyYield(p)).toBe(1);
    for (let i = 0; i < 4; i++) endOfSeason(s);
    expect(p.dryYears).toBe(5);
    expect(paddyYield(p)).toBe(0.9);
    p.dryYears = 40;
    expect(paddyYield(p)).toBe(0.5);
  });
  it('đường ngập thì walker có việc không đi qua; dân đi bộ trên đất vẫn lội được', () => {
    const s = flat();
    roadLine(s, 10, 30, 30);
    const a = gridOffset(10, 30), b = gridOffset(30, 30);
    expect(findPath(s.grid, a, b, passRoad).length).toBe(20);
    s.grid.terrain[gridOffset(20, 30)] |= T_FLOODED;
    expect(findPath(s.grid, a, b, passRoad).length).toBe(0);
    expect(isRoad(s.grid, gridOffset(20, 30))).toBe(false);
  });
  it('độ hấp dẫn: ô ngập −15, đất trũng −5, bãi bồi chưa có đê −5, có đê che và gần sông +10', () => {
    const s = flat();
    updateDesirability(s);
    expect(s.grid.desirability[gridOffset(20, 20)]).toBe(-5);
    expect(s.grid.terrain[gridOffset(20, 20)] & T_UNPROTECTED).toBeTruthy();
    s.grid.terrain[gridOffset(40, 40)] |= T_FLOODED;
    s.grid.terrain[gridOffset(60, 60)] |= T_SUNKEN;
    updateDesirability(s);
    expect(s.grid.desirability[gridOffset(40, 40)]).toBe(-15);
    expect(s.grid.desirability[gridOffset(41, 40)]).toBe(-15 - 5);
    expect(s.grid.desirability[gridOffset(42, 40)]).toBe(-10 - 5);
    expect(s.grid.desirability[gridOffset(60, 60)]).toBe(-10);
    legacyDike(s, 7, 0, 159, 3);
    days(s, 2); // qua tick 26 (tính vùng có đê che) rồi tick 5 hôm sau (độ hấp dẫn)
    expect(s.grid.terrain[gridOffset(20, 20)] & T_UNPROTECTED).toBe(0);
    expect(s.grid.desirability[gridOffset(9, 20)]).toBe(10); // cách sông 6 ô, có đê che
    expect(s.grid.desirability[gridOffset(20, 20)]).toBe(0); // xa sông
    expect(s.grid.terrain[gridOffset(5, 20)] & T_UNPROTECTED).toBeTruthy(); // ngoài đê
  });
  it('mùa lũ thật: mức 2 không đê ngập cả bãi bồi, nhà mất nửa dân; có đê thì không', () => {
    const pop: number[] = [];
    for (const withDike of [false, true]) {
      const s = flat();
      const h = build(s, 'house', 30, 30);
      if (withDike) legacyDike(s, 7, 0, 159, 3);
      s.flood.nextPeak = 2;
      days(s, 5 * 16); // tới ngày 1 tháng 6 rồi mới đặt dân, kẻo nhà không dịch vụ tụt thành lều trước lũ
      h.population = 17; h.level = 5;
      days(s, 20);
      expect(s.flood.peak).toBe(2);
      expect(s.flood.floodedTiles).toBe(withDike ? 480 : 66 * 160);
      expect(h.flooded).toBe(!withDike);
      expect(h.floodMoodPeriods > 0).toBe(!withDike);
      pop.push(h.population);
      days(s, 50);
      expect(h.flooded).toBe(false);
      expect(s.grid.terrain[gridOffset(30, 30)] & T_FLOODED).toBe(0);
    }
    expect(pop[0]).toBeLessThan(pop[1]); // nhà không dịch vụ vẫn tụt bậc tự nhiên ở cả hai trường hợp, nhưng ngập mất thêm nửa dân
  });
});

describe('thuyền nan', () => {
  it('hai đầu có bến và không có đường bộ → hàng đi thuyền trên sông', () => {
    const s = flat();
    // bến cá ở (4,29) với bến thuyền (4,27); vựa ở (4,120) với bến thuyền (4,118); đường cụt riêng mỗi đầu, không nối nhau
    const road = (x: number, y: number) => applyCommand(s, { type: 'build', kind: 'road', x, y });
    road(5, 27); road(6, 27); road(6, 28); road(6, 29); road(6, 30);
    road(5, 118); road(6, 118); road(7, 118); road(7, 119); road(7, 120); road(7, 121);
    const house = build(s, 'house', 12, 60); house.population = 100; house.level = 1;
    const wharf = build(s, 'fishWharf', 4, 29); wharf.housesCovered = 200;
    const dock1 = build(s, 'dock', 4, 27); dock1.housesCovered = 200;
    const gran = build(s, 'granary', 4, 120); gran.housesCovered = 200;
    const dock2 = build(s, 'dock', 4, 118); dock2.housesCovered = 200;
    days(s, 2);
    expect([wharf.numWorkers, dock1.numWorkers, dock2.numWorkers, gran.numWorkers]).toEqual([6, 4, 4, 12]);
    const pick = chooseCartDestination(s, roadAccess(s.grid, wharf), Resource.Fish, 0, wharf);
    expect(pick?.b.id).toBe(gran.id);
    expect(pick!.boat).toBeGreaterThanOrEqual(0);
    wharf.progress = 200;
    days(s, 1);
    const boat = s.figures.find((f) => f.type === FigureType.Boat);
    expect(boat).toBeDefined();
    expect(boat!.x).toBeLessThan(4); // trên sông
    expect(wharf.figureId).toBe(boat!.id);
    days(s, 25); // ~90 ô × 10 tick = 900 tick = 18 ngày
    expect(gran.store[Resource.Fish]).toBe(100);
    days(s, 25);
    expect(s.figures.some((f) => f.type === FigureType.Boat)).toBe(false);
    expect(wharf.figureId).toBe(0);
  });
  it('có đường bộ ngắn thì vẫn đi xe bò', () => {
    const s = flat();
    roadLine(s, 6, 40, 30);
    const wharf = build(s, 'fishWharf', 4, 31); wharf.numWorkers = 6;
    build(s, 'dock', 4, 29);
    const gran = build(s, 'granary', 20, 31); gran.numWorkers = 12;
    const d2 = build(s, 'dock', 4, 33); d2.numWorkers = 4;
    const pick = chooseCartDestination(s, gridOffset(6, 30), Resource.Fish, 0, wharf);
    expect(pick?.b.id).toBe(gran.id);
    expect(pick!.boat).toBe(-1);
  });
});

describe('vỡ đê làm lòng dân giảm', () => {
  it('breachDike đặt 6 kỳ −3 cho cả thành', () => {
    const s = flat();
    legacyDike(s, 7, 50, 50, 3);
    const h = build(s, 'house', 20, 20); h.population = 10; h.level = 1; h.happiness = 60;
    s.population = 10;
    breachDike(s, dikeAt(s, 7, 50));
    expect(s.flood.breachMoodPeriods).toBe(6);
    expect(isDike(dikeAt(s, 7, 50)?.type ?? BuildingType.None)).toBe(false);
  });
});
