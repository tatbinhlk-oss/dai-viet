// Cổng M5: một màn chơi thắng được trong 45 phút — kịch bản Sơn Nam (src/data/scenarios/son-nam.json) trên thị trấn mẫu,
// người chơi tự động làm các thao tác cơ bản (thi hành chiếu chỉ, mở lễ hội, tiến cống, vá đê) và đạt mục tiêu
// (dân + ngưỡng 4 chỉ số) trong số năm tương ứng 45 phút (1× = 2,5 s/ngày → ≈ 5,6 năm; 2× → 11 năm).
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim';
import { createScenario } from '../src/sim/scenario/loader';
import { buildCourtTown, demoPriorities } from '../src/sim/scenario/demo';
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY } from '../src/sim/state';
import { goalsMet } from '../src/sim/scenario/victory';
import { prosperityCap } from '../src/sim/city/ratings';
import { autoPlayer } from './helpers';

const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;

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
      console.log(`năm ${y}: dân ${s.population}/${g.population} · văn hiến ${r.culture}/${g.culture} · thịnh vượng ${r.prosperity}/${g.prosperity} (trần ${prosperityCap(s)}) · trị an ${r.peace}/${g.peace} · ân sủng ${c.favor}/${g.favor} · sức khỏe ${r.health} · ngân khố ${s.treasury} · bổng lộc ${c.personalFunds} · chiếu chỉ ${c.edicts.map((e) => `${e.type}:${e.state}`).join(',')} · thần ${s.worship.gods.map((x) => x.mood).join('/')} · buôn bán ${s.lastYear.exports}/${s.lastYear.imports} thuyền ${s.trade.shipsThisYear} · ${s.gameOver || ''}`);
      if (s.gameOver) { wonYear = y; break; }
    }
    console.log('ms', Math.round(performance.now() - t0), '· sự kiện:', s.events.join(' | '));
    expect(s.gameOver).toBe('won');
    expect(goalsMet(s)).toBe(true);
    expect(wonYear).toBeLessThanOrEqual(6); // ≈ 45 phút ở tốc độ thường
  }, 120000);
});
