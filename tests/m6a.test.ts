// Kiểm tra từng cơ chế M6a: thương mại (tuyến, hạn ngạch, lái buôn), giặc giã (xuất hiện, đốt, lính, thành), lưu / nạp game.
import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, tick } from '../src/sim';
import { BuildingType, FigureType, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { UNITS_PER_LOAD } from '../src/sim/buildings/defs';
import { openRoute, PRICES, quotaOf, QUOTA_LEVELS, riverEdgeTile, yearlyTrade } from '../src/sim/city/trade';
import { invasionEntry, scheduleInvasion, WAR } from '../src/sim/city/war';
import { deserialize, fromJson, serialize, toJson } from '../src/sim/save';
import { createScenario } from '../src/sim/scenario/loader';
import { buildCourtTown, demoPriorities } from '../src/sim/scenario/demo';
import { gridOffset, isLand } from '../src/sim/map/grid';

const build = (s: GameState, kind: string, x: number, y: number): GameState['buildings'][number] => {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind, x, y });
  expect(s.buildings.length, `đặt ${kind} tại ${x},${y}`).toBe(n + 1);
  return s.buildings[n];
};
const roadLine = (s: GameState, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) applyCommand(s, { type: 'build', kind: 'road', x, y }); };
const days = (s: GameState, n: number) => { for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s); };
const flat = () => { const s = createSim(1, { flat: true }); s.treasury = 1e5; return s; };
const count = (s: GameState, t: FigureType) => s.figures.filter((f) => f.type === t).length;

describe('thương mại', () => {
  function townWithWarehouse(s: GameState) {
    s.flood.nextPeak = 1; // kho ở bãi bồi: lũ vừa sẽ cuốn hết hàng, ép lũ nhỏ năm 1
    roadLine(s, 4, 40, 30);
    const h = build(s, 'house', 110, 27); h.population = 100; h.level = 1;
    const w = build(s, 'warehouse', 20, 31); w.housesCovered = 200;
    return w;
  }
  it('mở tuyến tốn tiền, hạn ngạch mức 1 = 15 kiện; đoàn buôn tới kho mua hàng có lệnh Bán, trả tiền theo giá', () => {
    const s = flat();
    const w = townWithWarehouse(s);
    w.store[Resource.Salt] = 20 * UNITS_PER_LOAD;
    expect(openRoute(s, 0)).toBeNull();
    expect(openRoute(s, 0)).toContain('đã mở');
    const rs = s.trade.routes[0];
    expect(s.treasury).toBe(1e5 - 10 - 80 - 400);
    expect(quotaOf(rs, Resource.Salt)).toBe(15);
    expect(quotaOf(rs, Resource.Rice)).toBe(0);
    applyCommand(s, { type: 'setTradeOrder', resource: Resource.Salt, order: 2 });
    days(s, 18);
    expect(count(s, FigureType.Caravan)).toBe(1);
    const t0 = s.treasury;
    days(s, 30); // từ (4,80) tới kho (20,31): ~66 ô × 15 tick ≈ 20 ngày
    expect(rs.tradedThisYear[Resource.Salt]).toBe(8);
    expect(w.store[Resource.Salt]).toBe(12 * UNITS_PER_LOAD);
    expect(s.treasury - t0).toBeGreaterThanOrEqual(8 * PRICES[Resource.Salt][0] - 300); // trừ lương / Tết trong 30 ngày
    expect(s.thisYear.exports).toBe(8 * PRICES[Resource.Salt][0]);
    expect(s.trade.caravansThisYear).toBe(1);
    // chuyến sau: chỉ còn 7 kiện trong hạn ngạch
    days(s, 60);
    expect(rs.tradedThisYear[Resource.Salt]).toBe(15);
    // đầu năm: đủ 80% hạn ngạch → lên mức 25
    yearlyTrade(s);
    expect(quotaOf(rs, Resource.Salt)).toBe(QUOTA_LEVELS[2]);
    expect(rs.tradedLastYear[Resource.Salt]).toBe(15);
    expect(rs.tradedThisYear[Resource.Salt]).toBe(0);
  });
  it('lệnh Mua: đoàn buôn bán quặng đồng vào kho, trừ tiền; không lệnh thì không mua bán', () => {
    const s = flat();
    const w = townWithWarehouse(s);
    openRoute(s, 0);
    applyCommand(s, { type: 'setTradeOrder', resource: Resource.CopperOre, order: 1 });
    days(s, 50);
    expect(w.store[Resource.CopperOre]).toBe(8 * UNITS_PER_LOAD);
    expect(s.thisYear.imports).toBe(8 * PRICES[Resource.CopperOre][1]);
    applyCommand(s, { type: 'setTradeOrder', resource: Resource.CopperOre, order: 0 });
    days(s, 60);
    expect(w.store[Resource.CopperOre]).toBe(8 * UNITS_PER_LOAD);
  });
  it('tuyến sông: thuyền buôn từ mép sông tới bến cảng, mua bán với kho gần cảng, đếm chuyến cho Thịnh vượng', () => {
    const s = flat();
    roadLine(s, 4, 40, 30);
    const h = build(s, 'house', 110, 27); h.population = 200; h.level = 1;
    const port = build(s, 'port', 4, 31); port.housesCovered = 200;
    const w = build(s, 'warehouse', 10, 31); w.housesCovered = 200;
    w.store[Resource.Silk] = 10 * UNITS_PER_LOAD;
    expect(riverEdgeTile(s)).toBe(gridOffset(0, 0));
    openRoute(s, 1);
    applyCommand(s, { type: 'setTradeOrder', resource: Resource.Silk, order: 2 });
    days(s, 20);
    expect(count(s, FigureType.TradeShip)).toBe(1);
    days(s, 20); // 33 ô × 10 tick
    expect(s.trade.shipsThisYear).toBe(1);
    expect(w.store[Resource.Silk]).toBe(0);
    expect(s.thisYear.exports).toBe(10 * PRICES[Resource.Silk][0]);
    expect(s.trade.routes[1].tradedThisYear[Resource.Silk]).toBe(10);
  });
  it('màn Sơn Nam chỉ mở được tuyến ghi trong kịch bản; chơi tự do mở được tất cả', () => {
    const s = createScenario('sonNam', 1, true);
    expect(s.scenario.routes).toEqual(['mountain', 'sea']);
    const t = flat();
    expect(t.scenario.routes.length).toBe(2);
    applyCommand(t, { type: 'openRoute', route: 1 });
    expect(t.trade.routes[1].open).toBe(true);
  });
});

