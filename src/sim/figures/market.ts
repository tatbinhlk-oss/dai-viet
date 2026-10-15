// Chợ: người gánh chợ đi vựa/kho lấy hàng, bà bán chợ phát cho nhà — figuretype/market.c của Julius.
// Bà bán chợ ghi "nhu cầu" khi gặp nhà muốn một loại hàng; người gánh chợ chỉ mua hàng hóa đang có nhu cầu.
// Một chuyến người gánh chợ lấy mọi loại chợ đang thiếu mà nguồn đó có, tối đa 8 kiện (thiết kế: 1–8 kiện).
import { BuildingType, FOODS, isFood, Resource, type Building, type Figure, type GameState } from '../state';
import { economy, GOODS, HOUSE_LEVELS, MAX_HOUSE_LEVEL, SERVICE_MAX, UNITS_PER_LOAD } from '../buildings/defs';
import { roadAccess } from '../buildings/spawn';
import { takeable } from '../buildings/storage';
import { bfs, passRoad, UNREACHABLE } from '../map/routing';
import { removeFigure } from './figure';
import { figureOffset, setWalkPath, step, StepResult } from './movement';

export const marketCap = (r: Resource): number => (isFood(r) ? economy.marketCapFoodLoads : economy.marketCapGoodsLoads) * UNITS_PER_LOAD;
const buyerLoads = (r: Resource): number => (isFood(r) ? economy.marketBuyerFoodLoads : economy.marketBuyerGoodsLoads);

/**
 * Chợ thiếu hàng gì nhất? Trả danh sách xếp theo tỉ lệ còn/sức chứa tăng dần.
 * Nhà gộp 2×2 ăn gấp bốn nên lương thực hầu như luôn thiếu; nếu chỉ xếp theo tỉ lệ thì người gánh chợ chỉ đi vựa và không bao giờ
 * lấy hàng hóa ở kho → cứ chuyến lẻ (m.progress đếm chuyến) ưu tiên hàng hóa đang có nhu cầu trước.
 */
function wanted(m: Building, goodsFirst = false): Resource[] {
  const foods: Resource[] = [], goods: Resource[] = [];
  for (const r of FOODS) if (m.store[r] < marketCap(r) / 2) foods.push(r);
  for (const r of GOODS) if (m.demand[r] > 0 && m.store[r] < marketCap(r) / 2) goods.push(r);
  const byRatio = (a: Resource, b: Resource) => m.store[a] / marketCap(a) - m.store[b] / marketCap(b);
  foods.sort(byRatio); goods.sort(byRatio);
  return goodsFirst ? [...goods, ...foods] : [...foods, ...goods];
}

/** Sinh người gánh chợ nếu chợ thiếu hàng và có nguồn trong 40 ô. */
export function sendMarketBuyer(s: GameState, f: Figure): boolean {
  const m = s.buildings[f.buildingId];
  m.progress = (m.progress + 1) % 2; // chợ không sản xuất: dùng progress đếm chuyến chẵn / lẻ
  const list = wanted(m, m.progress === 1);
  if (!list.length) return false;
  const dist = bfs(s.grid, figureOffset(f), passRoad).dist;
  for (const r of list) {
    let best: Building | null = null, bestDoor = -1, bestDist = economy.marketBuyerRange + 1;
    for (const b of s.buildings) {
      if (b.type !== BuildingType.Granary && b.type !== BuildingType.Warehouse) continue;
      if (takeable(s, b, r) < UNITS_PER_LOAD) continue;
      const door = roadAccess(s.grid, b);
      if (door < 0 || dist[door] >= UNREACHABLE || dist[door] >= bestDist) continue;
      best = b; bestDoor = door; bestDist = dist[door];
    }
    if (best) {
      f.resource = r;
      f.destBuildingId = best.id;
      return setWalkPath(s, f, bestDoor, true);
    }
  }
  return false;
}

export function updateMarketBuyer(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  const market = s.buildings[f.buildingId];
  if (r === StepResult.Blocked) { removeFigure(s, f.id); return; }
  if (!f.returning) {
    // tới vựa/kho: lấy loại đang cần nhất, rồi tiện thể lấy thêm các loại khác chợ đang thiếu mà nguồn này có (tối đa 8 kiện)
    const src = s.buildings[f.destBuildingId];
    let budget = economy.marketBuyerMaxLoads * UNITS_PER_LOAD;
    f.cargo = new Array(market.store.length).fill(0);
    const order = [f.resource, ...wanted(market).filter((r) => r !== f.resource)];
    for (const r of order) {
      if (budget <= 0) break;
      const room = Math.max(0, marketCap(r) - market.store[r]);
      const n = Math.min(takeable(s, src, r), buyerLoads(r) * UNITS_PER_LOAD, room, budget);
      if (n <= 0) continue;
      src.store[r] -= n;
      f.cargo[r] = n;
      budget -= n;
    }
    f.loads = Math.ceil((economy.marketBuyerMaxLoads * UNITS_PER_LOAD - budget) / UNITS_PER_LOAD);
    f.returning = true;
    const door = market.type !== BuildingType.None ? roadAccess(s.grid, market) : -1;
    if (door < 0 || !setWalkPath(s, f, door, true)) removeFigure(s, f.id);
  } else {
    if (market.type === BuildingType.Market) {
      for (let r = 0; r < f.cargo.length; r++) if (f.cargo[r] > 0) market.store[r] = Math.min(marketCap(r), market.store[r] + f.cargo[r]);
    }
    removeFigure(s, f.id);
  }
}

/** Bà bán chợ đi qua nhà: phát lương thực đủ ~2 tháng mỗi loại, hàng hóa nhà đang dùng hoặc cần để lên bậc. */
export function serveHouseFromMarket(market: Building, h: Building): void {
  h.marketAccess = SERVICE_MAX;
  const foodTarget = Math.ceil(h.population * economy.foodPerPersonPerMonth * economy.houseFoodTargetMonths);
  for (const r of FOODS) {
    if (market.store[r] <= 0) continue;
    const give = Math.min(foodTarget - h.store[r], market.store[r]);
    if (give > 0) { h.store[r] += give; market.store[r] -= give; }
  }
  const next = HOUSE_LEVELS[Math.min(Math.max(1, h.level) + 1, MAX_HOUSE_LEVEL)];
  for (const g of next.needs.goods) {
    if (h.store[g] >= economy.houseGoodsTarget) continue;
    market.demand[g] = economy.marketDemandDays;
    const give = Math.min(economy.houseGoodsTarget - h.store[g], market.store[g]);
    if (give > 0) { h.store[g] += give; market.store[g] -= give; }
  }
}
