// Đặt và phá đường / công trình. Mọi thay đổi lưới phải đi qua đây để dirty được ghi nhận.
import { BuildingType, type GameState } from '../state';
import { gridOffset, inBounds, isBuildable, T_BUILDING, T_ROAD, T_TREE, type Grid } from '../map/grid';

const markDirty = (s: GameState, x: number, y: number) => s.dirty.add(gridOffset(x, y));

export function placeRoad(s: GameState, x: number, y: number): boolean {
  if (!isBuildable(s.grid, x, y)) return false;
  const i = gridOffset(x, y);
  s.grid.terrain[i] = (s.grid.terrain[i] & ~T_TREE) | T_ROAD;
  markDirty(s, x, y);
  return true;
}

export function canPlaceBuilding(g: Grid, x: number, y: number, size: number): boolean {
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (!isBuildable(g, x + dx, y + dy)) return false;
  return true;
}

export function placeBuilding(s: GameState, type: BuildingType, x: number, y: number, size: number): number {
  if (!canPlaceBuilding(s.grid, x, y, size)) return 0;
  const id = s.buildings.length;
  s.buildings.push({ id, type, x, y, size, state: 0 });
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const i = gridOffset(x + dx, y + dy);
      s.grid.terrain[i] = (s.grid.terrain[i] & ~T_TREE) | T_BUILDING;
      s.grid.buildingId[i] = id;
      markDirty(s, x + dx, y + dy);
    }
  }
  return id;
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
        markDirty(s, b.x + dx, b.y + dy);
      }
    }
    b.type = BuildingType.None; // giữ chỗ trong mảng, như Julius
    return true;
  }
  return false;
}