describe('giặc giã', () => {
  it('báo trước 2 tháng, giặc vào từ mép bản đồ, đốt công trình gần nhất rồi rút khi hết "ngân sách" phá', () => {
    const s = flat();
    const h = build(s, 'house', 80, 150); h.population = 10; h.level = 3;
    const h2 = build(s, 'house', 82, 150); h2.population = 10; h2.level = 3;
    scheduleInvasion(s, 1, 3, 'south', 2);
    expect(invasionEntry(s, 'south')).toBe(gridOffset(80, 159));
    expect(isLand(s.grid, invasionEntry(s, 'sea'))).toBe(true);
    days(s, 1);
    expect(s.events.some((e) => e.startsWith('Tin báo'))).toBe(true);
    days(s, 2 * 16); // ngày 1 tháng 3
    expect(count(s, FigureType.Enemy)).toBe(2);
    expect(s.war.enemiesAlive).toBe(2);
    days(s, 12); // 9 ô đi + 40 tick đốt
    expect(h.type === BuildingType.Ruins || h2.type === BuildingType.Ruins).toBe(true);
    expect(s.war.burnedByEnemies).toBeGreaterThanOrEqual(1);
    days(s, 60);
    expect(count(s, FigureType.Enemy)).toBe(0); // phá xong 2 nhà (ngân sách 3 nhưng hết mục tiêu) hoặc rút
    expect(s.war.enemiesAlive).toBe(0);
  });
  it('trại lính biến vũ khí thành lính (tối đa 4), lính đánh giặc trong tầm và hạ được', () => {
    const s = flat();
    roadLine(s, 70, 90, 140);
    const h = build(s, 'house', 110, 27); h.population = 100; h.level = 1;
    const b = build(s, 'barracks', 80, 141); b.housesCovered = 200;
    b.store[Resource.Weapons] = 6 * UNITS_PER_LOAD;
    scheduleInvasion(s, 1, 2, 'south', 2);
    days(s, 6);
    expect(count(s, FigureType.Militia)).toBe(WAR.perBarracks);
    expect(b.store[Resource.Weapons]).toBe(2 * UNITS_PER_LOAD);
    days(s, 11); // qua ngày 1 tháng 2
    expect(count(s, FigureType.Enemy)).toBe(2);
    days(s, 20);
    expect(count(s, FigureType.Enemy)).toBe(0);
    expect(s.war.killedThisYear).toBe(2);
    expect(count(s, FigureType.Militia)).toBeGreaterThanOrEqual(2);
  });
  it('thành chặn giặc: không qua được thì phá thành (thành đất 3 đòn), thành không đặt lên đường', () => {
    const s = flat();
    const h = build(s, 'house', 80, 150); h.population = 10; h.level = 3;
    // vòng thành quanh nhà, hở ở mép dưới để giặc đứng cạnh thành
    for (let x = 78; x <= 82; x++) for (const y of [148, 152]) build(s, 'earthWall', x, y);
    for (const y of [149, 150, 151]) { build(s, 'earthWall', 78, y); build(s, 'earthWall', 82, y); }
    expect(s.buildings.at(-1)!.integrity).toBe(WAR.wallHp.earthWall);
    applyCommand(s, { type: 'build', kind: 'road', x: 70, y: 150 });
    applyCommand(s, { type: 'build', kind: 'earthWall', x: 70, y: 150 });
    expect(s.buildings.at(-1)!.x).toBe(82); // không đặt được lên đường
    scheduleInvasion(s, 1, 1, 'south', 1);
    days(s, 1 + 6);
    const e = s.figures.find((f) => f.type === FigureType.Enemy)!;
    expect(e).toBeDefined();
    expect(h.type).toBe(BuildingType.House);
    const walls = () => s.buildings.filter((b) => b.type === BuildingType.EarthWall).length;
    const w0 = walls();
    days(s, 8); // 3 đòn × 80 tick mỗi đoạn
    expect(walls()).toBeLessThan(w0);
    expect(walls()).toBeGreaterThanOrEqual(w0 - 2);
    days(s, 12);
    expect(h.type).not.toBe(BuildingType.House); // qua lỗ hổng vào đốt nhà (tro có thể đã dọn)
    expect(s.war.burnedByEnemies).toBeGreaterThanOrEqual(1);
  });
});

