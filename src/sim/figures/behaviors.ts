// Hành vi từng loại walker — gộp figuretype/service.c, cartpusher.c, market.c, migrant.c của Julius.
import { BuildingType, FigureMode, FigureType, type Figure, type GameState } from '../state';
import { gridOffset, offsetX, offsetY, inBounds, type Grid } from '../map/grid';
import { bfs, passLand, passRoad, UNREACHABLE } from '../map/routing';
import { createFigure, removeFigure } from './figure';
import { figureOffset, setWalkPath, startRoam, step, StepResult } from './movement';
import { FOOD_PER_LOAD, GRANARY_CAPACITY, HOUSE_LEVELS, MARKET_BUYER_LOADS, MARKET_CAPACITY, SERVICE_MAX, SERVICE_RANGE } from '../buildings/defs';
import { roadAccess } from '../buildings/spawn';
import { setHouseLevel } from '../buildings/spawn';

/** Cập nhật mọi walker — gọi mỗi tick, trước lịch 50 việc. */
export function updateFigures(s: GameState): void {
  for (let i = 1; i < s.figures.length; i++) {
    const f = s.figures[i];
    if (f.type === FigureType.None) continue;
    switch (f.type) {
      case FigureType.DinhRoamer: updateRoamer(s, f, applyDinhService); break;
      case FigureType.MarketTrader: updateRoamer(s, f, applyMarketService); break;
      case FigureType.MarketBuyer: updateMarketBuyer(s, f); break;
      case FigureType.CartPusher: updateCartPusher(s, f); break;
      case FigureType.Immigrant: updateImmigrant(s, f); break;
    }
  }
}

// ---------- roamer (đình, chợ) ----------

function updateRoamer(s: GameState, f: Figure, apply: (s: GameState, f: Figure) => void): void {
  const r = step(s, f);
  if (r === StepResult.ArrivedTile) {
    apply(s, f);
    return;
  }
  if (r === StepResult.RoamDone) {
    // về nhà theo đường
    const home = s.buildings[f.buildingId];
    const door = home.type !== BuildingType.None ? roadAccess(s.grid, home) : -1;
    f.returning = true;
    if (door < 0 || !setWalkPath(s, f, door, true)) removeFigure(s, f.id);
    return;
  }
  if (r === StepResult.PathDone || r === StepResult.Blocked) {
    if (f.returning) removeFigure(s, f.id);
    else startRoam(f, f.maxRoamLength);
  }
}

/** Duyệt 5×5 quanh walker, gọi `fn` cho mỗi nhà có dân. */
function forHousesAround(s: GameState, f: Figure, fn: (b: GameState['buildings'][number]) => void): void {
  const seen = new Set<number>();
  for (let dy = -SERVICE_RANGE; dy <= SERVICE_RANGE; dy++) {
    for (let dx = -SERVICE_RANGE; dx <= SERVICE_RANGE; dx++) {
      const x = f.x + dx, y = f.y + dy;
      if (!inBounds(x, y)) continue;
      const id = s.grid.buildingId[gridOffset(x, y)];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const b = s.buildings[id];
      if (b.type === BuildingType.House && b.population > 0) fn(b);
    }
  }
}

function applyDinhService(s: GameState, f: Figure): void {
  forHousesAround(s, f, (b) => { b.dinh = SERVICE_MAX; });
}

/** Bà bán chợ: nhà quanh đường "mua" từ kho chợ, đủ 2 tháng ăn. */
function applyMarketService(s: GameState, f: Figure): void {
  const market = s.buildings[f.buildingId];
  forHousesAround(s, f, (b) => {
    if (market.stock <= 0) return;
    const want = b.population * 2 - b.food;
    if (want <= 0) return;
    const give = Math.min(want, market.stock);
    b.food += give;
    market.stock -= give;
  });
}

// ---------- người gánh chợ ----------

function updateMarketBuyer(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  const market = s.buildings[f.buildingId];
  if (r === StepResult.Blocked) { removeFigure(s, f.id); return; }
  if (!f.returning) {
    // tới vựa: lấy hàng
    const g = s.buildings[f.destBuildingId];
    if (g.type === BuildingType.Granary) {
      const take = Math.min(g.stock, MARKET_BUYER_LOADS * FOOD_PER_LOAD, MARKET_CAPACITY - market.stock);
      g.stock -= take;
      f.loads = take;
    }
    f.returning = true;
    const door = market.type !== BuildingType.None ? roadAccess(s.grid, market) : -1;
    if (door < 0 || !setWalkPath(s, f, door, true)) { removeFigure(s, f.id); return; }
  } else {
    if (market.type === BuildingType.Market) market.stock = Math.min(MARKET_CAPACITY, market.stock + f.loads);
    removeFigure(s, f.id);
  }
}

