// Điểm vào của mô phỏng. Thuần TypeScript: không Pixi, không DOM, chạy được trong Worker lẫn trong test.
import { createRng } from './rng';
import { createGrid, GRID_SIZE, gridOffset, T_WATER } from './map/grid';
import { generateTerrain, type TerrainOptions } from './map/terrain';
import { BuildingType, FigureType, type GameState } from './state';
import { newBuilding } from './state';
import { tick } from './tick';
import { applyCommand, type Command } from './commands';

export { tick, applyCommand, GRID_SIZE };
export type { GameState, Command };

export function createSim(seed: number, terrain: TerrainOptions = {}): GameState {
  const rng = createRng(seed);
  const grid = createGrid();
  generateTerrain(grid, rng, terrain);
  // cửa ngõ: ô đất đầu tiên ở mép trái tính từ giữa
  // cửa ngõ: ô đất gần mép trái nhất, ưu tiên hàng giữa; sông ở mép thì lùi vào trong
  let entry = gridOffset(0, GRID_SIZE / 2);
  outer: for (let x = 0; x < GRID_SIZE; x++) {
    for (let d = 0; d < GRID_SIZE / 2; d++) {
      const a = gridOffset(x, GRID_SIZE / 2 + d), b = gridOffset(x, GRID_SIZE / 2 - d);
      if (!(grid.terrain[a] & T_WATER)) { entry = a; break outer; }
      if (!(grid.terrain[b] & T_WATER)) { entry = b; break outer; }
    }
  }
  return {
    seed,
    rng,
    time: { tick: 0, day: 0, month: 0, year: 0, totalDays: 0 },
    grid,
    buildings: [newBuilding(0, BuildingType.None, 0, 0, 0)],
    figures: [{ id: 0, type: FigureType.None, mode: 0, x: 0, y: 0, nx: 0, ny: 0, progress: 0, prevOffset: -1, path: new Int32Array(0), pathIdx: 0, buildingId: 0, destBuildingId: 0, roamLength: 0, maxRoamLength: 0, returning: false, loads: 0, waitTicks: 0 }],
    freeFigures: [],
    entryOffset: entry,
    speed: 1,
    treasury: 5000,
    population: 0,
    housingCapacity: 0,
    migrationCooldown: 0,
    dirty: new Set(),
  };
}

/** Thông tin một ô cho UI hover. */
export interface TileInfo { type: BuildingType; level: number; population: number; food: number; stock: number; progress: number }

/** Snapshot gửi sang render. Lưới gửi trọn lần đầu, sau đó chỉ ô đã đổi; figure gửi mỗi lần. */
export interface Snapshot {
  time: GameState['time'];
  speed: number;
  treasury: number;
  population: number;
  housingCapacity: number;
  full?: { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array; bLevel: Uint8Array };
  changed?: { offsets: Uint32Array; terrain: Uint16Array; bType: Uint8Array; bLevel: Uint8Array };
  /** [x, y, nx, ny, progress, type] × n */
  figures: Int16Array;
}

export const FIG_STRIDE = 6;

export function takeSnapshot(s: GameState, full: boolean): Snapshot {
  let n = 0;
  for (const f of s.figures) if (f.type !== FigureType.None) n++;
  const figures = new Int16Array(n * FIG_STRIDE);
  let k = 0;
  for (const f of s.figures) {
    if (f.type === FigureType.None) continue;
    figures[k++] = f.x; figures[k++] = f.y; figures[k++] = f.nx; figures[k++] = f.ny; figures[k++] = f.progress; figures[k++] = f.type;
  }
  const snap: Snapshot = {
    time: { ...s.time },
    speed: s.speed,
    treasury: s.treasury,
    population: s.population,
    housingCapacity: s.housingCapacity,
    figures,
  };
  const g = s.grid;
  if (full) {
    snap.full = { terrain: g.terrain.slice(), elevation: g.elevation.slice(), bType: g.bType.slice(), bLevel: g.bLevel.slice() };
  } else if (s.dirty.size) {
    const m = s.dirty.size;
    const offsets = new Uint32Array(m), terrain = new Uint16Array(m), bType = new Uint8Array(m), bLevel = new Uint8Array(m);
    let i = 0;
    for (const o of s.dirty) { offsets[i] = o; terrain[i] = g.terrain[o]; bType[i] = g.bType[o]; bLevel[i] = g.bLevel[o]; i++; }
    snap.changed = { offsets, terrain, bType, bLevel };
  }
  s.dirty.clear();
  return snap;
}

export function tileInfo(s: GameState, x: number, y: number): TileInfo | null {
  const id = s.grid.buildingId[gridOffset(x, y)];
  if (!id) return null;
  const b = s.buildings[id];
  return { type: b.type, level: b.level, population: b.population, food: b.food, stock: b.stock, progress: b.progress };
}
