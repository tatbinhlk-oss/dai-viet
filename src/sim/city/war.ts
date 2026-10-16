// Giặc giã — thiết kế phần 6 (invasion của Julius rút gọn). Ba nguồn theo kịch bản: cướp biển từ cửa sông, quân Chiêm từ nam,
// quân phương Bắc từ bắc. Báo trước 2 tháng; đến ngày thì giặc xuất hiện ở mép bản đồ, đi tới công trình gần nhất và đốt.
// Trại lính biến vũ khí thành lính; thành đất / thành đá chặn đường giặc.
import { BuildingType, FigureType, isMilitaryBase, isSoldier, type Building, type GameState, type Invasion, type InvasionSource, type WarState } from '../state';
import { logEvent } from '../log';
import { GRID_SIZE, gridOffset, isLand, offsetX, offsetY, T_WATER } from '../map/grid';
import { trade } from './trade';
import { createFigure } from '../figures/figure';
import { riverEdgeTile } from './trade';
import { roadAccess } from '../buildings/spawn';
import { UNITS_PER_LOAD } from '../buildings/defs';

export const WAR = trade.war;
export const SOURCE_TEXT: Record<InvasionSource, string> = { sea: 'cướp biển từ cửa sông', south: 'quân Chiêm từ phía nam', north: 'quân phương Bắc từ phía bắc' };
/** M8: chỉ số nguồn giặc ghi vào figure.route (render chọn hình: 0 Chiêm, 1 cướp biển, 2 phương Bắc). */
export const SOURCE_INDEX: Record<InvasionSource, number> = { south: 0, sea: 1, north: 2 };

export function initWar(): WarState { return { invasions: [], enemiesAlive: 0, killedThisYear: 0, burnedByEnemies: 0 }; }

export function scheduleInvasion(s: GameState, year: number, month: number, source: InvasionSource, size: number): Invasion {
  const inv: Invasion = { year, month, source, size, warned: false, done: false };
  s.war.invasions.push(inv);
  return inv;
}

/** Ô đất ở mép bản đồ nơi giặc vào: cửa sông = đất cạnh ô sông chạm mép; nam = mép dưới; bắc = mép trên (gần giữa). */
export function invasionEntry(s: GameState, source: InvasionSource): number {
  if (s.enemyEntry[source] >= 0) return s.enemyEntry[source]; // M6b: mép giặc vào ghi trong file bản đồ
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
    f.hp = WAR.enemyHp; f.loads = WAR.raidBudget; f.boatHome = at; f.destBuildingId = 0; f.route = SOURCE_INDEX[inv.source];
    n++;
  }
  s.war.enemiesAlive += n;
  logEvent(s, `Giặc tới: ${inv.size} tên ${SOURCE_TEXT[inv.source]}!`, at);
}

/** M7: quân triều đình đến cách chức — vào từ cửa ngõ, nhắm nha môn theo cơ chế giặc (lính chặn được, thành / cổng phải phá). */
export function sendCourtTroops(s: GameState): number {
  const at = s.entryOffset;
  let n = 0;
  for (let k = 0; k < WAR.dismissalTroops; k++) {
    const f = createFigure(s, FigureType.CourtTroops, at, 0);
    if (!f) break;
    f.hp = WAR.enemyHp; f.loads = 1; f.boatHome = at; f.destBuildingId = 0;
    n++;
  }
  if (n) logEvent(s, `Quân triều đình (${n} toán) kéo tới nha môn để cách chức!`, at);
  return n;
}

/** M8: có chòi canh biên có người gác trong watchtowerRange ô quanh mép giặc vào của nguồn này → báo sớm thêm. */
export function watchtowerCovers(s: GameState, source: InvasionSource): boolean {
  const at = invasionEntry(s, source);
  const ax = offsetX(at), ay = offsetY(at);
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Watchtower || b.numWorkers <= 0 || b.flooded) continue;
    if (Math.max(Math.abs(b.x - ax), Math.abs(b.y - ay)) <= WAR.watchtowerRange) return true;
  }
  return false;
}
/** Số tháng báo trước cho một đợt giặc (2, có chòi canh phủ mép vào thì 3). */
export const warningLead = (s: GameState, source: InvasionSource): number => WAR.warningMonths + (watchtowerCovers(s, source) ? WAR.watchtowerBonusMonths : 0);

