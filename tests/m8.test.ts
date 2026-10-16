// M8: quân đội — đội quân đứng gác / điều quân, cung thủ bắn xa, voi trận, chòi canh biên báo sớm, giặc cướp kho, xác, lưu nạp, snapshot.
import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, takeSnapshot, tick, FIG_STRIDE } from '../src/sim';
import { FIG_FIGHTING } from '../src/sim/snapshot';
import { BuildingType, FigureMode, FigureType, Resource, TICKS_PER_DAY, TICKS_PER_TILE, type GameState } from '../src/sim/state';
import { BUILDING_DEFS, UNITS_PER_LOAD } from '../src/sim/buildings/defs';
import { gridOffset, offsetX, offsetY, T_WATER } from '../src/sim/map/grid';
import { WAR, invasionEntry, squadKind, watchtowerCovers, warningLead } from '../src/sim/city/war';
import { formationSlot, squadAnchor, updateSoldier, CORPSE_ENEMY, CORPSE_MILITIA } from '../src/sim/figures/enemy';
import { createFigure } from '../src/sim/figures/figure';
import { ticksPerTile } from '../src/sim/figures/movement';
import { roadAccess } from '../src/sim/buildings/spawn';
import { fromJson, toJson } from '../src/sim/save';

const build = (s: GameState, kind: string, x: number, y: number): GameState['buildings'][number] => {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind, x, y });
  expect(s.buildings.length, `đặt ${kind} tại ${x},${y}`).toBe(n + 1);
  const b = s.buildings[n];
  b.housesCovered = 200; // người mộ phu đã thấy nhà → lao động cấp người từ nhà có dân trong flat()
  b.numWorkers = BUILDING_DEFS[b.type].workers;
  return b;
};
const road = (s: GameState, x: number, y: number) => applyCommand(s, { type: 'build', kind: 'road', x, y });
const days = (s: GameState, n: number) => { for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s); };
const ticks = (s: GameState, n: number) => { for (let i = 0; i < n; i++) tick(s); };
/** Bản đồ phẳng, một nhà 200 dân ở góc xa làm nguồn nhân công cho mọi công trình (lao động cấp người mỗi ngày). */
const flat = () => { const s = createSim(1, { flat: true }); s.treasury = 1e5; applyCommand(s, { type: 'build', kind: 'house', x: 110, y: 20 }); const h = s.buildings[1]; h.population = 200; h.level = 1; return s; };
const count = (s: GameState, t: FigureType) => s.figures.filter((f) => f.type === t).length;
const squad = (s: GameState, id: number) => s.figures.filter((f) => f.buildingId === id && (f.type === FigureType.Militia || f.type === FigureType.Archer || f.type === FigureType.Elephant));
const cheb = (a: { x: number; y: number }, bx: number, by: number) => Math.max(Math.abs(a.x - bx), Math.abs(a.y - by));
/** Trại (2×2) tại (x, y) kề đường ngang y + 2, kho có `loads` kiện vũ khí; người làm đủ. Sim không có dân nên numWorkers giữ tay mỗi ngày. */
function camp(s: GameState, kind: string, x: number, y: number, loads: number) {
  for (let i = x - 1; i <= x + 3; i++) road(s, i, y + 2);
  const b = build(s, kind, x, y);
  b.store[Resource.Weapons] = loads * UNITS_PER_LOAD;
  return b;
}
const keepWorkers = (s: GameState, ...bs: GameState['buildings'][number][]) => { for (const b of bs) b.numWorkers = BUILDING_DEFS[b.type].workers; };
const enemy = (s: GameState, x: number, y: number, source = 1) => { const e = createFigure(s, FigureType.Enemy, gridOffset(x, y), 0)!; e.hp = WAR.enemyHp; e.loads = WAR.raidBudget; e.boatHome = gridOffset(x, y); e.route = source; s.war.enemiesAlive++; return e; };

