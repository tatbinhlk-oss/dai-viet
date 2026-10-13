// Lịch 50 việc một ngày — sao chép cấu trúc game/tick.c của Julius.
// M1 mới có khung; mỗi cột mốc sau điền thêm case tương ứng (xem tài liệu thiết kế, phần 1).
import { DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY, type GameState } from './state';

export function tick(s: GameState): void {
  // 1. Walker di chuyển mỗi tick — M2: figures.update(s)
  // 2. Đúng một việc theo tick trong ngày
  switch (s.time.tick) {
    case 0:
      // M3: finance tax / M5: court favor decay (theo tháng, kiểm tra day === 0)
      break;
    case 1:
      // M2: evolve houses
      break;
    case 2:
      // M2: decay services on houses
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
