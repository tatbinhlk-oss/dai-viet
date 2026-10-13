// Di chuyển theo ô: mỗi tick progress += 1; đủ TICKS_PER_TILE thì sang ô kế.
// Hai chế độ: Walk (theo path BFS) và Roam (ngẫu nhiên trên đường, không quay đầu nếu còn lối khác).
import { FigureMode, TICKS_PER_TILE, type Figure, type GameState } from '../state';
import { gridOffset, isRoad, neighbors4, offsetX, offsetY, type Grid } from '../map/grid';
import { findPath, passLandTo, passRoad } from '../map/routing';
import { nextInt } from '../rng';

const nb = new Int32Array(4);
const cands = new Int32Array(4);

export const figureOffset = (f: Figure): number => gridOffset(f.x, f.y);

/** Đặt path tới `to`; trả false nếu không tới được. */
export function setWalkPath(s: GameState, f: Figure, to: number, onRoad: boolean): boolean {
  const from = figureOffset(f);
  const path = findPath(s.grid, from, to, onRoad ? passRoad : passLandTo(to));
  if (path.length === 0 && from !== to) return false;
  f.path = path;
  f.pathIdx = 0;
  f.mode = FigureMode.Walk;
  f.progress = 0;
  f.nx = f.x; f.ny = f.y;
  return true;
}

export function startRoam(f: Figure, maxLength: number): void {
  f.mode = FigureMode.Roam;
  f.roamLength = 0;
  f.maxRoamLength = maxLength;
  f.progress = 0;
  f.nx = f.x; f.ny = f.y;
  f.prevOffset = -1;
}

/** Kết quả một tick di chuyển. */
export enum StepResult { Moving = 0, ArrivedTile = 1, PathDone = 2, Blocked = 3, RoamDone = 4 }

/** Tiến một tick. Trả ArrivedTile khi vừa đặt chân lên ô mới (để áp dịch vụ), PathDone khi hết path. */
export function step(s: GameState, f: Figure): StepResult {
  if (f.mode === FigureMode.Idle) return StepResult.Moving;
  const g = s.grid;
  // đang ở giữa hai ô
  if (f.nx !== f.x || f.ny !== f.y) {
    if (++f.progress < TICKS_PER_TILE) return StepResult.Moving;
    f.prevOffset = gridOffset(f.x, f.y);
    f.x = f.nx; f.y = f.ny; f.progress = 0;
    return StepResult.ArrivedTile;
  }
  // chọn ô kế tiếp
  if (f.mode === FigureMode.Walk) {
    if (f.pathIdx >= f.path.length) return StepResult.PathDone;
    const next = f.path[f.pathIdx];
    // ô kế bị chặn (đường bị phá) → báo để hành vi tính lại
    const isLast = f.pathIdx === f.path.length - 1;
    if (!isLast && !isRoad(g, next) && !isLandFree(g, next)) return StepResult.Blocked;
    f.pathIdx++;
    f.nx = offsetX(next); f.ny = offsetY(next);
    return StepResult.Moving;
  }
  // Roam
  if (f.roamLength >= f.maxRoamLength) return StepResult.RoamDone;
  const here = gridOffset(f.x, f.y);
  neighbors4(here, nb);
  let n = 0;
  for (let k = 0; k < 4; k++) if (nb[k] >= 0 && nb[k] !== f.prevOffset && isRoad(g, nb[k])) cands[n++] = nb[k];
  let next: number;
  if (n > 0) next = cands[nextInt(s.rng, n)];
  else if (f.prevOffset >= 0 && isRoad(g, f.prevOffset)) next = f.prevOffset; // ngõ cụt: quay đầu
  else return StepResult.RoamDone; // đứng trên đường bị phá
  f.roamLength++;
  f.nx = offsetX(next); f.ny = offsetY(next);
  return StepResult.Moving;
}

function isLandFree(g: Grid, o: number): boolean {
  return (g.terrain[o] & 0b101) === 0; // không nước, không công trình
}