describe('đội quân: sinh ở trại, đứng đội hình, điều quân tới ô gác, về trại', () => {
  it('trại lính có vũ khí sinh 4 lính đứng quanh cửa; squadGoto đưa cả đội tới ô gác; squadReturn về cửa; ô không hợp lệ bị từ chối', () => {
    const s = flat();
    const b = camp(s, 'barracks', 40, 40, 4);
    const door = roadAccess(s.grid, b);
    expect(door).toBeGreaterThanOrEqual(0);
    for (let d = 0; d < 6; d++) { keepWorkers(s, b); days(s, 1); }
    expect(squad(s, b.id).length).toBe(squadKind(BuildingType.Barracks).max);
    expect(b.store[Resource.Weapons]).toBe(0);
    expect(squadAnchor(s, b)).toBe(door);
    for (const f of squad(s, b.id)) expect(cheb(f, offsetX(door), offsetY(door))).toBeLessThanOrEqual(1);
    // điều quân tới ô đất trống cách 10 ô: cả đội đi tới, đứng đội hình quanh ô gác
    applyCommand(s, { type: 'squadGoto', buildingId: b.id, x: 52, y: 44 });
    expect(b.post).toBe(gridOffset(52, 44));
    for (let d = 0; d < 6; d++) { keepWorkers(s, b); days(s, 1); }
    const slots = new Set<number>();
    for (const f of squad(s, b.id)) { expect(cheb(f, 52, 44)).toBeLessThanOrEqual(1); slots.add(gridOffset(f.x, f.y)); }
    expect(slots.size).toBe(4); // mỗi lính một ô đội hình
    expect(formationSlot(s, gridOffset(52, 44), 0)).toBe(gridOffset(52, 44));
    // ô nước / ô có công trình: không nhận
    s.grid.terrain[gridOffset(60, 60)] = T_WATER;
    applyCommand(s, { type: 'squadGoto', buildingId: b.id, x: 60, y: 60 });
    applyCommand(s, { type: 'squadGoto', buildingId: b.id, x: 40, y: 40 });
    expect(b.post).toBe(gridOffset(52, 44));
    expect(s.events.some((e) => e.startsWith('Không điều quân'))).toBe(true);
    // về trại
    applyCommand(s, { type: 'squadReturn', buildingId: b.id });
    expect(b.post).toBe(-1);
    for (let d = 0; d < 6; d++) { keepWorkers(s, b); days(s, 1); }
    for (const f of squad(s, b.id)) expect(cheb(f, offsetX(door), offsetY(door))).toBeLessThanOrEqual(1);
  });

  it('đội chỉ đánh giặc trong tầm quanh ô gác (không đuổi giặc xa), giặc chết để lại xác rồi xác biến mất', () => {
    const s = flat();
    const b = camp(s, 'barracks', 40, 40, 4);
    for (let d = 0; d < 6; d++) { keepWorkers(s, b); days(s, 1); }
    applyCommand(s, { type: 'squadGoto', buildingId: b.id, x: 50, y: 40 });
    for (let d = 0; d < 4; d++) { keepWorkers(s, b); days(s, 1); }
    // giặc xa hơn engageRange tính từ ô gác: đứng yên bên một đoạn thành (phá thành) — lính không rời chỗ gác
    build(s, 'earthWall', 50 + WAR.engageRange + 5, 40);
    const far = enemy(s, 50 + WAR.engageRange + 6, 40);
    far.mode = FigureMode.Idle; far.destBuildingId = s.buildings.at(-1)!.id;
    keepWorkers(s, b); ticks(s, 30);
    for (const f of squad(s, b.id)) expect(cheb(f, 50, 40)).toBeLessThanOrEqual(1);
    far.hp = 0; ticks(s, 2); // dọn
    // giặc trong tầm (cách ô gác 6 ô), đứng phá một đoạn thành: lính tới đánh, hạ, để lại xác
    build(s, 'earthWall', 57, 40);
    const near = enemy(s, 58, 40);
    near.mode = FigureMode.Idle; near.destBuildingId = s.buildings.at(-1)!.id;
    let killedAt = -1;
    for (let t = 0; t < 400 && killedAt < 0; t++) { keepWorkers(s, b); tick(s); if (near.type !== FigureType.Enemy) killedAt = t; }
    expect(killedAt).toBeGreaterThan(0);
    expect(s.events.some((e) => e.startsWith('Lính hạ một tên giặc'))).toBe(true);
    const corpses = s.figures.filter((f) => f.type === FigureType.Corpse);
    expect(corpses.length).toBeGreaterThanOrEqual(1);
    expect(corpses.some((c) => c.route === CORPSE_ENEMY)).toBe(true);
    // lính quay về ô gác; xác tan sau corpseTicks (8 ngày)
    for (let d = 0; d < 9; d++) { keepWorkers(s, b); days(s, 1); }
    for (const f of squad(s, b.id)) expect(cheb(f, 50, 40)).toBeLessThanOrEqual(1);
    expect(count(s, FigureType.Corpse)).toBe(0); // xác đã tan sau corpseTicks
    // lính chết cũng để lại xác
    const victim = squad(s, b.id)[0];
    victim.hp = 0; keepWorkers(s, b); tick(s);
    expect(s.figures.some((f) => f.type === FigureType.Corpse && f.route === CORPSE_MILITIA)).toBe(true);
    expect(squad(s, b.id).length).toBe(3);
  });
});

