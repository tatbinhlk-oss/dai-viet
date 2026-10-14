// M6-0: mọi loại công trình / bậc nhà / đê / loại walker đều có frame trong public/sheets với anchor (0.5, 1),
// công trình N×N rộng đúng N×64 px, footprint đúng; 4 hướng × 4 khung cho walker; xe / thuyền có bản đầy và kiện hàng theo loại.
import { describe, expect, it } from 'vitest';
import buildingsJson from '../public/sheets/buildings.json';
import groundJson from '../public/sheets/ground.json';
import figuresJson from '../public/sheets/figures.json';
import { BuildingType, FigureType, RES_COUNT } from '../src/sim/state';
import { BUILDING_DEFS, BUILDING_KEYS, HOUSE_LEVELS, RESOURCES } from '../src/sim/buildings/defs';
import { buildingFrame, dikeFrame } from '../src/render/chunks';
import type { SheetJson } from '../src/render/sheets';

const buildings = buildingsJson as unknown as SheetJson, ground = groundJson as unknown as SheetJson, figures = figuresJson as unknown as SheetJson;

describe('spritesheet', () => {
  it('công trình: frame đúng tên, rộng N×64, neo (0.5, 1), footprint N; nhà bậc 0–10; đống tro 1–3', () => {
    for (const [key, t] of BUILDING_KEYS) {
      if (t === BuildingType.None || t === BuildingType.House || t === BuildingType.Ruins || t === BuildingType.Dike || t === BuildingType.Sluice) continue;
      const f = buildings.frames[buildingFrame(t, 0)];
      expect(f, key).toBeDefined();
      expect(f.anchor).toEqual([0.5, 1]);
      expect(f.footprint).toBe(BUILDING_DEFS[t].size);
      expect(f.w).toBe(BUILDING_DEFS[t].size * 64);
      expect(f.h).toBeGreaterThan(BUILDING_DEFS[t].size * 32);
    }
    for (let l = 0; l < HOUSE_LEVELS.length; l++) {
      const f = buildings.frames[buildingFrame(BuildingType.House, l)];
      expect(f, `nhà bậc ${l}`).toBeDefined();
      expect([f.w, f.footprint, f.anchor]).toEqual([64, 1, [0.5, 1]]);
    }
    for (let n = 1; n <= 3; n++) expect(buildings.frames[buildingFrame(BuildingType.Ruins, n)]?.w).toBe(n * 64);
  });
  it('đất nền: cỏ theo cao độ, bãi bồi, nước, đường, ngập, đất trũng, đê 0–4 (có/không đường), cống đóng/mở', () => {
    for (const k of ['grass0', 'grass1', 'grass2', 'grass3', 'grass4', 'floodplain', 'water', 'road', 'floor', 'sunken', 'flooded', 'overlay_unprotected', 'overlay_protected', 'tree']) expect(ground.frames[k], k).toBeDefined();
    for (let h = 0; h <= 4; h++) {
      for (const road of [false, true]) expect(ground.frames[dikeFrame(BuildingType.Dike, h, road)], `đê ${h}`).toBeDefined();
      expect(ground.frames[dikeFrame(BuildingType.Sluice, h, false)], `cống ${h}`).toBeDefined();
      expect(ground.frames[dikeFrame(BuildingType.Sluice, h + 16, false)], `cống mở ${h}`).toBeDefined();
    }
    for (const f of Object.values(ground.frames)) { expect(f.w).toBe(64); expect(f.anchor).toEqual([0.5, 1]); }
  });
  it('walker: mọi loại có 4 hướng × 4 khung; xe bò, phu kho, đoàn xe, thuyền có bản đầy; kiện hàng theo loại', () => {
    const carriers = new Set(['cartPusher', 'warehouseman', 'convoy', 'boat']);
    for (const name of Object.keys(FigureType)) {
      const v = FigureType[name as keyof typeof FigureType];
      if (typeof v !== 'number' || v === FigureType.None) continue;
      const key = name[0].toLowerCase() + name.slice(1);
      for (const d of ['ne', 'se', 'sw', 'nw']) for (let f = 0; f < 4; f++) {
        expect(figures.frames[`${key}_${d}_${f}`], `${key}_${d}_${f}`).toBeDefined();
        expect(figures.frames[`${key}_${d}_${f}`].anchor).toEqual([0.5, 1]);
        if (carriers.has(key)) expect(figures.frames[`${key}_full_${d}_${f}`], `${key} đầy`).toBeDefined();
      }
    }
    for (let r = 1; r < RES_COUNT; r++) expect(figures.frames[`cargo_${RESOURCES[r].key}`], RESOURCES[r].key).toBeDefined();
  });
  it('sheet tạm được đánh dấu placeholder để UI bật "Hiện tên"', () => {
    expect(buildings.placeholder).toBe(true);
    expect(Object.values(buildings.frames).every((f) => f.placeholder)).toBe(true);
  });
});
