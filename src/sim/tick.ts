// Lịch 50 việc một ngày — sao chép cấu trúc game/tick.c của Julius.
// Mỗi cột mốc điền thêm case; số tick giữ theo Julius để sau này đối chiếu dễ.
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY, type GameState } from './state';
import { updateFigures } from './figures/behaviors';
import { consumeFood, decayServices, evolveHouses, updatePopulation } from './buildings/house';
import { generateFigures, updateProduction } from './buildings/industry';
import { updateDesirability } from './map/desirability';
import { updateMigration } from './city/population';

export function tick(s: GameState): void {
  // 1. Walker di chuyển mỗi tick
  updateFigures(s);
  // 2. Đúng một việc theo tick trong ngày
  switch (s.time.tick) {
    case 0:
      if (s.time.day === 0) consumeFood(s); // theo tháng. M3: thuế, M5: Ân sủng
      break;
    case 1:
      evolveHouses(s);
      break;
    case 2:
      decayServices(s);
      break;
    case 4:
      updatePopulation(s);
      updateMigration(s);
      break;
    case 5:
      updateDesirability(s);
      break;
    case 8:
      updateProduction(s);
      break;
    case 12:
      generateFigures(s);
      break;
    case 26:
      // M4: flood.update(s)
      break;
    case 49:
      // M3: city_ratings_update (theo tháng)
      break;
    default:
      break;
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