describe('cung thủ và voi trận', () => {
  it('cung thủ bắn giặc cách 2–3 ô không bị đánh lại; bị áp sát thì đòn chia đôi và trúng đòn', () => {
    const s = flat();
    const c = camp(s, 'archerCamp', 40, 40, 1);
    for (let d = 0; d < 3; d++) { keepWorkers(s, c); days(s, 1); }
    const a = squad(s, c.id)[0];
    expect(a.type).toBe(FigureType.Archer); expect(a.hp).toBe(WAR.archerHp);
    // gọi thẳng hành vi với giặc đặt sẵn: cách 3 ô theo trục
    applyCommand(s, { type: 'squadGoto', buildingId: c.id, x: a.x, y: a.y });
    const e = enemy(s, a.x + 3, a.y);
    for (let i = 0; i < WAR.hitEveryTicks; i++) updateSoldier(s, a);
    expect(e.hp).toBe(WAR.enemyHp - WAR.archerDamage);
    expect(a.hp).toBe(WAR.archerHp);
    expect(a.waitTicks).toBe(1); // cờ đang đánh
    // áp sát
    e.x = a.x + 1; e.nx = e.x; e.hp = WAR.enemyHp;
    for (let i = 0; i < WAR.hitEveryTicks; i++) updateSoldier(s, a);
    expect(e.hp).toBe(WAR.enemyHp - Math.ceil(WAR.archerDamage / 2));
    expect(a.hp).toBe(WAR.archerHp - WAR.enemyDamage);
  });

  it('tàu voi cần phẩm hàm 4, không cần vũ khí: huấn luyện elephantTrainDays ngày ra một voi (tối đa perStable), voi đi chậm hơn người', () => {
    const s = flat();
    for (let i = 39; i <= 43; i++) road(s, i, 42);
    const n0 = s.buildings.length;
    applyCommand(s, { type: 'build', kind: 'elephantStable', x: 40, y: 40 });
    expect(s.buildings.length).toBe(n0); // thiếu phẩm hàm
    s.court.rank = 4;
    const st = build(s, 'elephantStable', 40, 40);
    for (let d = 0; d < WAR.elephantTrainDays - 2; d++) { keepWorkers(s, st); days(s, 1); }
    expect(count(s, FigureType.Elephant)).toBe(0);
    for (let d = 0; d < 4; d++) { keepWorkers(s, st); days(s, 1); }
    expect(count(s, FigureType.Elephant)).toBe(1);
    const el = s.figures.find((f) => f.type === FigureType.Elephant)!;
    expect(el.hp).toBe(WAR.elephantHp);
    expect(ticksPerTile(el)).toBe(WAR.elephantTicksPerTile);
    expect(ticksPerTile(el)).toBeGreaterThan(TICKS_PER_TILE);
    for (let d = 0; d < WAR.elephantTrainDays + 4; d++) { keepWorkers(s, st); days(s, 1); }
    expect(count(s, FigureType.Elephant)).toBe(WAR.perStable);
    expect(s.events.some((e) => e.startsWith('Tàu voi huấn luyện xong'))).toBe(true);
  });
});

