// Điểm vào của mô phỏng. Thuần TypeScript: không Pixi, không DOM, chạy được trong Worker lẫn trong test.
import { createRng } from './rng';
import { createGrid, GRID_SIZE } from './map/grid';
import { generateTerrain } from './map/terrain';
import { BuildingType, type GameState } from './state';
import { tick } from './tick';
import { applyCommand, type Command } from './commands';

export { tick, applyCommand, GRID_SIZE };
export type { GameState, Command };

export function createSim(seed: number): GameState {
  const rng = createRng(seed);
  const grid = createGrid();
  generateTerrain(grid, rng);
  return {
    seed,
    rng,
    time: { tick: 0, day: 0, month: 0, year: 0, totalDays: 0 },
    grid,
    buildings: [{ id: 0, type: BuildingType.None, x: 0, y: 0, size: 0, state: 0 }],
    speed: 1,
    treasury: 5000,
    population: 0,
    dirty: new Set(),
  };
}

/** Snapshot gửi sang render. Lưới gửi trọn lần đầu, sau đó chỉ ô đã đổi. */
export interface Snapshot {
  time: GameState['time'];
  speed: number;
  treasury: number;
  population: number;
  full?: { terrain: Uint16Array; elevation: Uint8Array };
  changed?: { offsets: Uint32Array; terrain: Uint16Array };
}

export function takeSnapshot(s: GameState, full: boolean): Snapshot {
  const snap: Snapshot = {
    time: { ...s.time },
    speed: s.speed,
    treasury: s.treasury,
    population: s.population,
  };
  if (full) {
    snap.full = { terrain: s.grid.terrain.slice(), elevation: s.grid.elevation.slice() };
  } else if (s.dirty.size) {
    const offsets = new Uint32Array(s.dirty.size);
    const terrain = new Uint16Array(s.dirty.size);
    let k = 0;
    for (const o of s.dirty) {
      offsets[k] = o;
      terrain[k] = s.grid.terrain[o];
      k++;
    }
    snap.changed = { offsets, terrain };
  }
  s.dirty.clear();
  return snap;
}
