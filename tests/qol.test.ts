// QoL (sau M6c): lớp phủ thông tin, công trình có vấn đề.
import { describe, expect, it } from 'vitest';
import { applyCommand, takeSnapshot, tick } from '../src/sim';
import { createScenario } from '../src/sim/scenario/loader';
import { buildCourtTown, buildStressTown, demoPriorities } from '../src/sim/scenario/demo';
import { BuildingType, DAYS_PER_MONTH, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { buildingProblem, computeOverlay, OVERLAY_MODES, problemAnchors } from '../src/sim/overlay';
import { GRID_SIZE, gridOffset } from '../src/sim/map/grid';

const runDays = (s: GameState, days: number) => { for (let i = 0; i < days * TICKS_PER_DAY; i++) tick(s); };
const N = GRID_SIZE * GRID_SIZE;

describe('lớp phủ thông tin', () => {
  it('mỗi chế độ tính ra giá trị 0 / 1–100 xấu / 101–200 tốt / 201; nước, lương thực, thuế theo nhà', () => {
    const s = createScenario('sonNam', 3, true);
    s.treasury = 1e6; buildCourtTown(s); demoPriorities(s); buildStressTown(s);
    runDays(s, DAYS_PER_MONTH * 2);
    const out = new Uint8Array(N);
    for (const m of OVERLAY_MODES) {
      computeOverlay(s, m.key, out);
      let nonzero = 0, over = 0;
      for (let i = 0; i < N; i++) { if (out[i]) nonzero++; if (out[i] > 201) over++; }
      expect(over).toBe(0);
      if (m.key === '' || m.key === 'flood') expect(nonzero).toBe(0);
      else expect(nonzero, m.key).toBeGreaterThan(0);
    }
    // nước: nhà có giếng → tốt, nhà không → xấu; giếng → vàng
    computeOverlay(s, 'water', out);
    const well = s.buildings.find((b) => b.type === BuildingType.Well || b.type === BuildingType.BrickWell)!;
    expect(out[gridOffset(well.x, well.y)]).toBe(201);
    const withWater = s.buildings.find((b) => b.type === BuildingType.House && b.population > 0 && b.water > 0);
    const noWater = s.buildings.find((b) => b.type === BuildingType.House && b.population > 0 && b.water === 0);
    if (withWater) expect(out[gridOffset(withWater.x, withWater.y)]).toBeGreaterThan(100);
    if (noWater) { const v = out[gridOffset(noWater.x, noWater.y)]; expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(100); }
    // độ hấp dẫn theo ô đất
    computeOverlay(s, 'desirability', out);
    const g = s.grid; let seenBad = false, seenGood = false;
    for (let i = 0; i < N; i++) { if (g.desirability[i] < 0 && out[i]) seenBad = true; if (g.desirability[i] > 0 && out[i] > 100) seenGood = true; }
    expect(seenBad && seenGood).toBe(true);
    // snapshot mang lớp phủ khi bật, không khi tắt
    expect(takeSnapshot(s, false).overlay).toBeUndefined();
    expect(takeSnapshot(s, false, 0, 0, 'fire').overlay).toHaveLength(N);
    expect(takeSnapshot(s, false, 0, 0, 'flood').overlay).toBeUndefined();
  }, 30000);
  it('công trình có vấn đề: không kề đường, không có người làm, hết nguyên liệu; biểu tượng theo ô neo', () => {
    const s = createScenario('sonNam', 3, true);
    s.treasury = 1e6;
    applyCommand(s, { type: 'build', kind: 'kiln', x: 110, y: 20 }); // không đường, không nhà
    const kiln = s.buildings.find((b) => b.type === BuildingType.Kiln)!;
    expect(buildingProblem(s, kiln)).toBe('không kề đường');
    for (let x = 108; x <= 114; x++) applyCommand(s, { type: 'build', kind: 'road', x, y: 22 });
    expect(buildingProblem(s, kiln)).toBe('không có nhà ở gần để mộ phu');
    kiln.housesCovered = 10;
    expect(buildingProblem(s, kiln)).toBe('không có người làm');
    kiln.numWorkers = 10;
    expect(buildingProblem(s, kiln)).toBe('hết nguyên liệu');
    kiln.store[Resource.Clay] = 100;
    expect(buildingProblem(s, kiln)).toBeNull();
    kiln.fireRisk = 90;
    expect(buildingProblem(s, kiln)).toBe('sắp cháy');
    kiln.fireRisk = 0;
    const anchors = problemAnchors(s);
    expect([...anchors]).not.toContain(gridOffset(kiln.x, kiln.y));
    kiln.numWorkers = 0;
    expect([...problemAnchors(s)]).toContain(gridOffset(kiln.x, kiln.y));
    expect(takeSnapshot(s, false).problems).toContain(gridOffset(kiln.x, kiln.y));
    // nhà, đê, thành không bị tính
    applyCommand(s, { type: 'build', kind: 'house', x: 108, y: 23 });
    const house = s.buildings.find((b) => b.type === BuildingType.House)!;
    expect(buildingProblem(s, house)).toBeNull();
  });
});

describe('đặt công trình: lý do, khung xanh / đỏ, hoàn tác, kéo vùng', () => {
  it('placementCheck (render dùng) khớp canPlaceBuilding của sim trên mọi loại và ô thử', async () => {
    const { canPlaceBuilding, placementError } = await import('../src/sim/buildings/spawn');
    const { placementCheck } = await import('../src/sim/buildings/placement');
    const { BUILDING_KEYS, BUILDING_DEFS } = await import('../src/sim/buildings/defs');
    for (const key of ['langVenSong', 'thangLong', 'sonNam']) {
      const s = createScenario(key, 11, key === 'sonNam');
      s.treasury = 1e6; s.court.rank = 8;
      if (key === 'sonNam') { buildCourtTown(s); }
      const v = { terrain: s.grid.terrain, elevation: s.grid.elevation, bType: s.grid.bType };
      let checked = 0;
      for (const [kind, type] of BUILDING_KEYS) {
        if (type === BuildingType.None || type === BuildingType.Ruins) continue;
        for (let i = 0; i < 120; i++) {
          const x = (i * 37 + type * 11) % GRID_SIZE, y = (i * 53 + type * 7) % GRID_SIZE;
          const simOk = canPlaceBuilding(s.grid, type, x, y);
          const why = placementCheck(v, kind, type, x, y);
          if (BUILDING_DEFS[type] && (type === BuildingType.Dike || type === BuildingType.Sluice) && (s.grid.terrain[gridOffset(x, y)] & 4)) continue; // đê lên đê: tôn cao, sim xử riêng
          expect(why === null, `${key} ${kind} (${x},${y}) sim=${simOk} why=${why}`).toBe(simOk);
          expect(placementError(s, kind, x, y) === null).toBe(simOk);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(1000);
    }
    // tiền và phẩm hàm
    const s = createScenario('langVenSong', 2);
    expect(placementError(s, 'quocTuGiam', 80, 80)).toMatch(/phẩm hàm/);
    s.treasury = 10;
    expect(placementError(s, 'dinh', 80, 80)).toMatch(/không đủ tiền/);
    expect(placementError(s, 'road', 150, 100)).toMatch(/chưa cấp/);
    expect(placementError(s, 'road', 80, 80)).toBeNull();
  });
  it('hoàn tác bỏ công trình và đường vừa đặt, trả tiền; nhà đã có dân thì giữ', async () => {
    const { undoBefore, undoAfter, applyUndo } = await import('../src/sim/undo');
    const s = createScenario('sonNam', 3, true);
    const t0 = s.treasury;
    const before = undoBefore(s);
    for (let x = 100; x <= 110; x++) applyCommand(s, { type: 'build', kind: 'road', x, y: 30 });
    applyCommand(s, { type: 'build', kind: 'dinh', x: 100, y: 27 });
    applyCommand(s, { type: 'build', kind: 'house', x: 104, y: 29 });
    applyCommand(s, { type: 'build', kind: 'house', x: 105, y: 29 });
    const rec = undoAfter(s, before)!;
    expect(rec.buildingIds).toHaveLength(3);
    expect(rec.roads).toHaveLength(11);
    expect(rec.cost).toBe(t0 - s.treasury);
    s.buildings[rec.buildingIds[2]].population = 5; // nhà đã có dân → giữ
    const n = applyUndo(s, rec);
    expect(n).toBe(2 + 11);
    expect(s.buildings.filter((b) => b.type !== BuildingType.None)).toHaveLength(1);
    expect(s.grid.terrain[gridOffset(100, 30)] & 2).toBe(0);
    expect(s.treasury).toBe(t0 - 10); // chỉ còn tiền của nhà giữ lại (lều 10 quan)
    expect(undoAfter(s, undoBefore(s))).toBeNull();
  });
  it('rectPath phủ đúng hình chữ nhật hai góc bất kỳ', async () => {
    const { rectPath, RECT_TOOLS } = await import('../src/render/line');
    expect(rectPath(3, 3, 3, 3)).toEqual([[3, 3]]);
    expect(rectPath(5, 2, 2, 4)).toHaveLength(12);
    expect(rectPath(5, 2, 2, 4)[0]).toEqual([2, 2]);
    expect([...RECT_TOOLS]).toContain('house');
    expect([...RECT_TOOLS]).toContain('raze');
  });
});
