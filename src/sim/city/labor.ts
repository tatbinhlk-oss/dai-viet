// Lao động 9 ngành — city/labor.c của Julius.
// Nhân công = 60% dân (trừ quan lại). Ngành có ưu tiên được lấp trước theo thứ tự; phần còn lại chia theo tỉ lệ nhu cầu.
// Trong một ngành, mỗi công trình nhận cùng tỉ lệ phần trăm. Công trình chưa có người mộ phu thấy nhà thì không có người.
import { BuildingType, LABOR_CATS, LaborCat, type GameState } from '../state';
import { corveePct } from './court';
import { BUILDING_DEFS, economy, HOUSE_LEVELS } from '../buildings/defs';
import { roadAccess } from '../buildings/spawn';

export const LABOR_NAMES = ['Lương thực', 'Thủ công & buôn bán', 'Thợ cả', 'Nước', 'Tuần phòng', 'Quân sự', 'Giải trí', 'Y tế & giáo dục', 'Hành chính & tín ngưỡng', 'Lao dịch'];

/** Mỗi ngày (tick 25). */
export function updateLabor(s: GameState): void {
  const L = s.labor;
  let working = 0;
  for (const b of s.buildings) {
    if (b.type === BuildingType.House && HOUSE_LEVELS[b.level].tier < 2) working += b.population;
  }
  L.workforce = Math.floor((working * economy.workforcePct) / 100);

  const needed = new Array(LABOR_CATS).fill(0);
  const eligible: boolean[] = [];
  for (const b of s.buildings) {
    const def = BUILDING_DEFS[b.type];
    eligible[b.id] = false;
    if (!def || def.workers === 0 || def.labor < 0) continue;
    if (b.housesCovered <= 0 || roadAccess(s.grid, b) < 0) { b.numWorkers = 0; continue; }
    eligible[b.id] = true;
    needed[def.labor] += def.workers;
  }

  const alloc = new Array(LABOR_CATS).fill(0);
  let left = L.workforce;
  // 0. M5: lao dịch theo chiếu chỉ rút trước, người chơi không chỉnh được
  const corvee = Math.floor((L.workforce * corveePct(s)) / 100);
  needed[LaborCat.Corvee] = corvee;
  alloc[LaborCat.Corvee] = corvee;
  left -= corvee;
  s.court.corveeWorkers = corvee;
  // 1. ngành có ưu tiên, theo thứ tự 1 → 9
  const prioritized = [...Array(LABOR_CATS).keys()].filter((c) => c !== LaborCat.Corvee && L.priority[c] > 0).sort((a, b) => L.priority[a] - L.priority[b]);
  for (const c of prioritized) { alloc[c] = Math.min(needed[c], left); left -= alloc[c]; }
  // 2. còn lại chia theo tỉ lệ
  const rest = [...Array(LABOR_CATS).keys()].filter((c) => c !== LaborCat.Corvee && L.priority[c] === 0);
  const restNeed = rest.reduce((a, c) => a + needed[c], 0);
  if (restNeed <= left) for (const c of rest) { alloc[c] = needed[c]; left -= needed[c]; }
  else if (restNeed > 0) {
    let given = 0;
    for (const c of rest) { alloc[c] = Math.floor((needed[c] * left) / restNeed); given += alloc[c]; }
    let extra = left - given;
    for (const c of rest) { if (extra <= 0) break; if (alloc[c] < needed[c]) { alloc[c]++; extra--; } }
    left = extra;
  }

  // 3. trong ngành: cùng tỉ lệ cho mọi công trình, phần lẻ cấp lần lượt
  const leftover = [...alloc];
  for (const b of s.buildings) {
    if (!eligible[b.id]) continue;
    const def = BUILDING_DEFS[b.type];
    const c = def.labor as number;
    const n = needed[c] > 0 ? Math.floor((def.workers * alloc[c]) / needed[c]) : 0;
    b.numWorkers = n;
    leftover[c] -= n;
  }
  for (const b of s.buildings) {
    if (!eligible[b.id]) continue;
    const def = BUILDING_DEFS[b.type];
    const c = def.labor as number;
    const add = Math.min(leftover[c], def.workers - b.numWorkers);
    if (add > 0) { b.numWorkers += add; leftover[c] -= add; }
  }

  L.needed = needed;
  L.allocated = alloc;
  L.employed = alloc.reduce((a, v) => a + v, 0);
  L.unemploymentPct = L.workforce > 0 ? Math.round(((L.workforce - L.employed) * 100) / L.workforce) : 0;
}