describe('lưu game', () => {
  it('JSON ↔ state giữ TypedArray; lưu → nạp → chạy 1 năm cho kết quả y hệt không lưu', async () => {
    const a = createScenario('sonNam', 3, true);
    buildCourtTown(a); demoPriorities(a);
    days(a, 100);
    const json = toJson(a);
    const b = fromJson(json);
    expect(b.grid.terrain).toBeInstanceOf(Uint16Array);
    expect(b.grid.dike).toBeInstanceOf(Uint8Array);
    expect(b.figures[1].path).toBeInstanceOf(Int32Array);
    expect(b.rng.state).toBe(a.rng.state);
    expect(b.dirty.size).toBe(0);
    for (let i = 0; i < 192 * TICKS_PER_DAY; i++) { tick(a); tick(b); }
    expect(b.population).toBe(a.population);
    expect(b.treasury).toBe(a.treasury);
    expect(b.rng.state).toBe(a.rng.state);
    expect(b.court.favor).toBe(a.court.favor);
    expect(b.buildings.map((x) => `${x.type}:${x.level}:${x.population}:${x.store.join(',')}`)).toEqual(a.buildings.map((x) => `${x.type}:${x.level}:${x.population}:${x.store.join(',')}`));
    expect(b.figures.filter((f) => f.type).length).toBe(a.figures.filter((f) => f.type).length);
    // gzip
    const bytes = await serialize(a);
    expect(bytes.length).toBeLessThan(json.length / 3);
    const c = await deserialize(bytes);
    expect(c.population).toBe(a.population);
    expect(c.time).toEqual(a.time);
  }, 60000);
});
