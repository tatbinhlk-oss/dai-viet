// Đặt và phá đường / công trình. Mọi thay đổi lưới phải đi qua đây để dirty được ghi nhận.
import { BuildingType, isDike, isWall, type Building, type GameState, newBuilding } from '../state';
import { gridOffset, hasFlag, inBounds, isBuildable, T_BUILDING, T_FLOODPLAIN, T_RESERVED, T_ROAD, T_TREE, T_WATER, type Grid } from '../map/grid';
import { placementCheck } from './placement';
import { BUILDING_DEFS, BUILDING_KEYS, court, economy } from './defs';
import { removeFigure } from '../figures/figure';

const markDirty = (s: GameState, x: number, y: number) => s.dirty.add(gridOffset(x, y));

export function placeRoad(s: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const i = gridOffset(x, y);
  // M4: đường được vắt qua đoạn đê (dốc đê) — ô giữ cả T_BUILDING lẫn T_ROAD
  const onDike = (s.grid.terrain[i] & T_BUILDING) !== 0 && isDike(s.buildings[s.grid.buildingId[i]]?.type ?? BuildingType.None);
  if (!onDike && !isBuildable(s.grid, x, y)) return false;
  if (onDike && s.grid.terrain[i] & T_ROAD) return false;
  s.grid.terrain[i] = (s.grid.terrain[i] & ~T_TREE) | T_ROAD;
  markDirty(s, x, y);
  return true;
}

/** M7: cầu gỗ — ô sông mang thêm cờ đường (giữ T_WATER để thuyền vẫn qua). Tốn economy.bridgeCost quan mỗi ô. */
export function placeBridge(s: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const i = gridOffset(x, y);
  if ((s.grid.terrain[i] & (T_WATER | T_ROAD | T_BUILDING | T_RESERVED)) !== T_WATER) return false;
  if (s.treasury < economy.bridgeCost) return false;
  s.treasury -= economy.bridgeCost;
  s.thisYear.construction += economy.bridgeCost;
  s.grid.terrain[i] |= T_ROAD;
  markDirty(s, x, y);
  return true;
}

/** 'road' / 'bridge': công cụ vẽ ô, không phải công trình. */
export const isFlatKind = (kind: string): boolean => kind === 'road' || kind === 'bridge';

/** QoL: vì sao lệnh xây sẽ bị từ chối (địa hình, tiền, phẩm hàm); null = được. Dùng để báo người chơi. */
export function placementError(s: GameState, kind: string): string | null;
export function placementError(s: GameState, kind: string, x: number, y: number): string | null;
export function placementError(s: GameState, kind: string, x?: number, y?: number): string | null {
  const type = isFlatKind(kind) ? undefined : BUILDING_KEYS.get(kind);
  if (!isFlatKind(kind) && (type === undefined || type === BuildingType.None || type === BuildingType.Ruins)) return 'không đặt được';
  if (type !== undefined) {
    const def = BUILDING_DEFS[type];
    if (def.rank > s.court.rank) return `cần phẩm hàm ${court.ranks.names[def.rank]}`;
    if (def.cost > 0 && s.treasury < def.cost) return `không đủ tiền (cần ${def.cost} quan)`;
  }
  if (kind === 'bridge' && s.treasury < economy.bridgeCost) return `không đủ tiền (cần ${economy.bridgeCost} quan)`;
  if (x === undefined || y === undefined) return null;
  return placementCheck({ terrain: s.grid.terrain, elevation: s.grid.elevation, bType: s.grid.bType }, kind, type, x, y);
}

