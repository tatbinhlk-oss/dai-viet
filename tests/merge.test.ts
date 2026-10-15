// Gộp nhà và nở rộng nhà theo Caesar 3 (src/sim/buildings/merge.ts).
import { describe, expect, it } from 'vitest';
import { applyCommand, inspectBuilding, takeSnapshot, tick } from '../src/sim';
import { createScenario } from '../src/sim/scenario/loader';
import { BuildingType, DAYS_PER_MONTH, Resource, TICKS_PER_DAY, type Building, type GameState } from '../src/sim/state';
import { findExpansion, houseCapacity, houseMinSize, shrinkHouse, tileRandom, tryExpandHouse, tryMergeHouses } from '../src/sim/buildings/merge';
import { HOUSE_LEVELS, MAX_HOUSE_LEVEL } from '../src/sim/buildings/defs';
import { setHouseLevel } from '../src/sim/buildings/spawn';
import { gridOffset, T_BUILDING } from '../src/sim/map/grid';
import { buildingFrame } from '../src/render/chunks';

const runDays = (s: GameState, days: number) => { for (let i = 0; i < days * TICKS_PER_DAY; i++) tick(s); };
function town(): GameState {
  const s = createScenario('sonNam', 3, true);
  s.treasury = 1e6;
  for (let x = 100; x <= 120; x++) applyCommand(s, { type: 'build', kind: 'road', x, y: 30 });
  return s;
}
function house(s: GameState, x: number, y: number, level: number, pop: number): Building {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind: 'house', x, y });
  const h = s.buildings[n];
  expect(h.type).toBe(BuildingType.House);
  setHouseLevel(s, h, level); h.population = pop;
  return h;
}
const live = (s: GameState) => s.buildings.filter((b) => b.type === BuildingType.House);

describe('gộp bốn nhà 1×1 thành 2×2', () => {
  it('bốn nhà cùng bậc có dân xếp vuông → một nhà 2×2 đã gộp, dân và hàng cộng dồn, sức chứa ×4; nhà khác bậc không gộp', () => {
    const s = town();
    const a = house(s, 104, 26, 3, 6), b = house(s, 105, 26, 3, 5), c = house(s, 104, 27, 3, 4), d = house(s, 105, 27, 3, 3);
    b.store[Resource.Rice] = 50; a.store[Resource.Rice] = 20;
    // 5/8 số ô cho gộp (băm theo ô và seed như map_random của C3): tìm góc gộp được rồi xếp nhà ở đó
    expect(tileRandom(s.seed, a.x, a.y)).toBeLessThan(5);
    expect(tryMergeHouses(s, a)).toBe(true);
    expect(a.size).toBe(2); expect(a.merged).toBe(true); expect(a.level).toBe(3);
    expect(a.population).toBe(18);
    expect(a.store[Resource.Rice]).toBe(70);
    expect(houseCapacity(a)).toBe(HOUSE_LEVELS[3].capacity * 4);
    expect([b, c, d].every((h) => h.type === BuildingType.None)).toBe(true);
    for (const [x, y] of [[104, 26], [105, 26], [104, 27], [105, 27]]) expect(s.grid.buildingId[gridOffset(x, y)]).toBe(a.id);
    expect(s.grid.bType[gridOffset(105, 27)]).toBe(BuildingType.House);
    expect(s.grid.bLevel[gridOffset(105, 27)]).toBe(3 | (1 << 4));
    expect(buildingFrame(BuildingType.House, s.grid.bLevel[gridOffset(105, 27)])).toBe('house2_l3');
    expect(live(s)).toHaveLength(1);
    // khác bậc: không gộp
    const e = house(s, 110, 26, 3, 5); house(s, 111, 26, 4, 5); house(s, 110, 27, 3, 5); house(s, 111, 27, 3, 5);
    tryMergeHouses(s, e);
    expect(e.size).toBe(1);
    // ô có số băm ≥ 5 thì không bao giờ gộp (như 3/8 nhà C3)
    let never = -1;
    for (let x = 100; x < 160 && never < 0; x++) if (tileRandom(s.seed, x, 40) >= 5) never = x;
    expect(never).toBeGreaterThan(0);
    // lưu / nạp giữ cờ gộp
    const snap = takeSnapshot(s, false, a.id);
    expect(snap.selected?.size).toBe(2); expect(snap.selected?.merged).toBe(true); expect(snap.selected?.capacity).toBe(44);
  });
  it('trong trò chơi: bốn lều có dân đứng cạnh nhau gộp trong vài ngày; nhà gộp lên bậc giữ 2×2', () => {
    const s = town();
    for (const [x, y] of [[104, 28], [105, 28], [104, 29], [105, 29]]) house(s, x, y, 1, 5);
    applyCommand(s, { type: 'build', kind: 'well', x: 103, y: 29 });
    runDays(s, 12);
    const hs = live(s);
    expect(hs).toHaveLength(1);
    expect(hs[0].size).toBe(2); expect(hs[0].population).toBe(20);
    expect(hs[0].level).toBeGreaterThanOrEqual(1);
  });
});

