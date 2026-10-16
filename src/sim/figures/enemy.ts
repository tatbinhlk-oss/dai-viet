// Giặc và lính (M6a). Giặc: tìm công trình gần nhất, đi bộ tới ô kề (không qua thành), đứng attackTicks tick thì đốt;
// bị thành chặn thì phá thành gần nhất (wallTicks tick mỗi đòn theo độ bền). Phá đủ raidBudget công trình thì rút về mép.
// Lính: ở cửa trại; có giặc trong engageRange thì tới đánh; đứng cạnh nhau thì cứ hitEveryTicks tick đổi đòn.
import { BuildingType, FigureMode, FigureType, isDike, isHostile, isMilitaryBase, isWall, TICKS_PER_TILE, type Building, type Figure, type GameState } from '../state';
import { logEvent } from '../log';
import { gridOffset, inBounds, isGateTile, isLand, offsetX, offsetY, T_BUILDING } from '../map/grid';
import { bfs, passHostile, UNREACHABLE } from '../map/routing';
import { dismissCity } from '../scenario/victory';
import { burnBuilding, removeBuilding, roadAccess } from '../buildings/spawn';
import { economy } from '../buildings/defs';
import { createFigure, removeFigure } from './figure';
import { figureOffset, setWalkPath, step, StepResult } from './movement';
import { hasLoot, nearestTarget, squadMembers, WAR } from '../city/war';
import { RESOURCES, UNITS_PER_LOAD } from '../buildings/defs';

const adjacentTiles = (b: Building): number[] => {
  const out: number[] = [];
  for (let d = 0; d < b.size; d++) for (const [x, y] of [[b.x + d, b.y - 1], [b.x + d, b.y + b.size], [b.x - 1, b.y + d], [b.x + b.size, b.y + d]]) if (inBounds(x, y)) out.push(gridOffset(x, y));
  return out;
};
const isAdjacent = (f: Figure, b: Building): boolean => f.x >= b.x - 1 && f.x <= b.x + b.size && f.y >= b.y - 1 && f.y <= b.y + b.size;

/** Ô đứng được của giặc: đất đi bộ, không phải ô cổng thành (M7). */
const hostileLand = (s: GameState, o: number): boolean => isLand(s.grid, o) && !isGateTile(s.grid, o);

/** Đường bộ tới ô kề gần nhất của công trình; false nếu không tới được. */
function walkTo(s: GameState, f: Figure, b: Building): boolean {
  const r = bfs(s.grid, figureOffset(f), passHostile);
  let best = -1, bd = UNREACHABLE;
  for (const o of adjacentTiles(b)) if (hostileLand(s, o) && r.dist[o] < bd) { bd = r.dist[o]; best = o; }
  if (best < 0) return false;
  return setWalkPath(s, f, best, false);
}

/** Công trình thỏa `filter` có ô kề TỚI ĐƯỢC gần nhất (theo đường đi, không phải đường chim bay); đặt path luôn. */
function walkToNearest(s: GameState, f: Figure, filter: (b: Building) => boolean): Building | null {
  const r = bfs(s.grid, figureOffset(f), passHostile);
  let best: Building | null = null, bestO = -1, bd = UNREACHABLE;
  for (const b of s.buildings) {
    if (b.type === BuildingType.None || b.type === BuildingType.Ruins || isDike(b.type) || !filter(b)) continue;
    for (const o of adjacentTiles(b)) if (hostileLand(s, o) && r.dist[o] < bd) { bd = r.dist[o]; best = b; bestO = o; }
  }
  if (!best || !setWalkPath(s, f, bestO, false)) return null;
  return best;
}

function enemyRetarget(s: GameState, f: Figure): void {
  f.timer = 0;
  if (f.type === FigureType.CourtTroops) { courtRetarget(s, f); return; }
  if (f.loads <= 0) { f.returning = true; f.destBuildingId = 0; if (!setWalkPath(s, f, f.boatHome, false)) leave(s, f); return; }
  const t = nearestTarget(s, f.x, f.y, false, f.resource === 0); // M8: chưa cướp được gì thì ưu tiên vựa / kho có hàng
  if (t && walkTo(s, f, t)) { f.destBuildingId = t.id; return; }
  const w = walkToNearest(s, f, (b) => isWall(b.type)); // bị chặn: phá đoạn thành / cổng tới được gần nhất
  if (w) { f.destBuildingId = w.id; return; }
  leave(s, f);
}

