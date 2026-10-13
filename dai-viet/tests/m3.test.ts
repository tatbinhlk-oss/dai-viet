// Kiểm tra từng cơ chế M3 trên bản đồ phẳng nhỏ.
import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, tick } from '../src/sim';
import { BuildingType, LaborCat, Resource, StorePolicy, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { BUILDING_DEFS, BUILDING_KEYS, HOUSE_LEVELS, UNITS_PER_LOAD } from '../src/sim/buildings/defs';
import { storageAccepts, warehouseSlotsUsed } from '../src/sim/buildings/storage';
import { chooseCartDestination } from '../src/sim/figures/cartpusher';
import { updateLabor } from '../src/sim/city/labor';
import { updateFinance } from '../src/sim/city/finance';
import { updateSentiment } from '../src/sim/city/sentiment';
import { updateRisks } from '../src/sim/city/risk';
import { missingFor } from '../src/sim/buildings/house';
import { gridOffset } from '../src/sim/map/grid';

const build = (s: GameState, kind: string, x: number, y: number): GameState['buildings'][number] => {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind, x, y });
  expect(s.buildings.length, `đặt ${kind} tại ${x},${y}`).toBe(n + 1);
  return s.buildings[n];
};
const roadLine = (s: GameState, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) applyCommand(s, { type: 'build', kind: 'road', x, y }); };
const days = (s: GameState, n: number) => { for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s); };

describe('dữ liệu JSON', () => {
  it('mọi loại công trình có trong buildings.json, bảng nhà 10 bậc cộng dồn', () => {
    for (const [key, t] of BUILDING_KEYS) if (t) expect(BUILDING_DEFS[t].key).toBe(key);
    expect(HOUSE_LEVELS).toHaveLength(11);
    expect(HOUSE_LEVELS[8].needs.goods).toEqual([Resource.Pottery, Resource.Salt, Resource.Cloth, Resource.Tea]);
    expect(HOUSE_LEVELS[7].needs.water).toBe(2);
    expect(HOUSE_LEVELS[6].needs.temple && HOUSE_LEVELS[6].needs.school).toBe(true);
  });
  it('6 chuỗi xưởng nhận đúng nguyên liệu', () => {
    const chains = [[BuildingType.Kiln, Resource.Clay, Resource.Pottery], [BuildingType.Loom, Resource.Cotton, Resource.Cloth], [BuildingType.TeaHouse, Resource.TeaLeaf, Resource.Tea],
      [BuildingType.SilkWorkshop, Resource.Cocoon, Resource.Silk], [BuildingType.Foundry, Resource.CopperOre, Resource.Bronze], [BuildingType.Smithy, Resource.IronOre, Resource.Weapons]];
    for (const [t, input, out] of chains) expect([BUILDING_DEFS[t].input, BUILDING_DEFS[t].produces, BUILDING_DEFS[t].progressMax]).toEqual([input, out, 400]);
  });
});

describe('địa hình đặt công trình', () => {
  it('chè trên đất cao, mỏ trên núi, bến cá kề sông, ruộng trên bãi bồi', () => {
    const s = createSim(1, { flat: true });
    s.treasury = 1e6;
    const n = s.buildings.length;
    applyCommand(s, { type: 'build', kind: 'teaHill', x: 20, y: 10 }); // bãi bồi → không
    applyCommand(s, { type: 'build', kind: 'copperMine', x: 80, y: 10 }); // đất cao → không
    applyCommand(s, { type: 'build', kind: 'fishWharf', x: 10, y: 10 }); // xa sông → không
    applyCommand(s, { type: 'build', kind: 'paddy', x: 75, y: 10 }); // đất cao → không
    expect(s.buildings.length).toBe(n);
    build(s, 'teaHill', 75, 10); build(s, 'copperMine', 105, 10); build(s, 'fishWharf', 4, 10); build(s, 'paddy', 20, 10);
  });
});

