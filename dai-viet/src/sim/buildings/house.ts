// Nhà ở bậc 1–8 (9–10 mở ở M5): tiến/thoái hóa theo bảng houses.json, tiêu thụ lương thực và hàng hóa.
// Quy tắc Caesar 3: đủ yêu cầu bậc kế tiếp → lên; hụt yêu cầu bậc hiện tại vài ngày → xuống.
import { BuildingType, FOODS, type Building, type GameState } from '../state';
import { gridOffset, inBounds } from '../map/grid';
import { BUILDING_DEFS, DEVOLVE_AFTER_DAYS, economy, EVOLVE_AFTER_DAYS, HOUSE_LEVELS, MAX_HOUSE_LEVEL, RESOURCES } from './defs';
import { anchorOffset, setHouseLevel } from './spawn';

export const foodTypes = (b: Building): number => FOODS.reduce((n, r) => n + (b.store[r] > 0 ? 1 : 0), 0);

/**
 * Lý do nhà KHÔNG đủ điều kiện ở bậc `level`, theo thứ tự kiểm tra của thiết kế:
 * nước → lương thực → tôn giáo → giáo dục → y tế → giải trí → hàng hóa → chợ → độ hấp dẫn. null = đủ.
 */
export function missingFor(s: GameState, b: Building, level: number): string | null {
  if (level <= 1) return null;
  const n = HOUSE_LEVELS[Math.min(level, HOUSE_LEVELS.length - 1)].needs;
  if (b.water < n.water) return n.water >= 2 ? 'giếng gạch' : 'nước giếng';
  if (foodTypes(b) < n.foodTypes) return n.foodTypes === 1 ? 'lương thực' : `${n.foodTypes} loại lương thực`;
  if (n.dinh && b.dinh <= 0) return 'đình làng';
  if (n.temple && b.temple <= 0) return 'chùa';
  if (n.school && b.school <= 0) return 'lớp học thầy đồ';
  if (n.clinic && b.clinic <= 0) return 'thầy lang';
  if (n.entertainment && b.entertainment <= 0) return 'hát chèo';
  for (const g of n.goods) if (b.store[g] <= 0) return RESOURCES[g].name.toLowerCase();
  if (n.market && b.marketAccess <= 0) return 'chợ phiên';
  if (s.grid.desirability[anchorOffset(b.x, b.y, b.size)] < n.desirability) return `độ hấp dẫn ≥ ${n.desirability}`;
  return null;
}

/** Mỗi ngày (tick 1): xét lên/xuống bậc cho mọi nhà có dân. */
export function evolveHouses(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    if (b.level < MAX_HOUSE_LEVEL && missingFor(s, b, b.level + 1) === null) {
      b.devolveDays = 0;
      if (++b.evolveDays >= EVOLVE_AFTER_DAYS) {
        b.evolveDays = 0;
        setHouseLevel(s, b, b.level + 1);
      }
    } else if (missingFor(s, b, b.level) !== null) {
      b.evolveDays = 0;
      if (++b.devolveDays >= DEVOLVE_AFTER_DAYS) {
        b.devolveDays = 0;
        setHouseLevel(s, b, Math.max(1, b.level - 1));
        const cap = HOUSE_LEVELS[b.level].capacity;
        if (b.population > cap) b.population = cap; // dân dư bỏ đi
      }
    } else {
      b.evolveDays = 0;
      b.devolveDays = 0;
    }
  }
}

/** Mỗi ngày (tick 2): bộ đếm dịch vụ giảm dần; nước tính lại từ giếng (giếng gạch cần người làm). */
export function decayServices(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House) continue;
    if (b.dinh > 0) b.dinh--;
    if (b.temple > 0) b.temple--;
    if (b.school > 0) b.school--;
    if (b.clinic > 0) b.clinic--;
    if (b.entertainment > 0) b.entertainment--;
    if (b.marketAccess > 0) b.marketAccess--;
    if (b.taxCoverage > 0) b.taxCoverage--;
    b.water = 0;
  }
  for (const w of s.buildings) {
    const def = BUILDING_DEFS[w.type];
    if (!def || def.waterLevel === 0) continue;
    if (def.workers > 0 && w.numWorkers <= 0) continue;
    const R = def.waterRange;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = w.x + dx, y = w.y + dy;
        if (!inBounds(x, y)) continue;
        const id = s.grid.buildingId[gridOffset(x, y)];
        if (!id) continue;
        const h = s.buildings[id];
        if (h.type === BuildingType.House && h.water < def.waterLevel) h.water = def.waterLevel;
      }
    }
  }
}

/** Ngày 0 và 8 mỗi tháng: ăn nửa phần tháng, chia đều cho các loại lương thực nhà đang có. */
export function consumeFood(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    const types = foodTypes(b);
    if (types === 0) continue;
    const per = Math.ceil((b.population * economy.foodPerPersonPerMonth) / 2 / types);
    for (const r of FOODS) if (b.store[r] > 0) b.store[r] = Math.max(0, b.store[r] - per);
  }
}

/** Ngày 0 mỗi tháng: dùng hàng hóa bậc hiện tại cần. */
export function consumeGoods(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    for (const g of HOUSE_LEVELS[b.level].needs.goods) b.store[g] = Math.max(0, b.store[g] - economy.goodsPerHousePerMonth);
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
