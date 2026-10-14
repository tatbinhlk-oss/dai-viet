// Thương mại — thiết kế phần 4 (Julius trade): hai tuyến (bộ lên miền núi, sông ra biển), hạn ngạch mỗi năm mỗi mặt hàng
// 0 → 15 → 25 → 40 kiện, lệnh mua / bán theo mặt hàng, lái buôn tới kho (đoàn buôn 8 kiện) hoặc bến cảng (thuyền 12 kiện).
import { BuildingType, FigureType, Resource, type Building, type Figure, type GameState, type RouteState, type TradeOrder, type TradeState } from '../state';
import tradeJson from '../../data/trade.json';
import { RES_COUNT, DAYS_PER_MONTH } from '../state';
import { RESOURCES, UNITS_PER_LOAD } from '../buildings/defs';
import { loadsIn, warehouseHasRoom } from '../buildings/storage';
import { roadAccess } from '../buildings/spawn';
import { createFigure, removeFigure } from '../figures/figure';
import { setWalkPath } from '../figures/movement';
import { bfs, passLand, passWater, UNREACHABLE } from '../map/routing';
import { GRID_SIZE, gridOffset, isWater, T_WATER } from '../map/grid';
import { dockWaterTile } from '../figures/boat';

export const trade = tradeJson;
export interface RouteDef { key: string; name: string; kind: 'land' | 'sea'; openCost: number; intervalDays: number; loadsPerTrip: number; sells: string[]; buys: string[] }
export const ROUTES: RouteDef[] = trade.routes as RouteDef[];
const RES_KEYS = new Map(RESOURCES.map((r, i) => [r.key, i as Resource]));
const res = (k: string): Resource => { const r = RES_KEYS.get(k); if (r === undefined) throw new Error(`trade.json: không có hàng "${k}"`); return r; };
/** [thành bán, thành mua] theo Resource */
const PRICE_TABLE = trade.prices as unknown as Record<string, number[] | string>;
export const PRICES: [number, number][] = RESOURCES.map((r) => { const p = PRICE_TABLE[r.key]; return Array.isArray(p) ? [p[0], p[1]] : [0, 0]; });
export const QUOTA_LEVELS: number[] = trade.quotaLevels;
export const routeSells = (i: number): Resource[] => ROUTES[i].sells.map(res); // lái buôn bán → thành mua
export const routeBuys = (i: number): Resource[] => ROUTES[i].buys.map(res); // lái buôn mua → thành bán

export function initTrade(): TradeState {
  return {
    routes: ROUTES.map((): RouteState => ({ open: false, quotaLevel: new Array(RES_COUNT).fill(0), tradedThisYear: new Array(RES_COUNT).fill(0), tradedLastYear: new Array(RES_COUNT).fill(0), nextTripDay: 0, traderId: 0 })),
    orders: new Array(RES_COUNT).fill(0) as TradeOrder[],
    shipsThisYear: 0, caravansThisYear: 0,
  };
}

export const quotaOf = (rs: RouteState, r: Resource): number => QUOTA_LEVELS[rs.quotaLevel[r]] ?? 0;

export function openRoute(s: GameState, i: number): string | null {
  const def = ROUTES[i], rs = s.trade.routes[i];
  if (!def || !rs) return 'tuyến không có';
  if (rs.open) return 'tuyến đã mở';
  if (!s.scenario.routes.includes(def.key)) return 'màn này không mở được tuyến ấy'; // M6b: màn khóa tuyến
  if (s.treasury < def.openCost) return `cần ${def.openCost} quan để mở tuyến`;
  s.treasury -= def.openCost;
  s.thisYear.construction += def.openCost;
  rs.open = true;
  for (const r of [...routeSells(i), ...routeBuys(i)]) rs.quotaLevel[r] = Math.max(rs.quotaLevel[r], 1);
  rs.nextTripDay = s.time.totalDays + DAYS_PER_MONTH;
  s.events.push(`Mở ${def.name.toLowerCase()} (${def.openCost} quan)`);
  return null;
}

export function setTradeOrder(s: GameState, r: Resource, order: TradeOrder): void {
  if (r > 0 && r < RES_COUNT) s.trade.orders[r] = order;
}

/** Đầu năm: hạn ngạch lên mức khi năm trước mua bán đủ; chốt sổ năm. Gọi sau khi tính chỉ số (đọc shipsThisYear). */
export function yearlyTrade(s: GameState): void {
  for (let i = 0; i < ROUTES.length; i++) {
    const rs = s.trade.routes[i];
    for (let r = 1; r < RES_COUNT; r++) {
      const q = quotaOf(rs, r);
      if (rs.open && q > 0 && rs.tradedThisYear[r] * 100 >= q * trade.raisePct && rs.quotaLevel[r] < QUOTA_LEVELS.length - 1) {
        rs.quotaLevel[r]++;
        s.events.push(`${ROUTES[i].name}: hạn ngạch ${RESOURCES[r].name.toLowerCase()} lên ${quotaOf(rs, r)} kiện/năm`);
      }
      rs.tradedLastYear[r] = rs.tradedThisYear[r];
      rs.tradedThisYear[r] = 0;
    }
  }
  s.trade.shipsThisYear = 0;
  s.trade.caravansThisYear = 0;
}

