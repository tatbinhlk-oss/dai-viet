// QoL: cố vấn tổng quan (chief advisor của Caesar 3) — liệt kê vấn đề đang có, chỗ cần tới, và tiến độ mục tiêu.
import { BuildingType, DEITIES, FOODS, type GameState } from '../state';
import { gridOffset, T_FLOODPLAIN, T_UNPROTECTED } from '../map/grid';
import { buildingProblem } from '../overlay';
import { dikeSafety } from '../buildings/dike';
import { inFloodWatch } from '../flood/season';
import { DEITY_NAMES } from './worship';
import { nextInvasion, SOURCE_TEXT } from './war';
import { LABOR_NAMES } from './labor';
import { MOOD_CAUSE_TEXT } from './sentiment';
import { court } from '../buildings/defs';
import { DAYS_PER_MONTH } from '../state';

export interface CityProblem { text: string; level: 'bad' | 'warn'; at: number }

export function cityProblems(s: GameState): CityProblem[] {
  const out: CityProblem[] = [];
  const bad = (text: string, at = -1) => out.push({ text, level: 'bad', at });
  const warn = (text: string, at = -1) => out.push({ text, level: 'warn', at });
  if (s.treasury < 0) bad(`Ngân khố âm (${s.treasury} quan): không trả lương, không nộp cống được`);
  if (s.court.dismissalDay >= 0) bad(`Triều đình sẽ cử quan khác đến thay sau ${s.court.dismissalDay - s.time.totalDays} ngày — nâng Ân sủng (tiến cống, chiếu chỉ)`);
  else if (s.court.favor <= 20) bad(`Ân sủng thấp (${s.court.favor}) — ≤ ${court.favor.dismissAtOrBelow} là bị cách chức`);
  for (const e of s.court.edicts) {
    if (e.state !== 'active') continue;
    const left = Math.ceil((e.deadlineDay - s.time.totalDays) / DAYS_PER_MONTH);
    if (left <= 3) warn(`Chiếu chỉ "${e.title}" còn ${Math.max(0, left)} tháng`);
  }
  const inv = nextInvasion(s);
  if (inv && inv.warned) { const months = (inv.year - 1) * 12 + (inv.month - 1) - (s.time.year * 12 + s.time.month); warn(months <= 0 ? `Giặc đang ở trong thành: ${inv.size} tên ${SOURCE_TEXT[inv.source]}` : `Giặc sắp tới: ${inv.size} tên ${SOURCE_TEXT[inv.source]} trong ${months} tháng — cần trại lính có vũ khí`); }
  if (s.population >= 50 && s.sentiment < 40) bad(`Lòng dân thấp (${s.sentiment})${s.lowMoodCause !== 'none' ? ` vì ${MOOD_CAUSE_TEXT[s.lowMoodCause]}` : ''}`);
  if (s.labor.workforce > 0 && s.labor.unemploymentPct > 15) warn(`Thất nghiệp ${s.labor.unemploymentPct}% — xây thêm xưởng, ruộng`);
  const short = LABOR_NAMES.map((n, i) => (s.labor.allocated[i] < s.labor.needed[i] ? n : '')).filter(Boolean);
  if (short.length) warn(`Thiếu nhân công: ${short.join(', ')} — xây thêm nhà ở gần hoặc đổi ưu tiên lao động`);
  // nhà ở
  let houses = 0, noFood = 0, noWater = 0, hungry = 0, firstNoFood = -1, firstNoWater = -1, unprotected = 0, firstUnprot = -1;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    houses++;
    if (!FOODS.some((r) => b.store[r] > 0)) { noFood++; if (firstNoFood < 0) firstNoFood = gridOffset(b.x, b.y); }
    if (b.hungryPeriods >= 2) hungry++;
    if (b.water === 0) { noWater++; if (firstNoWater < 0) firstNoWater = gridOffset(b.x, b.y); }
    const o = gridOffset(b.x, b.y);
    if (s.grid.terrain[o] & T_FLOODPLAIN && s.grid.terrain[o] & T_UNPROTECTED) { unprotected++; if (firstUnprot < 0) firstUnprot = o; }
  }
  if (houses > 0 && hungry > 0) bad(`${hungry} nhà đang đói — cần chợ gần và ruộng / vựa có hàng`, firstNoFood);
  else if (houses >= 5 && noFood * 4 > houses) warn(`${noFood}/${houses} nhà không có lương thực — chợ chưa tới`, firstNoFood);
  if (houses >= 5 && noWater * 4 > houses) warn(`${noWater}/${houses} nhà không có nước — xây giếng gần`, firstNoWater);
  // công trình có vấn đề
  let problems = 0, firstProblem = -1;
  for (const b of s.buildings) if (b.type !== BuildingType.None && b.type !== BuildingType.House && buildingProblem(s, b)) { problems++; if (firstProblem < 0) firstProblem = gridOffset(b.x, b.y); }
  if (problems) warn(`${problems} công trình có vấn đề (xem lớp phủ "Có vấn đề")`, firstProblem);
  // lũ và đê
  if (inFloodWatch(s)) {
    const d = dikeSafety(s);
    if (d.built > 0 && d.safety < 60) bad(`Đê yếu: độ bền ${d.safety}% — cần trại thợ gần đê`);
    if (d.planned > 0) warn(`${d.planned} đoạn đê chưa đắp xong — đình làng cần người để cử phu`);
    if (unprotected > 0) warn(`${unprotected} nhà trên bãi bồi chưa có đê che — lũ vừa sẽ ngập`, firstUnprot);
  }
  if (s.flood.breachesThisYear > 0 && s.flood.dayInSeason >= 0) bad(`Vỡ đê ${s.flood.breachesThisYear} chỗ mùa này`);
  // thần linh
  if (s.population >= 100) for (let d = 0; d < DEITIES; d++) { const g = s.worship.gods[d]; if (g.mood < 40) (g.mood < 25 ? bad : warn)(`${DEITY_NAMES[d]} giận (${g.mood}) — mở lễ hội, thêm đền`); }
  return out;
}
