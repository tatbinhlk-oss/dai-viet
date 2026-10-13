// Nhà ở bậc 1–5: điều kiện lên/xuống bậc theo bảng thiết kế phần 2 (rút gọn cho M2).
import { BuildingType, type Building, type GameState } from '../state';
import { gridOffset, inBounds } from '../map/grid';
import { HOUSE_LEVELS, MAX_HOUSE_LEVEL, WELL_RANGE } from './defs';
import { anchorOffset, setHouseLevel } from './spawn';

const EVOLVE_AFTER_DAYS = 4;
const DEVOLVE_AFTER_DAYS = 8;

/** Điều kiện để ở bậc `level`. */
function meets(s: GameState, b: Building, level: number): boolean {
  if (level <= 1) return true;
  if (level >= 2 && !b.water) return false;
  if (level >= 3 && b.food <= 0) return false;
  if (level >= 4 && b.dinh <= 0) return false;
  if (level >= 5 && s.grid.desirability[anchorOffset(b.x, b.y, b.size)] < 5) return false;
  return true;
}

/** Mỗi ngày (tick 1): xét lên/xuống bậc cho mọi nhà có dân. */
export function evolveHouses(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    if (b.level < MAX_HOUSE_LEVEL && meets(s, b, b.level + 1)) {
      b.devolveDays = 0;
      if (++b.evolveDays >= EVOLVE_AFTER_DAYS) {
        b.evolveDays = 0;
        setHouseLevel(s, b, b.level + 1);
      }
    } else if (!meets(s, b, b.level)) {
      b.evolveDays = 0;
      if (++b.devolveDays >= DEVOLVE_AFTER_DAYS) {
        b.devolveDays = 0;
        setHouseLevel(s, b, Math.max(1, b.level - 1));
        const cap = HOUSE_LEVELS[b.level].capacity;
        if (b.population > cap) b.population = cap; // dân dư bỏ đi (M3: tính vào di cư)
      }
    } else {
      b.evolveDays = 0;
      b.devolveDays = 0;
    }
  }
}

/** Mỗi ngày (tick 2): dịch vụ giảm dần; nước tính lại từ giếng. */
export function decayServices(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House) continue;
    if (b.dinh > 0) b.dinh--;
    b.water = false;
  }
  for (const w of s.buildings) {
    if (w.type !== BuildingType.Well) continue;
    for (let dy = -WELL_RANGE; dy <= WELL_RANGE; dy++) {
      for (let dx = -WELL_RANGE; dx <= WELL_RANGE; dx++) {
        const x = w.x + dx, y = w.y + dy;
        if (!inBounds(x, y)) continue;
        const id = s.grid.buildingId[gridOffset(x, y)];
        if (id && s.buildings[id].type === BuildingType.House) s.buildings[id].water = true;
      }
    }
  }
}

/** Mỗi tháng (ngày 0, tick 0): mỗi người ăn 1 đơn vị. */
export function consumeFood(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House) continue;
    b.food = Math.max(0, b.food - b.population);
  }
}

/** Tổng dân và sức chứa — cập nhật mỗi ngày. */
export function updatePopulation(s: GameState): void {
  let pop = 0, cap = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House) continue;
    pop += b.population;
    cap += HOUSE_LEVELS[Math.max(1, b.level)].capacity;
  }
  s.population = pop;
  s.housingCapacity = cap;
}
