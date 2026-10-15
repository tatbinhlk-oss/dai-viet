// QoL: hoàn tác lần xây gần nhất (như nút Undo của Caesar 3) — bỏ các công trình / đường vừa đặt, trả lại tiền.
import { BuildingType, isDike, type GameState } from './state';
import { BUILDING_DEFS, economy } from './buildings/defs';
import { removeBuilding } from './buildings/spawn';
import { gridOffset, offsetX, offsetY, T_ROAD, T_WATER } from './map/grid';
import { syncDikeTile } from './buildings/dike';

export interface UndoRecord { day: number; buildingIds: number[]; roads: number[]; cost: number }

/** Xem lệnh xây tạo ra gì: gọi `before` trước và `after` sau khi áp dụng một gói lệnh. */
export function undoBefore(s: GameState): { n: number; roads: Set<number>; treasury: number } {
  const roads = new Set<number>();
  for (let i = 0; i < s.grid.terrain.length; i++) if (s.grid.terrain[i] & T_ROAD) roads.add(i);
  return { n: s.buildings.length, roads, treasury: s.treasury };
}
export function undoAfter(s: GameState, b: ReturnType<typeof undoBefore>): UndoRecord | null {
  const buildingIds: number[] = [];
  for (let id = b.n; id < s.buildings.length; id++) if (s.buildings[id].type !== BuildingType.None) buildingIds.push(id);
  const roads: number[] = [];
  for (let i = 0; i < s.grid.terrain.length; i++) if (s.grid.terrain[i] & T_ROAD && !b.roads.has(i)) roads.push(i);
  if (!buildingIds.length && !roads.length) return null;
  return { day: s.time.totalDays, buildingIds, roads, cost: b.treasury - s.treasury };
}

/** Hoàn tác: chỉ bỏ công trình còn nguyên (cùng loại, chưa có dân) và ô vẫn là đường. Trả về số thứ đã bỏ. */
export function applyUndo(s: GameState, r: UndoRecord): number {
  let n = 0, refund = 0;
  for (const id of r.buildingIds) {
    const b = s.buildings[id];
    if (!b || b.type === BuildingType.None || b.type === BuildingType.Ruins) continue;
    if (b.type === BuildingType.House && b.population > 0) continue;
    refund += BUILDING_DEFS[b.type].cost;
    removeBuilding(s, b);
    n++;
  }
  for (const o of r.roads) {
    if (!(s.grid.terrain[o] & T_ROAD)) continue;
    if (s.grid.terrain[o] & T_WATER) refund += economy.bridgeCost; // M7: cầu
    s.grid.terrain[o] &= ~T_ROAD;
    const bid = s.grid.buildingId[o];
    if (bid && isDike(s.buildings[bid].type)) syncDikeTile(s, s.buildings[bid]); // đường vắt qua đê bỏ đi
    s.dirty.add(gridOffset(offsetX(o), offsetY(o)));
    n++;
  }
  s.treasury += refund;
  s.thisYear.construction -= refund;
  return n;
}