describe('kho 8 ngăn × 4 kiện', () => {
  it('mỗi ngăn một loại; đủ 8 ngăn thì từ chối loại mới', () => {
    const s = createSim(1, { flat: true });
    const w = build(s, 'warehouse', 20, 20);
    w.numWorkers = 6;
    w.store[Resource.Clay] = 7 * UNITS_PER_LOAD; // 2 ngăn
    expect(warehouseSlotsUsed(w)).toBe(2);
    expect(storageAccepts(w, Resource.Clay)).toBe(true); // ngăn thứ 2 còn 1 chỗ
    for (const r of [Resource.Salt, Resource.Cloth, Resource.Tea, Resource.Silk, Resource.Bronze]) w.store[r] = 4 * UNITS_PER_LOAD;
    expect(warehouseSlotsUsed(w)).toBe(7);
    expect(storageAccepts(w, Resource.Pottery)).toBe(true);
    w.store[Resource.Pottery] = 4 * UNITS_PER_LOAD;
    expect(storageAccepts(w, Resource.Timber)).toBe(false);
    expect(storageAccepts(w, Resource.Clay)).toBe(true); // vẫn còn chỗ trong ngăn đất sét
    w.policy[Resource.Clay] = StorePolicy.Refuse;
    expect(storageAccepts(w, Resource.Clay)).toBe(false);
  });
  it('vựa chỉ nhận lương thực và cần đủ 100% nhân công', () => {
    const s = createSim(1, { flat: true });
    const g = build(s, 'granary', 20, 20);
    g.numWorkers = 11;
    expect(storageAccepts(g, Resource.Rice)).toBe(false);
    g.numWorkers = 12;
    expect(storageAccepts(g, Resource.Rice)).toBe(true);
    expect(storageAccepts(g, Resource.Clay)).toBe(false);
  });
});

describe('xe bò chọn đích theo thứ tự thiết kế', () => {
  it('kho "Đi lấy" → vựa → xưởng thiếu nguyên liệu → kho bất kỳ', () => {
    const s = createSim(1, { flat: true });
    roadLine(s, 10, 60, 30);
    const from = gridOffset(10, 30);
    const w1 = build(s, 'warehouse', 50, 31); w1.numWorkers = 6;
    const kiln = build(s, 'kiln', 30, 31); kiln.numWorkers = 10;
    const g = build(s, 'granary', 40, 31); g.numWorkers = 12;
    // đất sét: xưởng gần hơn kho
    expect(chooseCartDestination(s, from, Resource.Clay, 0)?.b.id).toBe(kiln.id);
    kiln.store[Resource.Clay] = 2 * UNITS_PER_LOAD; // xưởng đủ 2 kiện → kho
    expect(chooseCartDestination(s, from, Resource.Clay, 0)?.b.id).toBe(w1.id);
    // gạo: vựa trước kho
    expect(chooseCartDestination(s, from, Resource.Rice, 0)?.b.id).toBe(g.id);
    // kho đang "Đi lấy" gạo → kho trước vựa
    w1.policy[Resource.Rice] = StorePolicy.Get;
    expect(chooseCartDestination(s, from, Resource.Rice, 0)?.b.id).toBe(w1.id);
  });
});

describe('lao động 9 ngành', () => {
  it('ngành ưu tiên được lấp trước, phần còn lại chia theo tỉ lệ', () => {
    const s = createSim(1, { flat: true });
    roadLine(s, 10, 60, 30);
    const house = build(s, 'house', 12, 31);
    house.population = 50; house.level = 1; // 30 nhân công
    const paddy = build(s, 'paddy', 20, 31); // 10, lương thực
    const kiln = build(s, 'kiln', 24, 31); // 10, thủ công
    const watch = build(s, 'watchPost', 28, 31); // 6, tuần phòng
    const school = build(s, 'school', 30, 31); // 10, y tế giáo dục
    for (const b of [paddy, kiln, watch, school]) b.housesCovered = 50;
    updateLabor(s);
    expect(s.labor.workforce).toBe(30);
    expect(s.labor.employed).toBe(30);
    applyCommand(s, { type: 'setLaborPriority', category: LaborCat.HealthEdu, priority: 1 });
    applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Watch, priority: 2 });
    updateLabor(s);
    expect(school.numWorkers).toBe(10);
    expect(watch.numWorkers).toBe(6);
    expect(paddy.numWorkers + kiln.numWorkers).toBe(14);
    // công trình chưa được người mộ phu thấy nhà → 0 người
    kiln.housesCovered = 0;
    updateLabor(s);
    expect(kiln.numWorkers).toBe(0);
    expect(paddy.numWorkers).toBe(10);
  });
});

