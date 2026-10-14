// Giặc giã — thiết kế phần 6 (invasion của Julius rút gọn). Ba nguồn theo kịch bản: cướp biển từ cửa sông, quân Chiêm từ nam,
// quân phương Bắc từ bắc. Báo trước 2 tháng; đến ngày thì giặc xuất hiện ở mép bản đồ, đi tới công trình gần nhất và đốt.
// Trại lính biến vũ khí thành lính; thành đất / thành đá chặn đường giặc.
import { BuildingType, FigureType, type Building, type GameState, type Invasion, type InvasionSource, type WarState } from '../state';
import { GRID_SIZE, gridOffset, isLand, T_WATER } from '../map/grid';
import { trade } from './trade';
import { createFigure } from '../figures/figure';
import { riverEdgeTile } from './trade';
import { roadAccess } from '../buildings/spawn';
import { UNITS_PER_LOAD } from '../buildings/defs';

export const WAR = trade.war;
export const SOURCE_TEXT: Record<InvasionSource, string> = { sea: 'cướp biển từ cửa sông', south: 'quân Chiêm từ phía nam', north: 'quân phương Bắc từ phía bắc' };

export function initWar(): WarState { return { invasions: [], enemiesAlive: 0, killedThisYear: 0, burnedByEnemies: 0 }; }

export function scheduleInvasion(s: GameState, year: number, month: number, source: InvasionSource, size: number): Invasion {
  const inv: Invasion = { year, month, source, size, warned: false, done: false };
  s.war.invasions.push(inv);
  return inv;
}

/** Ô đất ở mép bản đồ nơi giặc vào: cửa sông = đất cạnh ô sông chạm mép; nam = mép dưới; bắc = mép trên (gần giữa). */
export function invasionEntry(s: GameState, source: InvasionSource): number {
  const g = s.grid;
  const landAt = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && isLand(g, gridOffset(x, y));
  if (source === 'sea') {
    const edge = riverEdgeTile(s);
    if (edge >= 0) {
      const ex = edge % GRID_SIZE, ey = (edge / GRID_SIZE) | 0;
      for (let d = 1; d < GRID_SIZE; d++) for (const [x, y] of [[ex + d, ey], [ex - d, ey], [ex, ey + d], [ex, ey - d]]) if (landAt(x, y) && !(g.terrain[gridOffset(x, y)] & T_WATER)) return gridOffset(x, y);
    }
  }
  const y = source === 'north' ? 0 : GRID_SIZE - 1;
  for (let d = 0; d < GRID_SIZE / 2; d++) for (const x of [GRID_SIZE / 2 + d, GRID_SIZE / 2 - d]) if (landAt(x, y)) return gridOffset(x, y);
  return s.entryOffset;
}

function spawnEnemies(s: GameState, inv: Invasion): void {
  const at = invasionEntry(s, inv.source);
  let n = 0;
  for (let k = 0; k < inv.size; k++) {
    const f = createFigure(s, FigureType.Enemy, at, 0);
    if (!f) break;
    f.hp = WAR.enemyHp; f.loads = WAR.raidBudget; f.boatHome = at; f.destBuildingId = 0;
    n++;
  }
  s.war.enemiesAlive += n;
  s.events.push(`Giặc tới: ${inv.size} tên ${SOURCE_TEXT[inv.source]}!`);
}

/** Mỗi ngày (tick 27). */
export function updateWar(s: GameState): void {
  if (s.time.day !== 0) { spawnMilitia(s); return; }
  for (const inv of s.war.invasions) {
    if (inv.done) continue;
    const absMonth = (inv.year - 1) * 12 + (inv.month - 1), now = s.time.year * 12 + s.time.month;
    if (!inv.warned && now >= absMonth - WAR.warningMonths) { inv.warned = true; s.events.push(`Tin báo: ${SOURCE_TEXT[inv.source]} sẽ tới trong ${absMonth - now} tháng, ${inv.size} tên`); }
    if (now >= absMonth) { inv.done = true; spawnEnemies(s, inv); }
  }
  spawnMilitia(s);
}

/** Trại lính có người làm và có vũ khí: mỗi kiện một lính, tối đa perBarracks lính mỗi trại. */
function spawnMilitia(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Barracks || b.numWorkers <= 0 || b.flooded || b.store[17] < UNITS_PER_LOAD) continue;
    let n = 0;
    for (const f of s.figures) if (f.type === FigureType.Militia && f.buildingId === b.id) n++;
    if (n >= WAR.perBarracks) continue;
    const door = roadAccess(s.grid, b);
    if (door < 0) continue;
    const f = createFigure(s, FigureType.Militia, door, b.id);
    if (!f) return;
    f.hp = WAR.militiaHp;
    b.store[17] -= UNITS_PER_LOAD; // Resource.Weapons
  }
}

/** Công trình gần nhất (Chebyshev) để giặc nhắm tới; bỏ đống tro, đê, thành. */
export function nearestTarget(s: GameState, x: number, y: number, walls: boolean): Building | null {
  let best: Building | null = null, bd = 1e9;
  for (const b of s.buildings) {
    if (b.type === BuildingType.None || b.type === BuildingType.Ruins || b.type === BuildingType.Dike || b.type === BuildingType.Sluice) continue;
    const isW = b.type === BuildingType.EarthWall || b.type === BuildingType.StoneWall;
    if (isW !== walls) continue;
    const d = Math.max(Math.abs(b.x + (b.size - 1) / 2 - x), Math.abs(b.y + (b.size - 1) / 2 - y));
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
export const nextInvasion = (s: GameState): Invasion | null => s.war.invasions.find((i) => !i.done) ?? null;
