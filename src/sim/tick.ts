// Lịch 50 việc một ngày — sao chép cấu trúc game/tick.c của Julius.
// Mỗi cột mốc điền thêm case; số tick giữ gần Julius để đối chiếu dễ.
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY, type GameState } from './state';
import { updateFigures } from './figures/behaviors';
import { consumeFood, consumeGoods, decayServices, evolveHouses, updatePopulation } from './buildings/house';
import { generateFigures, updateProduction } from './buildings/industry';
import { updateDesirability } from './map/desirability';
import { updateMigration } from './city/population';
import { updateLabor } from './city/labor';
import { generateCriminals, updateSentiment } from './city/sentiment';
import { updateFinance } from './city/finance';
import { updateRisks } from './city/risk';
import { updateFlood } from './flood/season';
import { updateCourt } from './city/court';
import { updateWorshipDaily, updateWorshipMonthly } from './city/worship';
import { updateCulture, updateYearlyRatings } from './city/ratings';
import { updateHealth } from './city/health';
import { updateScenarioEvents } from './scenario/events';
import { checkVictory } from './scenario/victory';
import { updateTrade, yearlyTrade } from './city/trade';
import { updateWar } from './city/war';

const MAX_EVENTS = 8;

export function tick(s: GameState): void {
  // 1. Walker di chuyển mỗi tick
  updateFigures(s);
  // 2. Đúng một việc theo tick trong ngày
  const { day } = s.time;
  switch (s.time.tick) {
    case 0:
      if (day === 0) { updateFinance(s); consumeGoods(s); if (s.time.month === 0 && s.time.totalDays > 0) { updateYearlyRatings(s); yearlyTrade(s); } } // theo tháng; đầu năm: Thịnh vượng, Trị an (M5), hạn ngạch buôn (M6a)
      if (day === 0 || day === 8) consumeFood(s);
      break;
    case 1: evolveHouses(s); break;
    case 2: decayServices(s); break;
    case 4: updatePopulation(s); updateMigration(s); break;
    case 5: updateDesirability(s); break;
    case 8: updateProduction(s); break;
    case 12: generateFigures(s); break;
    case 22: if (day === 0 || day === 8) updateSentiment(s); break;
    case 23: if (day === 0) generateCriminals(s); break;
    case 25: updateLabor(s); break;
    case 26: updateFlood(s); break; // M4: mùa lũ, flood-fill, đê
    case 27: updateScenarioEvents(s); updateCourt(s); updateWorshipDaily(s); if (day === 0) { updateWorshipMonthly(s); updateHealth(s); } break; // M5: triều đình, tín ngưỡng, sức khỏe
    case 28: updateTrade(s); updateWar(s); break; // M6a: lái buôn, giặc, lính
    case 43: updateRisks(s); break;
    case 49:
      if (day === 0) updateCulture(s); // M5: Văn hiến theo tháng
      checkVictory(s);
      if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
      break;
    default: break;
  }
  advanceTime(s);
}

function advanceTime(s: GameState): void {
  const t = s.time;
  if (++t.tick >= TICKS_PER_DAY) {
    t.tick = 0;
    t.totalDays++;
    if (++t.day >= DAYS_PER_MONTH) {
      t.day = 0;
      if (++t.month >= MONTHS_PER_YEAR) {
        t.month = 0;
        t.year++;
      }
    }
  }
}
