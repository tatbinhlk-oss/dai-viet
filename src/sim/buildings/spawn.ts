// Đặt và phá đường / công trình. Mọi thay đổi lưới phải đi qua đây để dirty được ghi nhận.
import { BuildingType, type GameState, newBuilding } from '../state';
import { gridOffset, hasFlag, inBounds, isBuildable, T_BUILDING, T_FLOODPLAIN, T_ROAD, T_TREE, type Grid } from '../map/grid';
import { BUILDING_DEFS } from './defs';
import { removeFigure } from '../figures/figure';

const markDirty = (s: GameState, x: number, y: number) => s.dirty.add(gridOffset(x, y));

export function placeRoad(s: GameState, x: number, y: number): boolean {
  if (!isBuildable(s.grid, x, y)) return false;
  const i = gridOffset(x, y);
  s.grid.terrain[i] = (s.grid.terrain[i] & ~T_TREE) | T_ROAD;
  markDirty(s, x, y);
  return true;
}

export function canPlaceBuilding(g: Grid, type: BuildingType, x: number, y: number): boolean {
  const def = BUILDING_DEFS[type];
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      if (!isBuildable(g, x + dx, y + dy)) return false;
      if (def.needsFloodplain && !hasFlag(g, x + dx, y + dy, T_FLOODPLAIN)) return false;
    }
  }
  return true;
}

export function placeBuilding(s: GameState, type: BuildingType, x: number, y: number): number {
  if (!canPlaceBuilding(s.grid, type, x, y)) return 0;
  const def = BUILDING_DEFS[type];
  if (s.treasury < def.cost) return 0;
  s.treasury -= def.cost;
  const id = s.buildings.length;
  s.buildings.push(newBuilding(id, type, x, y, def.size));
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      const i = gridOffset(x + dx, y + dy);
      s.grid.terrain[i] = (s.grid.terrain[i] & ~T_TREE) | T_BUILDING;
      s.grid.buildingId[i] = id;
      markDirty(s, x + dx, y + dy);
    }
  }
  const a = anchorOffset(x, y, def.size);
  s.grid.bType[a] = type;
  s.grid.bLevel[a] = 0;
  return id;
}

/** Ô neo = góc dưới móng (x+N−1, y+N−1), nơi render đặt sprite. */
export const anchorOffset = (x: number, y: number, size: number): number => gridOffset(x + size - 1, y + size - 1);

export function setHouseLevel(s: GameState, b: { x: number; y: number; size: number; level: number }, level: number): void {
  b.level = level;
  const a = anchorOffset(b.x, b.y, b.size);
  s.grid.bLevel[a] = level;
  s.dirty.add(a);
}

/** Phá ô (x, y): đường thì xóa đường; công trình thì xóa cả công trình. */
export function raze(s: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const i = gridOffset(x, y);
  const t = s.grid.terrain[i];
  if (t & T_ROAD) {
    s.grid.terrain[i] = t & ~T_ROAD;
    markDirty(s, x, y);
    return true;
  }
  if (t & T_BUILDING) {
    const b = s.buildings[s.grid.buildingId[i]];
    if (!b || b.type === BuildingType.None) return false;
    for (let dy = 0; dy < b.size; dy++) {
      for (let dx = 0; dx < b.size; dx++) {
        const j = gridOffset(b.x + dx, b.y + dy);
        s.grid.terrain[j] &= ~T_BUILDING;
        s.grid.buildingId[j] = 0;
        s.grid.bType[j] = 0;
        s.grid.bLevel[j] = 0;
        markDirty(s, b.x + dx, b.y + dy);
      }
    }
    if (b.figureId) removeFigure(s, b.figureId);
    if (b.figureId2) removeFigure(s, b.figureId2);
    b.type = BuildingType.None; // giữ chỗ trong mảng, như Julius
    b.population = 0;
    return true;
  }
  return false;
}

/** Ô đường kề móng công trình (cửa ra vào); -1 nếu không có → không sinh walker. */
export function roadAccess(g: Grid, b: { x: number; y: number; size: number }): number {
  for (let d = 0; d < b.size; d++) {
    const cands = [[b.x + d, b.y - 1], [b.x + d, b.y + b.size], [b.x - 1, b.y + d], [b.x + b.size, b.y + d]];
    for (const [cx, cy] of cands) if (hasFlag(g, cx, cy, T_ROAD)) return gridOffset(cx, cy);
  }
  return -1;
}
