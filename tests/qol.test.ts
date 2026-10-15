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
