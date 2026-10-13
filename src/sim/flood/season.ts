// Mùa lũ — thiết kế phần 5. Mỗi năm một đợt từ tháng 6 đến tháng 9 âm lịch.
// Đỉnh lũ 1–4 quay theo xác suất 45/35/15/5. Từ tháng 4 nha môn (có người làm) báo trước, đúng 70%.
// Mực nước lên 24 ngày, giữ đỉnh 16 ngày, rút 24 ngày. Mỗi ngày trong mùa: flood-fill, hậu quả, độ bền đê.
import { BuildingType, type GameState } from '../state';
import { flood } from '../buildings/defs';
import { nextInt } from '../rng';
import { applyFlood, updateProtection } from './floodFill';
import { endOfSeason, updateFloodedBuildings } from './consequences';
import { updateDikes } from '../buildings/dike';

const S = flood.season;
export const LEVEL_NAMES: string[] = flood.levelNames;
export const SEASON_DAYS = S.riseDays + S.holdDays + S.recedeDays;
const START_MONTH = S.startMonth - 1; // index 0..11
const FORECAST_MONTH = S.forecastMonth - 1;

export function rollPeak(s: GameState): number {
  const r = nextInt(s.rng, 100);
  let acc = 0;
  const ch = flood.peakChances.byLevel;
  for (let i = 0; i < ch.length; i++) { acc += ch[i]; if (r < acc) return i + 1; }
  return ch.length;
}

/** Mực nước ngày thứ `d` (0-based) của mùa lũ với đỉnh `peak`. */
export function waterLevel(peak: number, d: number): number {
  if (d < S.riseDays) return Math.ceil((peak * (d + 1)) / S.riseDays);
  if (d < S.riseDays + S.holdDays) return peak;
  const r = d - S.riseDays - S.holdDays + 1;
  return Math.max(0, Math.ceil((peak * (S.recedeDays - r)) / S.recedeDays));
}

const hasYamen = (s: GameState): boolean => s.buildings.some((b) => b.type === BuildingType.Yamen && b.numWorkers > 0 && !b.flooded);

/** Mỗi ngày (tick 26). */
export function updateFlood(s: GameState): void {
  const F = s.flood;
  const { month, day } = s.time;

  // tháng 4: quay đỉnh (ẩn) và nha môn báo
  if (month === FORECAST_MONTH && day === 0 && F.nextPeak === 0) {
    F.nextPeak = rollPeak(s);
    if (hasYamen(s)) {
      let f = F.nextPeak;
      if (nextInt(s.rng, 100) >= S.forecastAccuracy) { f = 1 + nextInt(s.rng, 3); if (f >= F.nextPeak) f++; }
      F.forecast = f;
      s.events.push(`Nha môn báo: nước thượng nguồn lên, dự báo lũ ${LEVEL_NAMES[f]} (mức ${f})`);
    }
  }
  // ngày 1 tháng 6: lũ về
  if (month === START_MONTH && day === 0 && F.dayInSeason < 0) {
    if (F.nextPeak === 0) F.nextPeak = rollPeak(s);
    F.peak = F.nextPeak;
    F.nextPeak = 0;
    F.dayInSeason = 0;
    F.breachesThisYear = 0;
    s.events.push(`Lũ về: ${LEVEL_NAMES[F.peak]} (mức ${F.peak})`);
  }

  const inSeason = F.dayInSeason >= 0;
  if (inSeason) {
    F.level = waterLevel(F.peak, F.dayInSeason);
    // đê chịu nước hôm qua rồi mới tính nước hôm nay: vỡ thì nước tràn ngay trong ngày
    updateDikes(s, F.level, true);
    if (F.dikesChanged) { updateProtection(s); F.dikesChanged = false; }
    F.floodedTiles = applyFlood(s, F.level);
    const newly = updateFloodedBuildings(s);
    if (newly > 0 && F.dayInSeason > 0 && F.level >= 2) s.events.push(`Nước ngập ${newly} công trình`);
    if (++F.dayInSeason >= SEASON_DAYS) {
      // hết mùa: nước rút hẳn, ghi phù sa
      F.dayInSeason = -1;
      F.level = 0;
      F.peak = 0;
      F.forecast = 0;
      F.floodedTiles = applyFlood(s, 0);
      updateFloodedBuildings(s);
      const { silted } = endOfSeason(s);
      s.events.push(silted ? `Nước rút, ${silted} ruộng được phù sa` : 'Nước rút');
    }
  } else {
    updateDikes(s, 0, false);
    if (F.dikesChanged) { updateProtection(s); F.dikesChanged = false; }
    if (F.floodedTiles > 0) { F.floodedTiles = applyFlood(s, 0); updateFloodedBuildings(s); }
  }
}

export const inFloodWatch = (s: GameState): boolean => s.time.month >= FORECAST_MONTH && s.time.month <= START_MONTH + 3;
