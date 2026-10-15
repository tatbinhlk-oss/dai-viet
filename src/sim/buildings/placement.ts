// QoL: vì sao không đặt được công trình tại ô (địa hình) — thuần mảng, dùng chung cho sim (báo lý do) và render (khung đặt xanh / đỏ, không cần hỏi worker).
// Quy tắc phải khớp canPlaceBuilding trong spawn.ts (test kiểm tương đương).
import { BuildingType, isDike, isWall } from '../state';
import { BUILDING_DEFS } from './defs';
import { GRID_SIZE, T_BUILDING, T_FLOODPLAIN, T_RESERVED, T_ROAD, T_WATER } from '../map/grid';

export interface TileView { terrain: Uint16Array; elevation: Uint8Array; /** loại công trình ở ô neo (đường vắt được qua đê) */ bType?: Uint8Array }

const inB = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
const flag = (v: TileView, x: number, y: number, f: number): boolean => inB(x, y) && (v.terrain[y * GRID_SIZE + x] & f) !== 0;

/** Lý do địa hình không đặt được `kind` ('road' / 'bridge' hoặc khóa công trình) với góc trên-trái (x, y); null = đặt được. */
export const PLACE_SINGLE = new Set(['raze', 'inspect']);
export function placementCheck(v: TileView, kind: string, type: BuildingType | undefined, x: number, y: number): string | null {
  if (kind === 'bridge') { // M7: cầu gỗ bắc qua ô sông trống
    if (!inB(x, y)) return 'ngoài bản đồ';
    const t = v.terrain[y * GRID_SIZE + x];
    if (!(t & T_WATER)) return 'cầu phải bắc qua sông';
    if (t & T_ROAD) return 'đã có cầu';
    if (t & T_BUILDING) return 'đã có công trình';
    if (t & T_RESERVED) return 'đất chưa cấp — cần phẩm hàm cao hơn';
    return null;
  }
  if (kind === 'road') {
    if (!inB(x, y)) return 'ngoài bản đồ';
    const t = v.terrain[y * GRID_SIZE + x];
    if (t & T_WATER) return 'dưới nước';
    if (t & T_ROAD) return 'đã có đường';
    if (t & T_RESERVED) return 'đất chưa cấp — cần phẩm hàm cao hơn';
    if (t & T_BUILDING && !(v.bType && isDike(v.bType[y * GRID_SIZE + x] as BuildingType))) return 'đã có công trình';
    return null;
  }
  if (type === undefined) return null;
  const def = BUILDING_DEFS[type];
  if (!def || def.size === 0 || type === BuildingType.Ruins) return 'không đặt được';
  if (isDike(type) && inB(x, y) && (v.terrain[y * GRID_SIZE + x] & T_BUILDING)) return null; // đê lên ô đã có đê: tôn cao (sim kiểm loại)
  let shore = false;
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      const cx = x + dx, cy = y + dy;
      if (!inB(cx, cy)) return 'ngoài bản đồ';
      const t = v.terrain[cy * GRID_SIZE + cx];
      if (t & T_WATER) return 'dưới nước';
      if (t & T_BUILDING) return 'đã có công trình';
      if (def.terrain === 'road') { if (!(t & T_ROAD)) return 'cổng phải đặt lên ô đường'; if (t & T_RESERVED) return 'đất chưa cấp — cần phẩm hàm cao hơn'; } // M7
      else if (def.terrain === 'land') { if (isWall(type) && t & T_ROAD) return 'thành không đặt lên đường'; }
      else {
        if (t & T_ROAD) return 'đã có đường';
        if (t & T_RESERVED) return 'đất chưa cấp — cần phẩm hàm cao hơn';
      }
      const elev = v.elevation[cy * GRID_SIZE + cx];
      switch (def.terrain) {
        case 'floodplain': if (!(t & T_FLOODPLAIN)) return 'phải đặt trên bãi bồi'; break;
        case 'highland': if (elev < 2 || t & T_FLOODPLAIN) return 'phải đặt trên đất cao'; break;
        case 'mountain': if (elev < 3) return 'phải đặt trên núi'; break;
        case 'shore':
          if (flag(v, cx - 1, cy, T_WATER) || flag(v, cx + 1, cy, T_WATER) || flag(v, cx, cy - 1, T_WATER) || flag(v, cx, cy + 1, T_WATER)) shore = true;
          break;
      }
    }
  }
  if (def.terrain === 'shore' && !shore) return 'phải kề sông';
  return null;
}