// ---------- xe bò ----------

function updateCartPusher(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  const paddy = s.buildings[f.buildingId];
  if (r === StepResult.Blocked) {
    // thử tìm lại vựa; không được thì về
    if (!f.returning && sendCartToGranary(s, f)) return;
    removeFigure(s, f.id);
    return;
  }
  if (!f.returning) {
    const g = s.buildings[f.destBuildingId];
    if (g.type === BuildingType.Granary && g.stock + f.loads * FOOD_PER_LOAD <= GRANARY_CAPACITY) {
      g.stock += f.loads * FOOD_PER_LOAD;
      f.loads = 0;
    } else if (sendCartToGranary(s, f)) {
      return; // vựa đầy khi tới nơi → đi vựa khác
    }
    f.returning = true;
    const door = paddy.type !== BuildingType.None ? roadAccess(s.grid, paddy) : -1;
    if (door < 0 || !setWalkPath(s, f, door, true)) { removeFigure(s, f.id); return; }
  } else {
    if (f.loads > 0 && paddy.type === BuildingType.Paddy) paddy.progress = Math.min(200, paddy.progress + 200); // không giao được: giữ lúa
    removeFigure(s, f.id);
  }
}

/** Tìm vựa còn chỗ gần nhất theo đường; đặt path. */
export function sendCartToGranary(s: GameState, f: Figure): boolean {
  const from = figureOffset(f);
  const r = bfs(s.grid, from, passRoad);
  let best = -1, bestDist = UNREACHABLE, bestDoor = -1;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Granary || b.id === f.destBuildingId) continue;
    if (b.stock + f.loads * FOOD_PER_LOAD > GRANARY_CAPACITY) continue;
    const door = roadAccess(s.grid, b);
    if (door < 0 || r.dist[door] >= bestDist) continue;
    best = b.id; bestDist = r.dist[door]; bestDoor = door;
  }
  if (best < 0) return false;
  f.destBuildingId = best;
  return setWalkPath(s, f, bestDoor, true);
}

/** Tìm vựa có gạo gần nhất cho người gánh chợ. */
export function sendBuyerToGranary(s: GameState, f: Figure): boolean {
  const from = figureOffset(f);
  const r = bfs(s.grid, from, passRoad);
  let best = -1, bestDist = UNREACHABLE, bestDoor = -1;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Granary || b.stock < FOOD_PER_LOAD) continue;
    const door = roadAccess(s.grid, b);
    if (door < 0 || r.dist[door] >= bestDist) continue;
    best = b.id; bestDist = r.dist[door]; bestDoor = door;
  }
  if (best < 0) return false;
  f.destBuildingId = best;
  return setWalkPath(s, f, bestDoor, true);
}

// ---------- dân nhập cư ----------

function updateImmigrant(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  const house = s.buildings[f.destBuildingId];
  if (r === StepResult.PathDone && house.type === BuildingType.House) {
    const cap = HOUSE_LEVELS[Math.max(1, house.level)].capacity;
    const room = Math.max(0, cap - house.population);
    const moved = Math.min(room, f.loads);
    house.population += moved;
    if (house.level === 0 && house.population > 0) setHouseLevel(s, house, 1);
    f.loads -= moved;
  }
  // số dư (nhà hết chỗ / bị phá / không tới được) → bỏ đi
  removeFigure(s, f.id);
}

/** Sinh nhóm dân ở cửa ngõ, đi bộ trên đất tới `house`. */
export function spawnImmigrants(s: GameState, house: GameState['buildings'][number], count: number): boolean {
  const f = createFigure(s, FigureType.Immigrant, s.entryOffset, 0);
  if (!f) return false;
  f.loads = count;
  f.destBuildingId = house.id;
  const target = gridOffset(house.x, house.y);
  if (!setWalkPath(s, f, target, false)) { removeFigure(s, f.id); return false; }
  return true;
}

/** Kiểm tra có đường bộ từ cửa ngõ tới nhà không (dùng chung cho di cư). */
export function landReachable(g: Grid, from: number, to: number): boolean {
  const r = bfs(g, from, (gg, o) => o === to || passLand(gg, o), to);
  return r.dist[to] !== UNREACHABLE;
}

export { createFigure, removeFigure, startRoam, offsetX, offsetY, FigureMode };
