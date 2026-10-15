// M7: cầu gỗ qua sông, cổng thành, phu lao dịch, thuyền nan 2 kiện, quân triều đình cách chức, vua thêm chiếu chỉ theo tính cách.
import { describe, expect, it } from 'vitest';
import { applyCommand, applyUndo, createSim, placementError, tick, undoAfter, undoBefore } from '../src/sim';
import { BuildingType, FigureType, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { BUILDING_DEFS, court, economy, flood } from '../src/sim/buildings/defs';
import { gridOffset, isGateTile, isLand, isRoad, isWater, T_BUILDING, T_ROAD, T_WATER } from '../src/sim/map/grid';
import { findPath, passHostile, passHostileTo, passLand, passRoad, passWater } from '../src/sim/map/routing';
import { placementCheck } from '../src/sim/buildings/placement';
import { deliverEdict, dispatchEdict, kingExtraEdicts, scheduleEdict } from '../src/sim/city/court';
import { WAR } from '../src/sim/city/war';
import { CORVEE_ROUTE } from '../src/sim/figures/levyWorker';
import { waitingForBoat } from '../src/sim/figures/cartpusher';
import { createScenario, SCENARIOS } from '../src/sim/scenario/loader';
import { LINE_TOOLS } from '../src/render/line';

const build = (s: GameState, kind: string, x: number, y: number): GameState['buildings'][number] => {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind, x, y });
  expect(s.buildings.length, `đặt ${kind} tại ${x},${y}`).toBe(n + 1);
  return s.buildings[n];
};
const road = (s: GameState, x: number, y: number) => applyCommand(s, { type: 'build', kind: 'road', x, y });
const roadLine = (s: GameState, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) road(s, x, y); };
const days = (s: GameState, n: number) => { for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s); };
const flat = () => { const s = createSim(1, { flat: true }); s.treasury = 1e5; return s; };
const count = (s: GameState, t: FigureType) => s.figures.filter((f) => f.type === t).length;
const tiles = (s: GameState) => ({ terrain: s.grid.terrain, elevation: s.grid.elevation, bType: s.grid.bType });

describe('cầu gỗ', () => {
  it('bắc qua ô sông: dân đi như đường, thuyền vẫn qua, tốn tiền mỗi ô, phá / hoàn tác bỏ cầu', () => {
    const s = flat();
    // đào một lạch nước cắt ngang đường y = 50 ở x = 10..12
    for (const x of [10, 11, 12]) s.grid.terrain[gridOffset(x, 50)] = T_WATER;
    roadLine(s, 4, 9, 50); roadLine(s, 13, 20, 50);
    expect(findPath(s.grid, gridOffset(4, 50), gridOffset(20, 50), passRoad).length).toBe(0);
    expect(placementCheck(tiles(s), 'bridge', undefined, 9, 50)).toBe('cầu phải bắc qua sông');
    expect(placementCheck(tiles(s), 'bridge', undefined, 11, 50)).toBeNull();
    expect(placementError(s, 'bridge', 11, 50)).toBeNull();
    const t0 = s.treasury;
    const before = undoBefore(s);
    for (const x of [10, 11, 12]) applyCommand(s, { type: 'build', kind: 'bridge', x, y: 50 });
    expect(s.treasury).toBe(t0 - 3 * economy.bridgeCost);
    const o = gridOffset(11, 50);
    expect(s.grid.terrain[o] & (T_WATER | T_ROAD)).toBe(T_WATER | T_ROAD);
    expect(isRoad(s.grid, o) && isWater(s.grid, o) && isLand(s.grid, o)).toBe(true);
    expect(placementCheck(tiles(s), 'bridge', undefined, 11, 50)).toBe('đã có cầu');
    expect(placementCheck(tiles(s), 'road', undefined, 11, 50)).toBe('dưới nước');
    expect(findPath(s.grid, gridOffset(4, 50), gridOffset(20, 50), passRoad).length).toBe(16);
    expect(findPath(s.grid, gridOffset(4, 50), gridOffset(20, 50), passLand).length).toBe(16);
    expect(findPath(s.grid, gridOffset(10, 50), gridOffset(12, 50), passWater).length).toBe(2); // thuyền chui qua cầu
    // không đặt cổng lên cầu
    applyCommand(s, { type: 'build', kind: 'gate', x: 11, y: 50 });
    expect(s.grid.terrain[o] & T_BUILDING).toBe(0);
    // hoàn tác trả tiền
    const rec = undoAfter(s, before)!;
    expect(rec.roads.length).toBe(3);
    expect(applyUndo(s, rec)).toBe(3);
    expect(s.treasury).toBe(t0);
    expect(s.grid.terrain[o]).toBe(T_WATER);
    // phá cầu
    applyCommand(s, { type: 'build', kind: 'bridge', x: 11, y: 50 });
    applyCommand(s, { type: 'raze', x: 11, y: 50 });
    expect(s.grid.terrain[o]).toBe(T_WATER);
    expect(LINE_TOOLS.has('bridge')).toBe(true);
    s.treasury = 10;
    expect(placementError(s, 'bridge', 11, 50)).toContain('không đủ tiền');
  });
});

