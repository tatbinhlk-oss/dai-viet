// Dân đến / dân bỏ đi — figuretype/migrant.c của Julius. Đi bộ trên đất, không cần đường.
import { BuildingType, FigureType, type Building, type Figure, type GameState } from '../state';
import { gridOffset } from '../map/grid';
import { HOUSE_LEVELS } from '../buildings/defs';
import { setHouseLevel } from '../buildings/spawn';
import { createFigure, removeFigure } from './figure';
import { setWalkPath, step, StepResult } from './movement';

export function updateImmigrant(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  const house = s.buildings[f.destBuildingId];
  if (r === StepResult.PathDone && house.type === BuildingType.House) {
    const cap = HOUSE_LEVELS[Math.max(1, house.level)].capacity;
    const moved = Math.min(Math.max(0, cap - house.population), f.loads);
    if (moved > 0 && house.population === 0) house.happiness = s.sentiment;
    house.population += moved;
    if (house.level === 0 && house.population > 0) setHouseLevel(s, house, 1);
    f.loads -= moved;
  }
  removeFigure(s, f.id); // số dư (nhà hết chỗ / bị phá) → bỏ đi
}

/** Sinh nhóm dân ở cửa ngõ, đi bộ trên đất tới `house`. */
export function spawnImmigrants(s: GameState, house: Building, count: number): boolean {
  const f = createFigure(s, FigureType.Immigrant, s.entryOffset, 0);
  if (!f) return false;
  f.loads = count;
  f.destBuildingId = house.id;
  if (!setWalkPath(s, f, gridOffset(house.x, house.y), false)) { removeFigure(s, f.id); return false; }
  return true;
}

/** Dân bỏ đi: đi từ nhà ra cửa ngõ rồi biến mất (chỉ để nhìn; dân đã trừ khỏi nhà). */
export function spawnEmigrants(s: GameState, house: Building, count: number): void {
  const f = createFigure(s, FigureType.Emigrant, gridOffset(house.x, house.y), 0);
  if (!f) return;
  f.loads = count;
  if (!setWalkPath(s, f, s.entryOffset, false)) removeFigure(s, f.id);
}

export function updateEmigrant(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  removeFigure(s, f.id);
}