/** Kiểm tra móng N×N có hợp địa hình không (bãi bồi, đất cao, núi, kề nước). */
export function canPlaceBuilding(g: Grid, type: BuildingType, x: number, y: number): boolean {
  const def = BUILDING_DEFS[type];
  if (!def || def.size === 0 || type === BuildingType.Ruins) return false;
  let shore = false;
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      const cx = x + dx, cy = y + dy;
      // đê: đặt được lên ô đường (đường vắt qua đê); các loại khác cần ô trống
      if (def.terrain === 'land') { if (!inBounds(cx, cy) || (g.terrain[gridOffset(cx, cy)] & (T_WATER | T_BUILDING)) !== 0) return false; if (isWall(type) && hasFlag(g, cx, cy, T_ROAD)) return false; } // M6a: thành không đặt lên đường
      else if (def.terrain === 'road') { if (!inBounds(cx, cy) || (g.terrain[gridOffset(cx, cy)] & (T_WATER | T_BUILDING | T_ROAD | T_RESERVED)) !== T_ROAD) return false; } // M7: cổng thành chỉ đặt lên ô đường trống (không phải cầu)
      else if (!isBuildable(g, cx, cy)) return false;
      const elev = g.elevation[gridOffset(cx, cy)];
      switch (def.terrain) {
        case 'floodplain': if (!hasFlag(g, cx, cy, T_FLOODPLAIN)) return false; break;
        case 'highland': if (elev < 2 || hasFlag(g, cx, cy, T_FLOODPLAIN)) return false; break;
        case 'mountain': if (elev < 3) return false; break;
        case 'shore':
          if (hasFlag(g, cx - 1, cy, T_WATER) || hasFlag(g, cx + 1, cy, T_WATER) || hasFlag(g, cx, cy - 1, T_WATER) || hasFlag(g, cx, cy + 1, T_WATER)) shore = true;
          break;
      }
    }
  }
  return def.terrain !== 'shore' || shore;
}

export function placeBuilding(s: GameState, type: BuildingType, x: number, y: number): number {
  if (!canPlaceBuilding(s.grid, type, x, y)) return 0;
  const def = BUILDING_DEFS[type];
  if (def.cost > 0 && s.treasury < def.cost) return 0; // công trình lao dịch (đê) không tốn quan, đắp được cả khi nợ
  if (def.rank > s.court.rank) return 0; // M5: cần phẩm hàm
  s.treasury -= def.cost;
  s.thisYear.construction += def.cost;
  const id = s.buildings.length;
  const b = newBuilding(id, type, x, y, def.size);
  b.happiness = s.sentiment;
  s.buildings.push(b);
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
  s.grid.bLevel[a] = level | ((b.size - 1) << 4); // render đọc bậc ở 4 bit thấp, cỡ (1–3) ở bit 4–5
  s.dirty.add(a);
}

/** Đổi loại công trình tại chỗ (dùng khi cháy thành đống tro). */
export function setBuildingType(s: GameState, b: Building, type: BuildingType): void {
  b.type = type;
  const a = anchorOffset(b.x, b.y, b.size);
  s.grid.bType[a] = type;
  s.grid.bLevel[a] = 0;
  s.dirty.add(a);
}

function releaseFigures(s: GameState, b: Building): void {
  if (b.figureId) removeFigure(s, b.figureId);
  if (b.figureId2) removeFigure(s, b.figureId2);
  if (b.laborSeekerId) removeFigure(s, b.laborSeekerId);
}

/** Xóa công trình khỏi lưới (phá, sập, cháy xong). Giữ chỗ trong mảng như Julius. */
export function removeBuilding(s: GameState, b: Building): void {
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
  releaseFigures(s, b);
  if (isDike(b.type)) {
    const o = gridOffset(b.x, b.y);
    s.grid.dike[o] = 0;
    s.flood.dikesChanged = true;
  }
  b.type = BuildingType.None;
  b.population = 0;
  b.flooded = false;
  b.store.fill(0);
}

/** Công trình bốc cháy: thành đống tro cùng kích thước, dân và hàng mất hết. */
export function burnBuilding(s: GameState, b: Building, days: number): void {
  releaseFigures(s, b);
  b.population = 0;
  b.level = 0;
  b.store.fill(0);
  b.numWorkers = 0;
  b.burnDays = days;
  b.fireRisk = 0;
  b.damageRisk = 0;
  setBuildingType(s, b, BuildingType.Ruins);
  s.grid.bLevel[anchorOffset(b.x, b.y, b.size)] = b.size; // đống tro: render đọc kích thước từ bLevel
}

/** Phá ô (x, y): đường thì xóa đường; công trình thì xóa cả công trình. */
export function raze(s: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const i = gridOffset(x, y);
  const t = s.grid.terrain[i];
  if (t & T_BUILDING && s.buildings[s.grid.buildingId[i]]?.type === BuildingType.Gate) { removeBuilding(s, s.buildings[s.grid.buildingId[i]]); return true; } // M7: phá cổng thì đường bên dưới còn
  if (t & T_ROAD) {
    s.grid.terrain[i] = t & ~T_ROAD;
    markDirty(s, x, y);
    return true;
  }
  if (t & T_BUILDING) {
    const b = s.buildings[s.grid.buildingId[i]];
    if (!b || b.type === BuildingType.None) return false;
    removeBuilding(s, b);
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
