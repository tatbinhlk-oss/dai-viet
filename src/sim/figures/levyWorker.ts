// Phu đê — thiết kế phần 3/5: nhóm dân do đình làng cử đi đắp đê (lao dịch). Đi có đích trên đất (không cần đường)
// tới đoạn đê, đứng đắp: mỗi tick cộng gangSize người-tick; đủ công thì đê cao thêm một mức.
// Xong đoạn này thì tìm đoạn chờ gần đó; hết việc thì về đình.
import { FigureMode, FigureType, type Building, type Figure, type GameState } from '../state';
import { gridOffset, inBounds } from '../map/grid';
import { bfs, passLand, UNREACHABLE } from '../map/routing';
import { flood } from '../buildings/defs';
import { dikeNeedsWork, raiseDike, takeEarth, workNeeded } from '../buildings/dike';
import { roadAccess } from '../buildings/spawn';
import { createFigure, removeFigure } from './figure';
import { figureOffset, setWalkPath, step, StepResult } from './movement';

const D = flood.dike;

/**
 * Đoạn đê chờ đắp, chưa nhóm nào nhận, có ô kề đi bộ tới được trong `range` ô từ `from`.
 * Ưu tiên đoạn THẤP nhất rồi mới tới gần nhất: cả tuyến lên cao 1 trước (chắn lũ vừa) rồi mới tôn cao dần.
 */
export function findDikeWork(s: GameState, from: number, range: number): Building | null {
  let any = false;
  for (const b of s.buildings) if (dikeNeedsWork(b) && b.figureId === 0) { any = true; break; }
  if (!any) return null;
  const dist = bfs(s.grid, from, passLand).dist;
  let best: Building | null = null, bestD = range + 1, bestH = 99;
  for (const b of s.buildings) {
    if (!dikeNeedsWork(b) || b.figureId !== 0 || b.height > bestH) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = b.x + dx, y = b.y + dy;
      if (!inBounds(x, y)) continue;
      const d = dist[gridOffset(x, y)];
      if (d > range) continue;
      if (b.height < bestH || d < bestD) { bestH = b.height; bestD = d; best = b; }
    }
  }
  return best;
}

function claim(s: GameState, f: Figure, seg: Building): boolean {
  f.destBuildingId = seg.id;
  f.returning = false;
  if (!setWalkPath(s, f, gridOffset(seg.x, seg.y), false)) { f.destBuildingId = 0; return false; }
  seg.figureId = f.id;
  return true;
}

/** M7: nhóm phu đi lao dịch cho triều đình (route = CORVEE_ROUTE): ra cửa ngõ rồi về đình, chỉ để nhìn thấy chiếu chỉ lao dịch đang thi hành. */
export const CORVEE_ROUTE = -2;
function sendCorveeGang(s: GameState, dinh: Building, door: number): void {
  const f = createFigure(s, FigureType.LevyWorker, door, dinh.id);
  if (!f) return;
  f.loads = D.gangSize;
  f.route = CORVEE_ROUTE;
  if (setWalkPath(s, f, s.entryOffset, false)) dinh.figureId2 = f.id;
  else removeFigure(s, f.id);
}

/** Đình làng cử nhóm phu đê nếu có đoạn đê chờ trong tầm; không có đê mà đang lao dịch thì cử phu đi lao dịch (M7). */
export function sendLevyGang(s: GameState, dinh: Building, door: number): void {
  const seg = findDikeWork(s, door, D.levyRange);
  if (!seg) { if (s.court.corveeWorkers > 0) sendCorveeGang(s, dinh, door); return; }
  const f = createFigure(s, FigureType.LevyWorker, door, dinh.id);
  if (!f) return;
  f.loads = D.gangSize;
  if (claim(s, f, seg)) dinh.figureId2 = f.id;
  else removeFigure(s, f.id);
}

function goHome(s: GameState, f: Figure): void {
  const home = s.buildings[f.buildingId];
  const door = home.type ? roadAccess(s.grid, home) : -1;
  f.destBuildingId = 0;
  f.returning = true;
  if (door < 0 || !setWalkPath(s, f, door, false)) removeFigure(s, f.id);
}

function nextOrHome(s: GameState, f: Figure): void {
  const cur = s.buildings[f.destBuildingId];
  if (cur && cur.figureId === f.id) cur.figureId = 0;
  f.destBuildingId = 0;
  const seg = findDikeWork(s, figureOffset(f), D.levyNextRange);
  if (seg && claim(s, f, seg)) return;
  goHome(s, f);
}

function work(s: GameState, f: Figure): void {
  const seg = s.buildings[f.destBuildingId];
  if (!seg || !dikeNeedsWork(seg) || seg.figureId !== f.id) { nextOrHome(s, f); return; }
  if (seg.height === 0 && !seg.earthTaken) takeEarth(s, seg);
  seg.workDone += f.loads;
  if (seg.workDone >= workNeeded(seg)) {
    raiseDike(s, seg);
    nextOrHome(s, f); // xong một mức thì sang đoạn thấp nhất gần đó: cả tuyến lên đều từng mức
  }
}

export function updateLevyWorker(s: GameState, f: Figure): void {
  if (f.route === CORVEE_ROUTE) { // M7: phu lao dịch: tới cửa ngõ (hoặc bị chặn) thì quay về đình
    const r = step(s, f);
    if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
    if (f.returning) removeFigure(s, f.id); else goHome(s, f);
    return;
  }
  if (f.mode === FigureMode.Idle) { work(s, f); return; }
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  if (f.returning) { removeFigure(s, f.id); return; }
  const seg = s.buildings[f.destBuildingId];
  if (r === StepResult.PathDone && seg && seg.figureId === f.id && f.x === seg.x && f.y === seg.y) {
    f.mode = FigureMode.Idle; // đứng trên đoạn đê, bắt đầu đắp
    return;
  }
  nextOrHome(s, f); // bị chặn (ngập) hoặc đoạn đê đã bị phá
}
