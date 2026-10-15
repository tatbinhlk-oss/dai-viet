// Điều kiện thắng / thua — city_victory_check của Julius: đủ dân và 4 ngưỡng chỉ số → thắng;
// bị cách chức (Ân sủng ≤ 10 quá 192 ngày) hoặc hết hạn năm → thua. Kiểm mỗi ngày (tick 49).
import { BuildingType, FigureType, type GameState, type Goals } from '../state';
import { logEvent } from '../log';
import { RANK_NAMES } from '../city/court';
import { applyLandGrants } from '../map/mapfile';
import { court } from '../buildings/defs';
import { sendCourtTroops } from '../city/war';

/** M7: bị cách chức — màn chơi kết thúc, dừng. */
export function dismissCity(s: GameState, why: string): void {
  if (s.gameOver) return;
  s.gameOver = 'dismissed';
  s.speed = 0;
  logEvent(s, `${why}. Triều đình cử quan khác đến thay. Màn chơi kết thúc.`);
}

export function goalsMet(s: GameState): boolean {
  const g = s.scenario.goals;
  return s.population >= g.population && s.ratings.culture >= g.culture && s.ratings.prosperity >= g.prosperity && s.ratings.peace >= g.peace && s.court.favor >= g.favor;
}

export function currentRatings(s: GameState): Goals {
  return { population: s.population, culture: s.ratings.culture, prosperity: s.ratings.prosperity, peace: s.ratings.peace, favor: s.court.favor };
}

export function checkVictory(s: GameState): void {
  if (s.gameOver) return;
  const hasGoals = s.scenario.goals.population > 0; // chơi tự do (không kịch bản): không có thắng / hết hạn
  if (s.court.dismissalDay >= 0 && s.time.totalDays >= s.court.dismissalDay) {
    // M7: có nha môn thì quân triều đình kéo tới (cơ chế giặc) — chiếm nha môn mới mất chức; đánh lui được thì có đợt sau
    if (!s.buildings.some((b) => b.type === BuildingType.Yamen)) dismissCity(s, 'Không có nha môn để giữ');
    else {
      if (!s.figures.some((f) => f.type === FigureType.CourtTroops)) sendCourtTroops(s);
      s.court.dismissalDay = s.time.totalDays + court.favor.dismissWarningDays;
    }
  } else if (!hasGoals) {
    return;
  } else if (goalsMet(s)) {
    s.gameOver = 'won';
    // M6b: thăng phẩm hàm theo chuỗi màn — ít nhất một bậc, hoặc tới bậc màn ghi (promoteTo)
    s.court.rank = Math.min(RANK_NAMES.length - 1, Math.max(s.court.rank + 1, s.scenario.promoteTo));
    logEvent(s, `Đạt mọi mục tiêu của ${s.scenario.name}: được phong ${RANK_NAMES[s.court.rank]}!`);
    const opened = applyLandGrants(s.grid, s.scenario.land, s.court.rank, s.dirty);
    if (opened) logEvent(s, `Triều đình cấp thêm ${opened} ô đất`);
  } else if (s.scenario.timeLimitYears > 0 && s.time.year >= s.scenario.timeLimitYears) {
    s.gameOver = 'timeout';
    logEvent(s, 'Hết hạn triều đình giao mà chưa đạt mục tiêu.');
  }
  if (s.gameOver) s.speed = 0;
}