describe('cổng thành', () => {
  it('chỉ đặt lên ô đường; dân đi qua, giặc không qua → phá cổng (4 đòn) rồi vào; phá cổng thì đường còn', () => {
    const s = flat();
    for (let y = 145; y <= 159; y++) road(s, 80, y);
    const h = build(s, 'house', 79, 150); h.population = 10; h.level = 3; // kề đường x = 80 bên trong vòng thành
    // vòng thành quanh nhà, đường xuyên qua ở (80,148) và (80,152) → hai cổng
    for (let x = 78; x <= 82; x++) for (const y of [148, 152]) if (x !== 80) build(s, 'earthWall', x, y);
    for (const y of [149, 150, 151]) { build(s, 'earthWall', 78, y); build(s, 'earthWall', 82, y); }
    expect(placementCheck(tiles(s), 'gate', BuildingType.Gate, 78, 149)).toBe('đã có công trình');
    expect(placementCheck(tiles(s), 'gate', BuildingType.Gate, 85, 155)).toBe('cổng phải đặt lên ô đường');
    expect(placementCheck(tiles(s), 'gate', BuildingType.Gate, 80, 152)).toBeNull();
    applyCommand(s, { type: 'build', kind: 'gate', x: 85, y: 155 });
    const g1 = build(s, 'gate', 80, 148);
    const g2 = build(s, 'gate', 80, 152);
    expect(g2.integrity).toBe(WAR.wallHp.gate);
    const o = gridOffset(80, 152);
    expect(s.grid.terrain[o] & (T_ROAD | T_BUILDING)).toBe(T_ROAD | T_BUILDING);
    expect(isGateTile(s.grid, o)).toBe(true);
    expect(isRoad(s.grid, o)).toBe(true);
    expect(findPath(s.grid, gridOffset(80, 159), gridOffset(80, 145), passRoad).length).toBe(14); // dân đi xuyên hai cổng
    expect(findPath(s.grid, gridOffset(80, 159), gridOffset(80, 151), passHostileTo(gridOffset(80, 151))).length).toBe(0); // giặc bị chặn
    expect(passHostile(s.grid, o)).toBe(false);
    // phá cổng bằng tay: đường bên dưới còn
    applyCommand(s, { type: 'raze', x: 80, y: 148 });
    expect(g1.type).toBe(BuildingType.None);
    expect(s.grid.terrain[gridOffset(80, 148)] & T_ROAD).toBe(T_ROAD);
    build(s, 'gate', 80, 148);
    // giặc từ nam: tới cổng (80,152), đứng ở (80,153) phá 4 đòn × 80 tick rồi vào đốt nhà
    s.war.invasions.push({ year: 1, month: 1, source: 'south', size: 1, warned: true, done: false });
    days(s, 1 + 3);
    const e = s.figures.find((f) => f.type === FigureType.Enemy)!;
    expect(e).toBeDefined();
    expect(h.type).toBe(BuildingType.House);
    days(s, 9);
    expect(s.buildings[g2.id].type).toBe(BuildingType.None);
    expect(s.events.some((t) => t.includes('phá cổng thành'))).toBe(true);
    expect(s.grid.terrain[o] & T_ROAD).toBe(T_ROAD); // đường dưới cổng còn
    days(s, 10);
    expect(h.type).not.toBe(BuildingType.House);
  });
});

