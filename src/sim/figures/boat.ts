// Thuyền nan — thiết kế phần 3: ô sông có bến là nút mạng đường thủy. Khi công trình gửi và nhận đều có bến
// trong 3 ô và đường thủy ngắn hơn đường bộ × 0,5 (hoặc không có đường bộ), hàng đi thuyền: 10 tick/ô.
// Thuyền hiện ra ở ô sông cạnh bến gửi, chèo tới ô sông cạnh bến nhận, dỡ hàng vào công trình nhận, chèo về rồi biến mất.
import { BuildingType, FigureType, type Building, type Figure, type GameState } from '../state';
import { gridOffset, inBounds, isWater, offsetX, offsetY } from '../map/grid';
import { bfs, passWater, type Routing } from '../map/routing';
import { BUILDING_DEFS, flood, isRawProducer, isWorkshop } from '../buildings/defs';
import { removeFigure } from './figure';
import { setWalkPath, step, StepResult } from './movement';

const B = flood.boat;

/** Ô sông kề bến (bến đặt trên bờ). −1 nếu không có. */
export function dockWaterTile(g: GameState['grid'], d: Building): number {
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const x = d.x + dx, y = d.y + dy;
    if (inBounds(x, y) && isWater(g, gridOffset(x, y))) return gridOffset(x, y);
  }
  return -1;
}

/** Bến đang hoạt động trong tầm dockRange ô quanh móng công trình b. */
export function dockNear(s: GameState, b: Building): Building | null {
  for (const d of s.buildings) {
    if (d.type !== BuildingType.Dock || d.numWorkers <= 0 || d.flooded) continue;
    const dx = Math.max(0, b.x - d.x, d.x - (b.x + b.size - 1));
    const dy = Math.max(0, b.y - d.y, d.y - (b.y + b.size - 1));
    if (Math.max(dx, dy) <= B.dockRange && dockWaterTile(s.grid, d) >= 0) return d;
  }
  return null;
}

/** BFS đường thủy từ bến của công trình nguồn; null nếu nguồn không có bến. */
export function waterRouting(s: GameState, src: Building): { dock: Building; from: number; r: Routing } | null {
  const dock = dockNear(s, src);
  if (!dock) return null;
  const from = dockWaterTile(s.grid, dock);
  return { dock, from, r: bfs(s.grid, from, passWater) };
}

/** Biến xe bò vừa sinh thành thuyền nan đi tới bến của công trình nhận. */
export function launchBoat(s: GameState, f: Figure, from: number, destDockWater: number): boolean {
  f.type = FigureType.Boat;
  f.x = f.nx = offsetX(from); f.y = f.ny = offsetY(from);
  f.boatHome = from;
  return setWalkPath(s, f, destDockWater, false);
}

export function updateBoat(s: GameState, f: Figure, unload: (s: GameState, f: Figure, b: Building) => boolean): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  if (r === StepResult.Blocked) { removeFigure(s, f.id); return; }
  if (!f.returning) {
    const dest = s.buildings[f.destBuildingId];
    if (dest) unload(s, f, dest);
    f.returning = true;
    if (!setWalkPath(s, f, f.boatHome, false)) removeFigure(s, f.id);
    return;
  }
  const home = s.buildings[f.buildingId];
  if (f.loads > 0 && (isRawProducer(home.type) || isWorkshop(home.type))) home.progress = BUILDING_DEFS[home.type].progressMax;
  removeFigure(s, f.id);
}