/** M7: quân triều đình nhắm nha môn; bị thành chặn thì phá thành; không tới được gì thì coi như đã chiếm thành. */
function courtRetarget(s: GameState, f: Figure): void {
  const y = walkToNearest(s, f, (b) => b.type === BuildingType.Yamen);
  if (y) { f.destBuildingId = y.id; return; }
  const w = walkToNearest(s, f, (b) => isWall(b.type));
  if (w) { f.destBuildingId = w.id; return; }
  if (s.buildings.some((b) => b.type === BuildingType.Yamen)) dismissCity(s, 'Quân triều đình vào thành không ai cản');
  else dismissCity(s, 'Không còn nha môn: quân triều đình tiếp quản thành');
  removeFigure(s, f.id);
}

function leave(s: GameState, f: Figure): void {
  if (f.type === FigureType.Enemy) s.war.enemiesAlive = Math.max(0, s.war.enemiesAlive - 1);
  removeFigure(s, f.id);
}

/** M7: quân triều đình bị đánh lui (lính hạ hết): triều đình cử đợt khác sau kỳ hạn mới (dismissalDay đã đặt lại khi xuất quân). */
function courtTroopKilled(s: GameState, f: Figure): void {
  removeFigure(s, f.id);
  if (!s.figures.some((o) => o.type === FigureType.CourtTroops)) logEvent(s, 'Đánh lui quân triều đình! Nhưng triều đình sẽ cử thêm quân nếu Ân sủng vẫn thấp.');
}

export function killEnemy(s: GameState, f: Figure): void {
  s.war.killedThisYear++;
  leave(s, f);
}