describe('phu lao dịch', () => {
  it('chiếu chỉ lao dịch đang thi hành, không có đê chờ → đình cử nhóm phu ra cửa ngõ rồi về', () => {
    const s = flat();
    roadLine(s, 4, 40, 30);
    const h = build(s, 'house', 30, 27); h.population = 100; h.level = 1; s.population = 100;
    const dinh = build(s, 'dinh', 20, 31); dinh.housesCovered = 200;
    days(s, 2);
    expect(dinh.numWorkers).toBeGreaterThan(0);
    expect(count(s, FigureType.LevyWorker)).toBe(0);
    const c = scheduleEdict(s, { type: 'corvee', year: 1, month: 1, resource: Resource.None, building: BuildingType.None, amount: 100000, height: 0, deadlineMonths: 24, reward: 4 });
    deliverEdict(s, c);
    expect(dispatchEdict(s, c.id, 2)).toBeNull();
    days(s, 2);
    expect(s.court.corveeWorkers).toBeGreaterThan(0);
    const gang = s.figures.find((f) => f.type === FigureType.LevyWorker)!;
    expect(gang).toBeDefined();
    expect(gang.route).toBe(CORVEE_ROUTE);
    expect(gang.loads).toBe(flood.dike.gangSize);
    expect(dinh.figureId2).toBe(gang.id);
    expect(gang.path[gang.path.length - 1]).toBe(s.entryOffset);
    days(s, 30); // ~70 ô × 15 tick ≈ 21 ngày tới cửa ngõ
    expect(gang.type).toBe(FigureType.LevyWorker);
    expect(gang.returning).toBe(true);
    days(s, 30);
    expect(gang.type).not.toBe(FigureType.LevyWorker); // về tới đình thì biến mất
    expect(count(s, FigureType.LevyWorker)).toBeLessThanOrEqual(1); // đình cử nhóm kế tiếp
  });
});

describe('thuyền nan 2 kiện', () => {
  it('xe bò chờ ở cửa tối đa waitDays ngày; hết hạn thì đi thuyền với 1 kiện', () => {
    const s = flat();
    road(s, 5, 27); road(s, 6, 27); road(s, 6, 28); road(s, 6, 29); road(s, 6, 30);
    road(s, 5, 118); road(s, 6, 118); road(s, 7, 118); road(s, 7, 119); road(s, 7, 120); road(s, 7, 121);
    const house = build(s, 'house', 12, 60); house.population = 100; house.level = 1;
    const wharf = build(s, 'fishWharf', 4, 29); wharf.housesCovered = 200;
    build(s, 'dock', 4, 27).housesCovered = 200;
    const gran = build(s, 'granary', 4, 120); gran.housesCovered = 200;
    build(s, 'dock', 4, 118).housesCovered = 200;
    days(s, 2);
    wharf.progress = BUILDING_DEFS[BuildingType.FishWharf].progressMax;
    days(s, 1);
    const cart = s.figures.find((f) => f.type === FigureType.CartPusher)!;
    expect(waitingForBoat(cart)).toBe(true);
    expect(cart.waitTicks).toBeGreaterThan((flood.boat.waitDays - 1) * TICKS_PER_DAY);
    days(s, flood.boat.waitDays + 1);
    const boat = s.figures.find((f) => f.type === FigureType.Boat)!;
    expect(boat).toBeDefined();
    expect(boat.id).toBe(cart.id);
    expect(boat.loads).toBe(1);
    expect(wharf.progress).toBeGreaterThan(0); // vẫn sản xuất trong lúc chờ
  });
});