/** Kho gần nhất (theo đường) có người làm, từ ô `from`; null nếu không có. */
export function nearestWarehouse(s: GameState, from: number, onRoad: boolean): { b: Building; door: number } | null {
  const dist = bfs(s.grid, from, onRoad ? (g, o) => (g.terrain[o] & 2) !== 0 : passLand).dist;
  let best: { b: Building; door: number } | null = null, bestD = UNREACHABLE;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Warehouse || b.numWorkers <= 0 || b.flooded) continue;
    const door = roadAccess(s.grid, b);
    if (door < 0) continue;
    const d = dist[door];
    if (d < bestD) { bestD = d; best = { b, door }; }
  }
  return best;
}

/** Ô sông ở mép bản đồ (nơi thuyền buôn vào / ra); −1 nếu sông không chạm mép. */
export function riverEdgeTile(s: GameState): number {
  if (s.riverMouthOffset >= 0) return s.riverMouthOffset; // M6b: cửa sông ghi trong file bản đồ
  const g = s.grid;
  for (const y of [0, GRID_SIZE - 1]) for (let x = 0; x < GRID_SIZE; x++) if (g.terrain[gridOffset(x, y)] & T_WATER) return gridOffset(x, y);
  for (const x of [0, GRID_SIZE - 1]) for (let y = 0; y < GRID_SIZE; y++) if (g.terrain[gridOffset(x, y)] & T_WATER) return gridOffset(x, y);
  return -1;
}

export function portOf(s: GameState): { b: Building; water: number } | null {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Port || b.numWorkers <= 0 || b.flooded) continue;
    const w = dockWaterTile(s.grid, b);
    if (w >= 0) return { b, water: w };
  }
  return null;
}

function spawnTrader(s: GameState, i: number): boolean {
  const def = ROUTES[i], rs = s.trade.routes[i];
  if (def.kind === 'land') {
    const target = nearestWarehouse(s, s.entryOffset, false);
    if (!target) return false;
    const f = createFigure(s, FigureType.Caravan, s.entryOffset, 0);
    if (!f) return false;
    f.route = i; f.destBuildingId = target.b.id; f.boatHome = s.entryOffset;
    if (!setWalkPath(s, f, target.door, false)) { removeFigure(s, f.id); return false; }
    rs.traderId = f.id;
    return true;
  }
  const port = portOf(s);
  const edge = riverEdgeTile(s);
  if (!port || edge < 0) return false;
  const f = createFigure(s, FigureType.TradeShip, edge, 0);
  if (!f) return false;
  f.route = i; f.destBuildingId = port.b.id; f.boatHome = edge;
  if (!isWater(s.grid, edge) || !setWalkPath(s, f, port.water, false)) { removeFigure(s, f.id); return false; }
  rs.traderId = f.id;
  return true;
}

/** Mỗi ngày (tick 27): tuyến mở tới kỳ thì cử lái buôn; không cử được (chưa có kho / cảng) thì thử lại sau 8 ngày. */
export function updateTrade(s: GameState): void {
  for (let i = 0; i < ROUTES.length; i++) {
    const rs = s.trade.routes[i];
    if (!rs.open || rs.traderId !== 0 || s.time.totalDays < rs.nextTripDay) continue;
    if (spawnTrader(s, i)) rs.nextTripDay = s.time.totalDays + ROUTES[i].intervalDays;
    else rs.nextTripDay = s.time.totalDays + 8;
  }
}

/** Mua bán tại kho `w` với lái buôn tuyến i, tối đa `cap` kiện. Trả [bán, mua] số kiện. */
export function doTrade(s: GameState, i: number, w: Building, cap: number): [number, number] {
  const rs = s.trade.routes[i];
  let sold = 0, bought = 0;
  for (const r of routeBuys(i)) { // thành bán
    if (s.trade.orders[r] !== 2) continue;
    const n = Math.min(loadsIn(w, r), quotaOf(rs, r) - rs.tradedThisYear[r], cap - sold - bought);
    if (n <= 0) continue;
    w.store[r] -= n * UNITS_PER_LOAD;
    const money = n * PRICES[r][0];
    s.treasury += money; s.thisYear.exports += money;
    rs.tradedThisYear[r] += n; sold += n;
  }
  for (const r of routeSells(i)) { // thành mua
    if (s.trade.orders[r] !== 1) continue;
    let n = Math.min(quotaOf(rs, r) - rs.tradedThisYear[r], cap - sold - bought, Math.floor(Math.max(0, s.treasury) / PRICES[r][1]));
    let k = 0;
    while (k < n && warehouseHasRoom(w, r)) { w.store[r] += UNITS_PER_LOAD; k++; }
    if (k <= 0) continue;
    const money = k * PRICES[r][1];
    s.treasury -= money; s.thisYear.imports += money;
    rs.tradedThisYear[r] += k; bought += k;
  }
  return [sold, bought];
}

/** Tổng số kiện các mặt hàng đang có lệnh bán trong kho (cho UI). */
export const tradeOrderText = (o: TradeOrder): string => ['Không', 'Mua', 'Bán'][o];
export type { Figure };