/** Mỗi ngày (tick 27). */
export function updateWar(s: GameState): void {
  if (s.time.day !== 0) { spawnSoldiers(s); return; }
  for (const inv of s.war.invasions) {
    if (inv.done) continue;
    const absMonth = (inv.year - 1) * 12 + (inv.month - 1), now = s.time.year * 12 + s.time.month;
    if (!inv.warned && now >= absMonth - warningLead(s, inv.source)) {
      inv.warned = true;
      const early = absMonth - now > WAR.warningMonths;
      logEvent(s, `${early ? 'Chòi canh báo sớm' : 'Tin báo'}: ${SOURCE_TEXT[inv.source]} sẽ tới trong ${absMonth - now} tháng, ${inv.size} tên`, invasionEntry(s, inv.source));
    }
    if (now >= absMonth) { inv.done = true; spawnEnemies(s, inv); }
  }
  spawnSoldiers(s);
}

/** Loại quân và quân số tối đa của một công trình quân sự. */
export function squadKind(t: BuildingType): { figure: FigureType; max: number; hp: number } {
  if (t === BuildingType.ArcherCamp) return { figure: FigureType.Archer, max: WAR.perArcherCamp, hp: WAR.archerHp };
  if (t === BuildingType.ElephantStable) return { figure: FigureType.Elephant, max: WAR.perStable, hp: WAR.elephantHp };
  return { figure: FigureType.Militia, max: WAR.perBarracks, hp: WAR.militiaHp };
}
/** Quân của đội (figure thuộc công trình `b`), theo id tăng dần — thứ tự xếp đội hình. */
export function squadMembers(s: GameState, b: Building): import('../state').Figure[] {
  const out: import('../state').Figure[] = [];
  for (const f of s.figures) if (isSoldier(f.type) && f.buildingId === b.id) out.push(f);
  return out;
}

/** Mỗi ngày: trại lính / trại cung thủ có người làm và có vũ khí → mỗi kiện một quân, tới mức tối đa; tàu voi huấn luyện theo ngày. */
function spawnSoldiers(s: GameState): void {
  for (const b of s.buildings) {
    if (!isMilitaryBase(b.type) || b.numWorkers <= 0 || b.flooded) continue;
    const k = squadKind(b.type);
    if (squadMembers(s, b).length >= k.max) { if (b.type === BuildingType.ElephantStable) b.progress = 0; continue; }
    if (b.type === BuildingType.ElephantStable) { if (++b.progress < WAR.elephantTrainDays) continue; }
    else if (b.store[17] < UNITS_PER_LOAD) continue; // Resource.Weapons
    const door = roadAccess(s.grid, b);
    if (door < 0) continue;
    const f = createFigure(s, k.figure, door, b.id);
    if (!f) return;
    f.hp = k.hp;
    if (b.type === BuildingType.ElephantStable) { b.progress = 0; logEvent(s, 'Tàu voi huấn luyện xong một voi trận', door); }
    else b.store[17] -= UNITS_PER_LOAD;
  }
}

/** Vựa / kho còn ít nhất một kiện hàng (mục tiêu cướp của giặc, M8). */
export const hasLoot = (b: Building): boolean => (b.type === BuildingType.Granary || b.type === BuildingType.Warehouse) && b.store.some((u) => u >= UNITS_PER_LOAD);

/** Công trình gần nhất (Chebyshev) để giặc nhắm tới; bỏ đống tro, đê, thành. `loot` (M8): vựa / kho có hàng được tính gần hơn (× lootBias). */
export function nearestTarget(s: GameState, x: number, y: number, walls: boolean, loot = false): Building | null {
  let best: Building | null = null, bd = 1e9;
  for (const b of s.buildings) {
    if (b.type === BuildingType.None || b.type === BuildingType.Ruins || b.type === BuildingType.Dike || b.type === BuildingType.Sluice) continue;
    const isW = b.type === BuildingType.EarthWall || b.type === BuildingType.StoneWall || b.type === BuildingType.Gate;
    if (isW !== walls) continue;
    let d = Math.max(Math.abs(b.x + (b.size - 1) / 2 - x), Math.abs(b.y + (b.size - 1) / 2 - y));
    if (loot && hasLoot(b)) d *= WAR.lootBias;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
export const nextInvasion = (s: GameState): Invasion | null => s.war.invasions.find((i) => !i.done) ?? null;