describe('chòi canh biên, giặc cướp kho, snapshot, lưu nạp', () => {
  it('chòi canh có người gác trong tầm quanh mép giặc vào → báo sớm thêm một tháng', () => {
    const s = flat();
    expect(watchtowerCovers(s, 'south')).toBe(false);
    expect(warningLead(s, 'south')).toBe(WAR.warningMonths);
    const at = invasionEntry(s, 'south');
    const tx = offsetX(at), ty = offsetY(at) - 10;
    road(s, tx - 1, ty); road(s, tx + 1, ty);
    const t = build(s, 'watchtower', tx, ty);
    expect(watchtowerCovers(s, 'south')).toBe(true);
    expect(warningLead(s, 'south')).toBe(WAR.warningMonths + WAR.watchtowerBonusMonths);
    t.numWorkers = 0;
    expect(watchtowerCovers(s, 'south')).toBe(false);
    t.numWorkers = 2;
    // đợt giặc 3 tháng nữa: không chòi thì chưa báo; có chòi thì báo ngay đầu tháng
    s.war.invasions.push({ year: 1, month: 1 + WAR.warningMonths + 1, source: 'south', size: 5, warned: false, done: false });
    s.war.invasions.push({ year: 1, month: 1 + WAR.warningMonths + 1, source: 'north', size: 5, warned: false, done: false });
    keepWorkers(s, t); days(s, 1);
    expect(s.war.invasions[0].warned).toBe(true);
    expect(s.war.invasions[1].warned).toBe(false);
    expect(s.events.some((e) => e.startsWith('Chòi canh báo sớm'))).toBe(true);
    // bảng Quân sự: tin giặc đã báo có ô mép vào và cờ chòi canh
    const snap = takeSnapshot(s, false);
    expect(snap.city.war.incoming.length).toBe(1);
    expect(snap.city.war.incoming[0]).toMatchObject({ source: 'south', x: offsetX(at), y: offsetY(at), watched: true, months: WAR.warningMonths + 1 });
  });

  it('giặc nhắm vựa có hàng trước, cướp một kiện (không đốt) rồi đi tiếp; snapshot ghi nguồn giặc, kiện cướp và cờ đánh nhau', () => {
    const s = flat();
    // nhà gần giặc hơn, vựa xa hơn (nhưng trong 2× khoảng cách) có 2 kiện lúa
    for (let i = 60; i <= 74; i++) road(s, i, 50);
    const h = build(s, 'house', 66, 49); h.population = 5; h.level = 2; // cách giặc 8 ô
    const g = build(s, 'granary', 70, 46); g.store[Resource.Rice] = 2 * UNITS_PER_LOAD; // tâm cách 13 ô × 0,5 = 6,5 < 8 → ưu tiên
    const e = enemy(s, 58, 50, 2);
    for (let t = 0; t < 3000 && e.resource === Resource.None && e.type === FigureType.Enemy; t++) { keepWorkers(s, g); tick(s); }
    expect(e.resource).toBe(Resource.Rice);
    expect(g.store[Resource.Rice]).toBe(UNITS_PER_LOAD);
    expect(g.type).toBe(BuildingType.Granary); // không bị đốt
    expect(e.loads).toBe(WAR.raidBudget - 1);
    expect(s.events.some((ev) => ev.startsWith('Giặc cướp một kiện'))).toBe(true);
    const snap = takeSnapshot(s, false);
    expect(FIG_STRIDE).toBe(8);
    const n = snap.figures.length / FIG_STRIDE;
    let found = false;
    for (let i = 0; i < n; i++) if (snap.figures[i * FIG_STRIDE + 5] === FigureType.Enemy) { found = true; expect(snap.figures[i * FIG_STRIDE + 6]).toBe(Resource.Rice); expect(snap.figures[i * FIG_STRIDE + 7] & 15).toBe(2); }
    expect(found).toBe(true);
    // cờ đánh nhau: lính đang đổi đòn
    const b = camp(s, 'barracks', 40, 40, 1);
    for (let d = 0; d < 3; d++) { keepWorkers(s, b); days(s, 1); }
    const m = squad(s, b.id)[0];
    const foe = enemy(s, m.x + 1, m.y);
    updateSoldier(s, m);
    const snap2 = takeSnapshot(s, false);
    const n2 = snap2.figures.length / FIG_STRIDE;
    let fighting = 0;
    for (let i = 0; i < n2; i++) if (snap2.figures[i * FIG_STRIDE + 5] === FigureType.Militia && snap2.figures[i * FIG_STRIDE + 7] & FIG_FIGHTING) fighting++;
    expect(fighting).toBe(1);
    void foe;
  });

  it('ô gác lưu / nạp; bản lưu cũ không có post → −1; bảng công trình có thông tin đội', () => {
    const s = flat();
    const b = camp(s, 'barracks', 40, 40, 2);
    applyCommand(s, { type: 'squadGoto', buildingId: b.id, x: 50, y: 50 });
    const json = toJson(s);
    const r = fromJson(json);
    expect(r.buildings[b.id].post).toBe(gridOffset(50, 50));
    expect(r.buildings[b.id].type).toBe(BuildingType.Barracks);
    const old = JSON.parse(json) as { version: number; state: { buildings: { post?: number }[] } };
    for (const ob of old.state.buildings) delete ob.post;
    old.version = 2;
    const r2 = fromJson(JSON.stringify(old));
    expect(r2.buildings[b.id].post).toBe(-1);
    for (let d = 0; d < 3; d++) { keepWorkers(s, b); days(s, 1); }
    const snap = takeSnapshot(s, false, b.id);
    expect(snap.selected?.squad).toMatchObject({ kind: 'militia', count: 2, max: 4, post: { x: 50, y: 50 } });
    expect(snap.city.war.squads.length).toBe(1);
  });
});
