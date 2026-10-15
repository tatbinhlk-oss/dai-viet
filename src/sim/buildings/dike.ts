// Đoạn đê và cống — thiết kế phần 5. Mỗi ô một đoạn, height 0–4, integrity 0–100.
// Người chơi vẽ tuyến đê (height 0, targetHeight 1); phu đê từ đình làng tới đắp từng mức.
// Vẽ lại lên đoạn đê có sẵn = tôn cao thêm một mức. Vỡ đê → ô đất trũng, nước tràn.
import { BuildingType, isDike, type Building, type GameState } from '../state';
import { logEvent } from '../log';
import { gridOffset, inBounds, T_BUILDING, T_FLOODPLAIN, T_ROAD, T_SUNKEN, T_WATER } from '../map/grid';
import { flood } from './defs';
import { anchorOffset, placeBuilding, removeBuilding } from './spawn';

const D = flood.dike;

/** Mức cao hữu hiệu ghi vào lưới: cống mở = 0. Render đọc bLevel = height (+16 nếu cống mở). */
export function syncDikeTile(s: GameState, b: Building): void {
  const o = anchorOffset(b.x, b.y, 1);
  s.grid.dike[o] = b.type === BuildingType.Sluice && b.sluiceOpen ? 0 : b.height;
  s.grid.bLevel[o] = b.height + (b.sluiceOpen ? 16 : 0);
  s.dirty.add(o);
  s.flood.dikesChanged = true;
}

/** Lệnh "đê"/"cống" tại ô: có đê rồi thì tôn cao (target + 1, tối đa 4); chưa thì vẽ đoạn mới. Trả id. */
export function planDike(s: GameState, type: BuildingType, x: number, y: number): number {
  if (!inBounds(x, y)) return 0;
  const o = gridOffset(x, y);
  const existing = s.buildings[s.grid.buildingId[o]];
  if (existing && isDike(existing.type)) {
    if (existing.targetHeight < D.maxHeight) existing.targetHeight++;
    return existing.id;
  }
  const id = placeBuilding(s, type, x, y);
  if (!id) return 0;
  const b = s.buildings[id];
  b.height = 0;
  b.targetHeight = 1;
  b.integrity = D.integrityMax;
  syncDikeTile(s, b);
  return id;
}

/** Công cần cho mức kế tiếp (người-tick). Mức đầu đắt hơn vì phải đào đất. */
export const workNeeded = (b: Building): number => (b.height === 0 ? D.manDaysFirstLevel : D.manDaysRaise) * 50;
export const dikeNeedsWork = (b: Building): boolean => isDike(b.type) && b.height < b.targetHeight;

/** Hoàn thành một mức: cao thêm 1, bền lại 100. */
export function raiseDike(s: GameState, b: Building): void {
  b.height = Math.min(D.maxHeight, b.height + 1);
  b.workDone = 0;
  b.integrity = D.integrityMax;
  syncDikeTile(s, b);
}

/**
 * Lấy một kiện đất cho mức đầu: ô bãi bồi trống gần nhất (không đường, không công trình, chưa trũng)
 * thành đất trũng — thấp đi một mức, độ hấp dẫn âm. Không tìm được thì vẫn đắp (đất chở từ xa).
 */
export function takeEarth(s: GameState, b: Building): void {
  b.earthTaken = true;
  const g = s.grid;
  for (let r = 1; r <= D.earthSearchRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = b.x + dx, y = b.y + dy;
        if (!inBounds(x, y)) continue;
        const o = gridOffset(x, y);
        const t = g.terrain[o];
        if (!(t & T_FLOODPLAIN) || t & (T_WATER | T_ROAD | T_BUILDING | T_SUNKEN)) continue;
        sinkTile(s, o);
        return;
      }
    }
  }
}

export function sinkTile(s: GameState, o: number): void {
  s.grid.terrain[o] |= T_SUNKEN;
  if (s.grid.elevation[o] > 0) s.grid.elevation[o]--;
  s.dirty.add(o);
}

/** Vỡ đê: đoạn đê biến mất, ô thành đất trũng, nước tràn (flood-fill hôm đó tính lại). */
export function breachDike(s: GameState, b: Building): void {
  const o = gridOffset(b.x, b.y);
  removeBuilding(s, b);
  sinkTile(s, o);
  s.flood.breachesThisYear++;
  s.ratings.breachesThisYear++; // M5: Trị an
  s.flood.breachMoodPeriods = flood.consequences.breachMoodPeriods;
  logEvent(s, `Vỡ đê tại (${b.x}, ${b.y})!`, gridOffset(b.x, b.y));
}

export function setSluice(s: GameState, b: Building, open: boolean): void {
  if (b.type !== BuildingType.Sluice || b.sluiceOpen === open) return;
  b.sluiceOpen = open;
  syncDikeTile(s, b);
}

/** Đê có chạm nước không: ô kề là sông hoặc đang ngập, hoặc chính nó bị tràn. */
export function dikeTouchesWater(s: GameState, b: Building): boolean {
  const g = s.grid;
  const T = 1 | 32; // T_WATER | T_FLOODED
  if (g.terrain[gridOffset(b.x, b.y)] & 32) return true;
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const x = b.x + dx, y = b.y + dy;
    if (inBounds(x, y) && g.terrain[gridOffset(x, y)] & T) return true;
  }
  return false;
}

/**
 * Mỗi ngày (trong updateFlood): trong mùa lũ, nước chạm đê → integrity −= (mực lũ − cao + 1) × 2;
 * ngoài mùa lũ −1 mỗi 4 ngày (sạt lở, mối). Integrity ≤ 0 → vỡ. Đoạn chưa đắp (cao 0) không tính.
 */
export function updateDikes(s: GameState, level: number, inSeason: boolean): void {
  const n = s.buildings.length;
  for (let i = 1; i < n; i++) {
    const b = s.buildings[i];
    if (!isDike(b.type) || b.height === 0) continue;
    if (inSeason) {
      if (level > 0 && dikeTouchesWater(s, b)) b.integrity -= Math.max(0, level - b.height + 1) * D.touchDamagePerLevel;
    } else if (s.time.totalDays % D.decayEveryDays === 0) {
      b.integrity -= 1;
    }
    if (b.integrity <= 0) breachDike(s, b);
  }
}

/** An toàn đê = integrity trung bình các đoạn đã đắp; 100 nếu chưa có đê. */
export function dikeSafety(s: GameState): { safety: number; built: number; planned: number } {
  let sum = 0, built = 0, planned = 0;
  for (const b of s.buildings) {
    if (!isDike(b.type)) continue;
    if (b.height === 0) { planned++; continue; }
    built++;
    sum += b.integrity;
    if (b.height < b.targetHeight) planned++;
  }
  return { safety: built ? Math.round(sum / built) : 100, built, planned };
}
