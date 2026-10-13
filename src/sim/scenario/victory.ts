// Điều kiện thắng / thua — city_victory_check của Julius: đủ dân và 4 ngưỡng chỉ số → thắng;
// bị cách chức (Ân sủng ≤ 10 quá 192 ngày) hoặc hết hạn năm → thua. Kiểm mỗi ngày (tick 49).
import type { GameState, Goals } from '../state';

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
    s.gameOver = 'dismissed';
    s.events.push('Triều đình cử quan khác đến thay. Màn chơi kết thúc.');
  } else if (!hasGoals) {
    return;
  } else if (goalsMet(s)) {
    s.gameOver = 'won';
    s.events.push(`Đạt mọi mục tiêu của ${s.scenario.name}: được thăng phẩm hàm!`);
    s.court.rank = Math.min(8, s.court.rank + 1);
  } else if (s.scenario.timeLimitYears > 0 && s.time.year >= s.scenario.timeLimitYears) {
    s.gameOver = 'timeout';
    s.events.push('Hết hạn triều đình giao mà chưa đạt mục tiêu.');
  }
  if (s.gameOver) s.speed = 0;
}
