// Cổng M5: một màn chơi thắng được trong 45 phút — kịch bản Sơn Nam (src/data/scenarios/son-nam.json) trên thị trấn mẫu,
// người chơi tự động làm các thao tác cơ bản (thi hành chiếu chỉ, mở lễ hội, tiến cống, vá đê) và đạt mục tiêu
// (dân + ngưỡng 4 chỉ số) trong số năm tương ứng 45 phút (1× = 2,5 s/ngày → ≈ 5,6 năm; 2× → 11 năm).
import { describe, expect, it } from 'vitest';
import { applyCommand, tick } from '../src/sim';
import { createScenario } from '../src/sim/scenario/loader';
import { buildCourtTown, demoPriorities, planDikeLine } from '../src/sim/scenario/demo';
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { goalsMet } from '../src/sim/scenario/victory';
import { festivalCost } from '../src/sim/city/worship';
import { giftCost } from '../src/sim/city/court';
import { prosperityCap } from '../src/sim/city/ratings';

const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;

/** Người chơi tự động: mỗi tháng xem nha môn và tín ngưỡng, mỗi năm vá đê. */
export function autoPlayer(s: GameState): void {
  if (s.time.day === 0 && s.time.month === 0) planDikeLine(s, 7, 0, 159, 5);
  if (s.time.day !== 0) return;
  if (s.taxRate < 11) applyCommand(s, { type: 'setTax', rate: 11 }); // Tết, cống nạp, bổng lộc cần thêm thuế; 9–11% cùng mức lòng dân −1 (economy.json)
  for (const e of s.court.edicts) {
    if (e.state !== 'active') continue;
    if (e.type === 'corvee' && e.corveePct === 0) applyCommand(s, { type: 'dispatchEdict', id: e.id, option: 1 });
    else if (e.type === 'goods' || e.type === 'money' || e.type === 'troops') applyCommand(s, { type: 'dispatchEdict', id: e.id });
  }
  s.worship.gods.forEach((g, d) => {
    if (g.mood < 45 && g.monthsSinceFestival >= 3 && s.treasury > festivalCost(s, 0) + 300) applyCommand(s, { type: 'holdFestival', deity: d, size: 0 });
  });
  if (s.court.personalFunds >= giftCost(s, 1) && s.court.giftsInWindow.length < 2 && s.court.favor < s.scenario.goals.favor) applyCommand(s, { type: 'sendGift', size: 1 });
}

describe('cổng M5: màn Sơn Nam', () => {
  it('người chơi tự động thắng màn trong hạn', () => {
    const s = createScenario('sonNam', 3, true);
    buildCourtTown(s);
    demoPriorities(s);
    const t0 = performance.now();
    let wonYear = -1;
    for (let y = 1; y <= s.scenario.timeLimitYears; y++) {
      for (let i = 0; i < TICKS_PER_YEAR; i++) {
        if (s.time.tick === 0) autoPlayer(s);
        tick(s);
        if (s.gameOver) break;
      }
      const g = s.scenario.goals, r = s.ratings, c = s.court;
      console.log(`năm ${y}: dân ${s.population}/${g.population} · văn hiến ${r.culture}/${g.culture} · thịnh vượng ${r.prosperity}/${g.prosperity} (trần ${prosperityCap(s)}) · trị an ${r.peace}/${g.peace} · ân sủng ${c.favor}/${g.favor} · sức khỏe ${r.health} · ngân khố ${s.treasury} · bổng lộc ${c.personalFunds} · chiếu chỉ ${c.edicts.map((e) => `${e.type}:${e.state}`).join(',')} · thần ${s.worship.gods.map((x) => x.mood).join('/')} · ${s.gameOver || ''}`);
      if (s.gameOver) { wonYear = y; break; }
    }
    console.log('ms', Math.round(performance.now() - t0), '· sự kiện:', s.events.join(' | '));
    expect(s.gameOver).toBe('won');
    expect(goalsMet(s)).toBe(true);
    expect(wonYear).toBeLessThanOrEqual(6); // ≈ 45 phút ở tốc độ thường
  }, 120000);
});