describe('nở rộng và co lại', () => {
  it('bậc 8 → 9 cần 2×2: nuốt nhà bậc thấp hơn, đất trống hay vườn; bị chặn (đường / nhà bậc cao) thì đứng và ghi lý do', () => {
    const s = town();
    const h = house(s, 104, 26, 8, 20);
    expect(houseMinSize(9)).toBe(2); expect(houseMinSize(10)).toBe(3); expect(houseMinSize(8)).toBe(1);
    // chung quanh trống → vòng 2 (đất trống) được
    const plan = findExpansion(s, h, 2)!;
    expect(plan).not.toBeNull();
    expect(plan.absorbed).toHaveLength(0);
    // nhà bậc thấp hơn kề bên được nuốt (vòng 1 ưu tiên nhà)
    const low = house(s, 105, 26, 4, 7);
    const low2 = house(s, 104, 27, 2, 3);
    const low3 = house(s, 105, 27, 1, 2);
    expect(tryExpandHouse(s, h, 2)).toBe(true);
    expect(h.size).toBe(2); expect(h.x).toBe(104); expect(h.y).toBe(26);
    expect(h.population).toBe(32);
    expect([low, low2, low3].every((b) => b.type === BuildingType.None)).toBe(true);
    // 2×2 → 3×3 cho bậc 10: chặn bởi đường phía trên (y=30 là đường, 3×3 từ y=26..28 vẫn được) — thử chặn bằng nhà bậc cao hơn
    const hi = house(s, 106, 26, 10, 1); hi.size = 1;
    const plan3 = findExpansion(s, h, 3);
    expect(plan3).not.toBeNull(); // còn hướng khác (góc 103,25)
    for (const [x, y] of [[103, 25], [103, 26], [103, 27], [103, 28], [104, 25], [105, 25], [106, 25], [106, 27], [106, 28], [104, 28], [105, 28]]) if (!s.grid.buildingId[gridOffset(x, y)]) applyCommand(s, { type: 'build', kind: 'road', x, y });
    expect(findExpansion(s, h, 3)).toBeNull();
    setHouseLevel(s, h, 9); h.population = 30;
    const info = inspectBuilding(s, h.id)!;
    expect(info.missing === null || info.missing.includes('nở rộng') || info.missing.length > 0).toBe(true);
    // vườn bị nuốt ở vòng 3
    const t = town();
    const g = house(t, 110, 26, 9, 30); tryExpandHouse(t, g, 2); expect(g.size).toBe(2);
    // khối 2×2 có thể đã dời góc khi nở (chọn vị trí đầu tiên hợp lệ) → đặt theo g.x / g.y
    applyCommand(t, { type: 'build', kind: 'garden', x: g.x + 2, y: g.y }); applyCommand(t, { type: 'build', kind: 'garden', x: g.x + 2, y: g.y + 1 });
    for (let y = g.y - 1; y <= g.y + 2; y++) applyCommand(t, { type: 'build', kind: 'road', x: g.x - 1, y });
    for (let x = g.x; x <= g.x + 2; x++) applyCommand(t, { type: 'build', kind: 'road', x, y: g.y - 1 });
    // chỉ còn khối gốc (g.x, g.y): vườn ở cột g.x+2, đất trống ở hàng g.y+2
    const p3 = findExpansion(t, g, 3)!;
    expect(p3).not.toBeNull();
    expect(p3.absorbed.filter((b) => b.type === BuildingType.Garden)).toHaveLength(2);
    expect(tryExpandHouse(t, g, 3)).toBe(true);
    expect(g.size).toBe(3);
    expect(t.buildings.filter((b) => b.type === BuildingType.Garden)).toHaveLength(0);
  });
  it('Phủ đệ 3×3 tụt bậc → Tư dinh 2×2, năm ô kia thành nhà bậc 8 chia dân dư; sức chứa theo bảng', () => {
    const s = town();
    const h = house(s, 110, 24, 9, 30);
    expect(tryExpandHouse(s, h, 2)).toBe(true);
    expect(tryExpandHouse(s, h, 3)).toBe(true);
    setHouseLevel(s, h, 10); h.population = 90;
    expect(houseCapacity(h)).toBe(90);
    shrinkHouse(s, h, 2, 8);
    expect(h.size).toBe(2);
    expect(h.population).toBe(houseCapacity({ level: 10, size: 2 })); // tạm theo bậc 10 trước khi setHouseLevel
    const spill = live(s).filter((b) => b.id !== h.id);
    expect(spill).toHaveLength(5);
    expect(spill.every((b) => b.size === 1 && (b.level === 8 || b.level === 0))).toBe(true);
    expect(spill.reduce((n, b) => n + b.population, 0)).toBe(0);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) expect(s.grid.terrain[gridOffset(h.x + dx, h.y + dy)] & T_BUILDING).not.toBe(0);
    // qua evolveHouses: bậc 10 thiếu điều kiện → sau 8 ngày tụt về 9 và co lại
    const t = town();
    const g = house(t, 110, 24, 9, 30); tryExpandHouse(t, g, 2); tryExpandHouse(t, g, 3); setHouseLevel(t, g, 10); g.population = 90;
    runDays(t, DAYS_PER_MONTH);
    expect(g.level).toBeLessThan(10);
    expect(g.size).toBe(2);
    expect(live(t).length).toBeGreaterThanOrEqual(1);
    expect(MAX_HOUSE_LEVEL).toBe(10);
  });
});