describe('quân triều đình cách chức', () => {
  it('có nha môn: đến hạn thì quân từ cửa ngõ kéo tới nha môn (cơ chế giặc), chiếm được mới mất chức; không nha môn: mất chức ngay', () => {
    const s = flat();
    roadLine(s, 70, 90, 150);
    build(s, 'yamen', 80, 151).housesCovered = 200;
    s.court.favor = 5;
    s.court.dismissalDay = s.time.totalDays;
    days(s, 1);
    expect(count(s, FigureType.CourtTroops)).toBe(WAR.dismissalTroops);
    expect(s.gameOver).toBe('');
    expect(s.court.dismissalDay).toBe(s.time.totalDays + court.favor.dismissWarningDays - 1);
    expect(s.events.some((t) => t.startsWith('Quân triều đình'))).toBe(true);
    // đánh lui một toán: báo sẽ có đợt sau
    s.figures.find((f) => f.type === FigureType.CourtTroops)!.hp = 0;
    days(s, 1);
    expect(count(s, FigureType.CourtTroops)).toBe(WAR.dismissalTroops - 1);
    days(s, 60); // ~146 ô × 15 tick ≈ 44 ngày
    expect(s.gameOver).toBe('dismissed');
    expect(s.speed).toBe(0);
    expect(s.events.some((t) => t.startsWith('Quân triều đình chiếm nha môn'))).toBe(true);

    const s2 = flat();
    s2.court.favor = 5;
    s2.court.dismissalDay = s2.time.totalDays;
    days(s2, 1);
    expect(s2.gameOver).toBe('dismissed');
    expect(count(s2, FigureType.CourtTroops)).toBe(0);
  });
  it('hạ hết quân triều đình thì có đợt sau; thành kín thì quân phá thành', () => {
    const s = flat();
    roadLine(s, 70, 90, 150);
    build(s, 'yamen', 80, 151).housesCovered = 200;
    s.court.favor = 5;
    s.court.dismissalDay = s.time.totalDays;
    days(s, 1);
    for (const f of s.figures) if (f.type === FigureType.CourtTroops) f.hp = 0;
    days(s, 1);
    expect(count(s, FigureType.CourtTroops)).toBe(0);
    expect(s.gameOver).toBe('');
    expect(s.events.some((t) => t.startsWith('Đánh lui quân triều đình'))).toBe(true);
    s.court.dismissalDay = s.time.totalDays;
    days(s, 1);
    expect(count(s, FigureType.CourtTroops)).toBe(WAR.dismissalTroops);
  });
});

describe('vua đổi chiếu chỉ theo tính cách', () => {
  it('lịch thêm theo court.json: sùng Phật thêm nghi lễ chùa năm chẵn, bỏ năm đã có; hiếu chiến thêm binh dịch; tự do không thêm', () => {
    const b = kingExtraEdicts('buddhist', 10, []);
    expect(b.map((e) => [e.year, e.type, e.amount])).toEqual([[2, 'ritual', 1], [4, 'ritual', 1], [6, 'ritual', 2], [8, 'ritual', 2]]);
    expect(b[0].building).toBe(BuildingType.Temple);
    expect(kingExtraEdicts('buddhist', 10, [{ year: 4, type: 'ritual' }]).map((e) => e.year)).toEqual([2, 6, 8]);
    expect(kingExtraEdicts('martial', 0, []).map((e) => [e.year, e.type, e.amount])).toEqual([[2, 'troops', 10], [4, 'troops', 10], [6, 'troops', 20]]);
    expect(kingExtraEdicts('', 10, [])).toEqual([]);
    const s = createScenario('tranLi', 1, true);
    const extra = s.court.edicts.filter((e) => !SCENARIOS.tranLi.edicts.some((d) => d.year === e.year && d.type === e.type));
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.every((e) => e.type === 'troops' && e.month === 3)).toBe(true);
    const lang = createScenario('langVenSong', 1, true);
    expect(lang.court.edicts.some((e) => e.type === 'ritual' && e.building === BuildingType.Temple)).toBe(true);
  });
});