export function updateEnemy(s: GameState, f: Figure): void {
  if (f.hp <= 0) { leaveCorpse(s, f, f.type === FigureType.CourtTroops ? CORPSE_COURT : CORPSE_ENEMY); if (f.type === FigureType.CourtTroops) courtTroopKilled(s, f); else killEnemy(s, f); return; }
  if (f.waitTicks > 0) f.waitTicks--; // cờ "đang đánh" (lính đặt khi đổi đòn) tắt dần
  if (f.mode === FigureMode.Idle) {
    // đang đứng cạnh mục tiêu
    const b = s.buildings[f.destBuildingId];
    if (!b || b.type === BuildingType.None || b.type === BuildingType.Ruins || !isAdjacent(f, b)) { enemyRetarget(s, f); return; }
    f.timer++;
    if (isWall(b.type)) {
      if (f.timer >= WAR.wallTicks) {
        f.timer = 0;
        if (--b.integrity <= 0) {
          const what = b.type === BuildingType.Gate ? 'cổng thành' : 'một đoạn thành';
          removeBuilding(s, b);
          logEvent(s, `${f.type === FigureType.CourtTroops ? 'Quân triều đình' : 'Giặc'} phá ${what}`, gridOffset(b.x, b.y));
          enemyRetarget(s, f);
        }
      }
    } else if (f.type === FigureType.CourtTroops) {
      if (f.timer >= WAR.attackTicks && b.type === BuildingType.Yamen) dismissCity(s, 'Quân triều đình chiếm nha môn'); // M7: tới nha môn là bị cách chức
      else if (b.type !== BuildingType.Yamen) enemyRetarget(s, f);
    } else if (f.timer >= WAR.attackTicks && f.resource === 0 && hasLoot(b)) {
      // M8: cướp một kiện hàng nhiều nhất trong vựa / kho rồi đi tiếp (không đốt)
      let r = 0; for (let k = 1; k < b.store.length; k++) if (b.store[k] > b.store[r]) r = k;
      b.store[r] -= UNITS_PER_LOAD; f.resource = r;
      logEvent(s, `Giặc cướp một kiện ${RESOURCES[r]?.name ?? 'hàng'} ở ${b.type === BuildingType.Granary ? 'vựa' : 'kho'}`, gridOffset(b.x, b.y));
      s.ratings.destroyedThisYear++;
      f.loads--;
      enemyRetarget(s, f);
    } else if (f.timer >= WAR.attackTicks) {
      logEvent(s, `Giặc đốt ${b.type === BuildingType.House ? 'nhà' : 'công trình'}`, gridOffset(b.x, b.y));
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

/** Giặc / quân triều đình gần `anchor` nhất trong `range` ô (Chebyshev). */
const nearHostile = (s: GameState, ax: number, ay: number, range: number): Figure | null => {
  let best: Figure | null = null, bd = range + 1;
  for (const e of s.figures) {
    if (!isHostile(e.type) || e.hp <= 0) continue;
    const d = Math.max(Math.abs(e.x - ax), Math.abs(e.y - ay));
    if (d < bd) { bd = d; best = e; }
  }
  return best;
};
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** M8: xác nằm tại chỗ `corpseTicks` tick rồi biến mất; `route` = loại xác (0 lính giáo, 1 giặc, 2 cung thủ, 3 quân triều đình, 4 voi). */
export const CORPSE_MILITIA = 0, CORPSE_ENEMY = 1, CORPSE_ARCHER = 2, CORPSE_COURT = 3, CORPSE_ELEPHANT = 4;
export function leaveCorpse(s: GameState, f: Figure, kind: number): void {
  const c = createFigure(s, FigureType.Corpse, figureOffset(f), 0);
  if (!c) return;
  c.route = kind; c.timer = WAR.corpseTicks; c.progress = 0;
}
export function updateCorpse(s: GameState, f: Figure): void {
  if (--f.timer <= 0) { removeFigure(s, f.id); return; }
  // progress 0..14 cho render mờ dần (nx = x nên không nội suy vị trí)
  f.progress = Math.min(14, Math.round((TICKS_PER_TILE * (WAR.corpseTicks - f.timer)) / WAR.corpseTicks));
}

/** Đòn và tên loại quân. */
const soldierDamage = (f: Figure): number => f.type === FigureType.Archer ? WAR.archerDamage : f.type === FigureType.Elephant ? WAR.elephantDamage : WAR.militiaDamage;
const SOLDIER_NAME: Partial<Record<FigureType, string>> = { [FigureType.Militia]: 'Một lính', [FigureType.Archer]: 'Một cung thủ', [FigureType.Elephant]: 'Voi trận' };
const CORPSE_OF: Partial<Record<FigureType, number>> = { [FigureType.Militia]: CORPSE_MILITIA, [FigureType.Archer]: CORPSE_ARCHER, [FigureType.Elephant]: CORPSE_ELEPHANT };

/** Giặc / quân triều đình chết: xác + sổ sách. */
function hostileDies(s: GameState, foe: Figure, by: string): void {
  leaveCorpse(s, foe, foe.type === FigureType.CourtTroops ? CORPSE_COURT : CORPSE_ENEMY);
  if (foe.type === FigureType.CourtTroops) courtTroopKilled(s, foe); else { killEnemy(s, foe); logEvent(s, `${by} hạ một tên giặc`, figureOffset(foe)); }
}

/** Ô gác của đội: ô được lệnh (post) hoặc cửa trại. −1 khi trại không kề đường. */
export function squadAnchor(s: GameState, home: Building): number {
  if (home.post >= 0) return home.post;
  return roadAccess(s.grid, home);
}
/** Đội hình quanh ô gác: 8 ô kề theo thứ tự ưu tiên, bỏ ô không đứng được. */
const FORMATION: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
export function formationSlot(s: GameState, anchor: number, index: number): number {
  const ax = offsetX(anchor), ay = offsetY(anchor);
  const ok: number[] = [];
  for (const [dx, dy] of FORMATION) {
    const x = ax + dx, y = ay + dy;
    if (!inBounds(x, y)) continue;
    const o = gridOffset(x, y);
    if (isLand(s.grid, o) && (o === anchor || !(s.grid.terrain[o] & T_BUILDING) || isGateTile(s.grid, o))) ok.push(o);
  }
  return ok.length ? ok[index % ok.length] : anchor;
}

/**
 * M8: lính giáo / cung thủ / voi của một đội. Đứng gác tại ô đội hình quanh ô gác (post hoặc cửa trại); giặc trong engageRange
 * quanh ô gác thì tới đánh rồi quay về, không đuổi xa hơn. Cung thủ bắn từ xa archerRange ô không bị đánh lại; bị áp sát thì đòn chia đôi.
 */
export function updateSoldier(s: GameState, f: Figure): void {
  const home = s.buildings[f.buildingId];
  if (f.hp <= 0) { leaveCorpse(s, f, CORPSE_OF[f.type] ?? CORPSE_MILITIA); removeFigure(s, f.id); logEvent(s, `${SOLDIER_NAME[f.type] ?? 'Một lính'} tử trận`, figureOffset(f)); return; }
  if (!home || !isMilitaryBase(home.type)) { removeFigure(s, f.id); return; }
  f.waitTicks = 0; // cờ "đang đánh" cho render
  const anchor = squadAnchor(s, home);
  if (anchor < 0) return;
  const ax = offsetX(anchor), ay = offsetY(anchor);
  const foe = nearHostile(s, ax, ay, WAR.engageRange);
  if (foe) {
    const d = cheb(f, foe);
    const ranged = f.type === FigureType.Archer && d >= 2 && d <= WAR.archerRange;
    if (d <= 1 || ranged) {
      // giao chiến: đổi đòn mỗi hitEveryTicks tick (bắn xa thì không bị đánh lại)
      f.mode = FigureMode.Idle; f.waitTicks = 1; f.destBuildingId = 0;
      if (++f.timer >= WAR.hitEveryTicks) {
        f.timer = 0;
        foe.hp -= ranged ? WAR.archerDamage : f.type === FigureType.Archer ? Math.ceil(WAR.archerDamage / 2) : soldierDamage(f);
        if (!ranged) { f.hp -= WAR.enemyDamage; foe.waitTicks = 1; }
        if (foe.hp <= 0) hostileDies(s, foe, f.type === FigureType.Archer ? 'Cung thủ' : f.type === FigureType.Elephant ? 'Voi trận' : 'Lính');
      }
      return;
    }
    // đuổi theo (trong tầm quanh ô gác): đặt lại đường khi hết đường / đổi mục tiêu
    if (f.mode === FigureMode.Idle || f.destBuildingId !== -foe.id) {
      f.destBuildingId = -foe.id;
      if (!setWalkPath(s, f, gridOffset(foe.x, foe.y), false)) { f.mode = FigureMode.Idle; return; }
    }
    const r = step(s, f);
    if (r === StepResult.PathDone || r === StepResult.Blocked) f.mode = FigureMode.Idle;
    return;
  }
  // không có giặc: về ô đội hình quanh ô gác
  const members = squadMembers(s, home);
  const slot = formationSlot(s, anchor, Math.max(0, members.findIndex((m) => m.id === f.id)));
  if (f.mode === FigureMode.Idle) {
    if (figureOffset(f) !== slot && f.destBuildingId !== -1000 - slot) { f.destBuildingId = -1000 - slot; if (!setWalkPath(s, f, slot, false)) f.destBuildingId = 0; }
    return;
  }
  if (f.destBuildingId < 0 && f.destBuildingId > -1000) { f.mode = FigureMode.Idle; return; } // vừa đuổi xong: đặt lại đường về ở tick sau
  const r = step(s, f);
  if (r === StepResult.PathDone || r === StepResult.Blocked) { f.mode = FigureMode.Idle; f.destBuildingId = 0; }
}
/** Giữ tên cũ cho chỗ gọi cũ. */
export const updateMilitia = updateSoldier;
export { createFigure, offsetX, offsetY };