describe('thuế và lòng dân', () => {
  it('chỉ thu thuế nhà có lại thu thuế đi qua', () => {
    const s = createSim(1, { flat: true });
    const a = build(s, 'house', 20, 20), b = build(s, 'house', 22, 20);
    for (const h of [a, b]) { h.population = 100; h.level = 6; }
    a.taxCoverage = 30;
    const before = s.treasury;
    updateFinance(s);
    expect(s.treasury - before).toBe(Math.floor((100 * HOUSE_LEVELS[6].tax * s.taxRate) / 100));
  });
  it('thuế 25% làm lòng dân tụt, thuế 0% làm tăng', () => {
    const s = createSim(1, { flat: true });
    const h = build(s, 'house', 20, 20);
    h.population = 10; h.level = 1; h.happiness = 60;
    s.population = 10;
    applyCommand(s, { type: 'setTax', rate: 25 });
    for (let i = 0; i < 6; i++) updateSentiment(s);
    expect(h.happiness).toBeLessThan(40);
    applyCommand(s, { type: 'setTax', rate: 0 });
    for (let i = 0; i < 12; i++) updateSentiment(s);
    expect(h.happiness).toBeGreaterThan(70);
  });
});

describe('nhà bậc 6–8', () => {
  it('báo đúng thứ tự thiếu: nước → lương thực → … → độ hấp dẫn', () => {
    const s = createSim(1, { flat: true });
    const h = build(s, 'house', 20, 20);
    h.population = 10; h.level = 5;
    expect(missingFor(s, h, 6)).toBe('nước giếng');
    h.water = 1;
    expect(missingFor(s, h, 6)).toBe('2 loại lương thực');
    h.store[Resource.Rice] = 10; h.store[Resource.Fish] = 10;
    h.dinh = h.temple = 50;
    expect(missingFor(s, h, 6)).toBe('lớp học thầy đồ');
    h.school = h.clinic = 50;
    h.store[Resource.Pottery] = 2;
    expect(missingFor(s, h, 6)).toBe('muối');
    h.store[Resource.Salt] = 2;
    expect(missingFor(s, h, 6)).toBe('độ hấp dẫn ≥ 20');
    s.grid.desirability[gridOffset(20, 20)] = 25;
    expect(missingFor(s, h, 6)).toBeNull();
    expect(missingFor(s, h, 7)).toBe('giếng gạch');
  });
});

describe('cháy và sập', () => {
  it('không có tuần đinh thì lò gốm cháy thành đống tro rồi dọn sạch', () => {
    const s = createSim(1, { flat: true });
    const k = build(s, 'kiln', 20, 20);
    k.fireRisk = 101;
    updateRisks(s);
    expect(k.type).toBe(BuildingType.Ruins);
    expect(s.events.at(-1)).toContain('Cháy');
    for (let i = 0; i < 20; i++) updateRisks(s);
    expect(k.type).toBe(BuildingType.None);
  });
  it('tuần đinh đi qua đặt fire_risk về 0', () => {
    const s = createSim(1, { flat: true });
    roadLine(s, 10, 40, 30);
    const house = build(s, 'house', 12, 31); house.population = 20; house.level = 1; // để có nhân công
    const watch = build(s, 'watchPost', 20, 31);
    const k = build(s, 'kiln', 24, 31);
    k.fireRisk = 90;
    applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Watch, priority: 1 });
    days(s, 40);
    expect(watch.numWorkers).toBeGreaterThan(0);
    expect(k.type).toBe(BuildingType.Kiln);
    expect(k.fireRisk).toBeLessThan(90);
  });
});
