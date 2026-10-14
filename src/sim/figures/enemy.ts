// Giặc và lính (M6a). Giặc: tìm công trình gần nhất, đi bộ tới ô kề (không qua thành), đứng attackTicks tick thì đốt;
// bị thành chặn thì phá thành gần nhất (wallTicks tick mỗi đòn theo độ bền). Phá đủ raidBudget công trình thì rút về mép.
// Lính: ở cửa trại; có giặc trong engageRange thì tới đánh; đứng cạnh nhau thì cứ hitEveryTicks tick đổi đòn.
import { BuildingType, FigureMode, FigureType, isWall, type Building, type Figure, type GameState } from '../state';
import { gridOffset, inBounds, isLand, offsetX, offsetY } from '../map/grid';
import { bfs, passLand, UNREACHABLE } from '../map/routing';
import { burnBuilding, removeBuilding, roadAccess } from '../buildings/spawn';
import { economy } from '../buildings/defs';
import { createFigure, removeFigure } from './figure';
import { figureOffset, setWalkPath, step, StepResult } from './movement';
import { nearestTarget, WAR } from '../city/war';

const adjacentTiles = (b: Building): number[] => {
  const out: number[] = [];
  for (let d = 0; d < b.size; d++) for (const [x, y] of [[b.x + d, b.y - 1], [b.x + d, b.y + b.size], [b.x - 1, b.y + d], [b.x + b.size, b.y + d]]) if (inBounds(x, y)) out.push(gridOffset(x, y));
  return out;
};
const isAdjacent = (f: Figure, b: Building): boolean => f.x >= b.x - 1 && f.x <= b.x + b.size && f.y >= b.y - 1 && f.y <= b.y + b.size;

/** Đường bộ tới ô kề gần nhất của công trình; false nếu không tới được. */
function walkTo(s: GameState, f: Figure, b: Building): boolean {
  const r = bfs(s.grid, figureOffset(f), passLand);
  let best = -1, bd = UNREACHABLE;
  for (const o of adjacentTiles(b)) if (isLand(s.grid, o) && r.dist[o] < bd) { bd = r.dist[o]; best = o; }
  if (best < 0) return false;
  return setWalkPath(s, f, best, false);
}

function enemyRetarget(s: GameState, f: Figure): void {
  f.timer = 0;
  if (f.loads <= 0) { f.returning = true; f.destBuildingId = 0; if (!setWalkPath(s, f, f.boatHome, false)) leave(s, f); return; }
  const t = nearestTarget(s, f.x, f.y, false);
  if (t && walkTo(s, f, t)) { f.destBuildingId = t.id; return; }
  const w = nearestTarget(s, f.x, f.y, true); // bị chặn: phá thành
  if (w && walkTo(s, f, w)) { f.destBuildingId = w.id; return; }
  leave(s, f);
}

function leave(s: GameState, f: Figure): void {
  s.war.enemiesAlive = Math.max(0, s.war.enemiesAlive - 1);
  removeFigure(s, f.id);
}

export function killEnemy(s: GameState, f: Figure): void {
  s.war.killedThisYear++;
  leave(s, f);
}

export function updateEnemy(s: GameState, f: Figure): void {
  if (f.hp <= 0) { killEnemy(s, f); return; }
  if (f.mode === FigureMode.Idle) {
    // đang đứng cạnh mục tiêu
    const b = s.buildings[f.destBuildingId];
    if (!b || b.type === BuildingType.None || b.type === BuildingType.Ruins || !isAdjacent(f, b)) { enemyRetarget(s, f); return; }
    f.timer++;
    if (isWall(b.type)) {
      if (f.timer >= WAR.wallTicks) { f.timer = 0; if (--b.integrity <= 0) { removeBuilding(s, b); s.events.push('Giặc phá một đoạn thành'); enemyRetarget(s, f); } }
    } else if (f.timer >= WAR.attackTicks) {
      s.events.push(`Giặc đốt ${b.type === BuildingType.House ? 'nhà' : 'công trình'}`);
      if (b.type !== BuildingType.WatchPost && !(b.type === BuildingType.House && b.level <= 1)) s.ratings.destroyedThisYear++;
      s.war.burnedByEnemies++;
      burnBuilding(s, b, economy.risk.burnDays);
      f.loads--;
      enemyRetarget(s, f);
    }
    return;
  }
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  if (f.returning) { leave(s, f); return; }
  if (r === StepResult.PathDone) { f.mode = FigureMode.Idle; f.timer = 0; return; }
  enemyRetarget(s, f); // bị chặn
}

const nearEnemy = (s: GameState, f: Figure, range: number): Figure | null => {
  let best: Figure | null = null, bd = range + 1;
  for (const e of s.figures) {
    if (e.type !== FigureType.Enemy) continue;
    const d = Math.max(Math.abs(e.x - f.x), Math.abs(e.y - f.y));
    if (d < bd) { bd = d; best = e; }
  }
  return best;
};

export function updateMilitia(s: GameState, f: Figure): void {
  if (f.hp <= 0) { removeFigure(s, f.id); s.events.push('Một lính tử trận'); return; }
  const foe = nearEnemy(s, f, WAR.engageRange);
  if (foe && Math.max(Math.abs(foe.x - f.x), Math.abs(foe.y - f.y)) <= 1) {
    // giao chiến: đổi đòn mỗi hitEveryTicks tick
    f.mode = FigureMode.Idle;
    if (++f.timer >= WAR.hitEveryTicks) {
      f.timer = 0;
      foe.hp -= WAR.militiaDamage;
      f.hp -= WAR.enemyDamage;
      if (foe.hp <= 0) { killEnemy(s, foe); s.events.push('Lính hạ một tên giặc'); }
    }
    return;
  }
  if (foe) {
    // đuổi theo: đặt lại đường mỗi khi hết đường / đứng yên
    if (f.mode === FigureMode.Idle || f.destBuildingId !== -foe.id) {
      f.destBuildingId = -foe.id;
      if (!setWalkPath(s, f, gridOffset(foe.x, foe.y), false)) { f.mode = FigureMode.Idle; return; }
    }
    const r = step(s, f);
    if (r === StepResult.PathDone || r === StepResult.Blocked) f.mode = FigureMode.Idle;
    return;
  }
  // không có giặc: về cửa trại
  const home = s.buildings[f.buildingId];
  if (!home || home.type !== BuildingType.Barracks) { removeFigure(s, f.id); return; }
  const door = roadAccess(s.grid, home);
  if (door < 0) return;
  if (f.mode === FigureMode.Idle) {
    if (figureOffset(f) !== door) { f.destBuildingId = 0; setWalkPath(s, f, door, false); }
    return;
  }
  const r = step(s, f);
  if (r === StepResult.PathDone || r === StepResult.Blocked) f.mode = FigureMode.Idle;
}
export { createFigure, offsetX, offsetY };
