// Điểm vào của mô phỏng. Thuần TypeScript: không Pixi, không DOM, chạy được trong Worker lẫn trong test.
import { createRng } from './rng';
import { createGrid, GRID_SIZE, gridOffset, T_WATER } from './map/grid';
import { generateTerrain, type TerrainOptions } from './map/terrain';
import { applyMapFile, type MapDef } from './map/mapfile';
import { BuildingType, emptyLedger, FigureType, isDike, isWall, LABOR_CATS, RES_COUNT, Resource, TICKS_PER_TILE, type Ledger, type MoodCause } from './state';
import { newBuilding, type GameState } from './state';
import { tick } from './tick';
import { applyCommand, type Command } from './commands';
import { BUILDING_DEFS, economy, HOUSE_LEVELS, MAX_HOUSE_LEVEL, RESOURCES } from './buildings/defs';
import { missingFor } from './buildings/house';
import { pctWorkers } from './buildings/industry';
import { roadAccess } from './buildings/spawn';
import { monthlyTaxBase, monthlyWages } from './city/finance';
import { computeWaterDist, updateProtection } from './flood/floodFill';
import { paddyYield } from './flood/consequences';
import { dikeSafety, workNeeded } from './buildings/dike';
import { inFloodWatch, LEVEL_NAMES, SEASON_DAYS } from './flood/season';
import { ticksPerTile } from './figures/movement';
import { initCourt, giftCost, kingDef, RANK_NAMES, SALARY, EDICT_TYPE_TEXT, storedLoads, draftablePopulation } from './city/court';
import { initWorship, coverage, DEITY_NAMES, festivalCost, moodTarget, templeCount } from './city/worship';
import { cultureBreakdown, initRatings, prosperityCap } from './city/ratings';
import { currentRatings } from './scenario/victory';
import { court as courtCfg } from './buildings/defs';
import { initTrade, PRICES, quotaOf, ROUTES, routeBuys, routeSells } from './city/trade';
import { initWar, nextInvasion, SOURCE_TEXT, WAR } from './city/war';
import type { Edict, EdictState, EdictType, Goals, GameOver } from './state';

export { tick, applyCommand, GRID_SIZE };
export type { GameState, Command };

export interface SimOptions extends TerrainOptions {
  /** M6b: bản đồ thật nạp từ file (src/data/maps); có thì bỏ qua sinh ngẫu nhiên / phẳng */
  map?: MapDef;
}

export function createSim(seed: number, opts: SimOptions = {}): GameState {
  const rng = createRng(seed);
  const grid = createGrid();
  let entry = gridOffset(0, GRID_SIZE / 2);
  let riverMouth = -1;
  const enemyEntry: GameState['enemyEntry'] = { sea: -1, south: -1, north: -1 };
  if (opts.map) {
    applyMapFile(grid, opts.map);
    entry = gridOffset(opts.map.entry[0], opts.map.entry[1]);
    riverMouth = gridOffset(opts.map.riverMouth[0], opts.map.riverMouth[1]);
    for (const k of ['sea', 'south', 'north'] as const) { const p = opts.map.enemy?.[k]; if (p) enemyEntry[k] = gridOffset(p[0], p[1]); }
  } else {
    generateTerrain(grid, rng, opts);
    // cửa ngõ: ô đất gần mép trái nhất, ưu tiên hàng giữa; sông ở mép thì lùi vào trong
    outer: for (let x = 0; x < GRID_SIZE; x++) {
      for (let d = 0; d < GRID_SIZE / 2; d++) {
        const a = gridOffset(x, GRID_SIZE / 2 + d), b = gridOffset(x, GRID_SIZE / 2 - d);
        if (!(grid.terrain[a] & T_WATER)) { entry = a; break outer; }
        if (!(grid.terrain[b] & T_WATER)) { entry = b; break outer; }
      }
    }
  }
  computeWaterDist(grid);
  const s: GameState = {
    seed,
    rng,
    time: { tick: 0, day: 0, month: 0, year: 0, totalDays: 0 },
    grid,
    buildings: [newBuilding(0, BuildingType.None, 0, 0, 0)],
    figures: [{ id: 0, type: FigureType.None, mode: 0, x: 0, y: 0, nx: 0, ny: 0, progress: 0, prevOffset: -1, path: new Int32Array(0), pathIdx: 0, buildingId: 0, destBuildingId: 0, roamLength: 0, maxRoamLength: 0, returning: false, resource: Resource.None, loads: 0, cargo: [], waitTicks: 0, boatHome: -1, hp: 0, timer: 0, route: -1 }],
    freeFigures: [],
    entryOffset: entry,
    riverMouthOffset: riverMouth,
    enemyEntry,
    speed: 1,
    treasury: economy.startTreasury,
    population: 0,
    housingCapacity: 0,
    migrationCooldown: 0,
    migrationQuota: 0,
    taxRate: economy.defaultTaxRate,
    sentiment: economy.sentiment.start,
    lowMoodCause: 'none',
    labor: {
      workforce: 0, employed: 0, unemploymentPct: 0,
      priority: new Array(LABOR_CATS).fill(0), needed: new Array(LABOR_CATS).fill(0), allocated: new Array(LABOR_CATS).fill(0),
    },
    thisYear: emptyLedger(),
    lastYear: emptyLedger(),
    stockpile: new Array(RES_COUNT).fill(false),
    flood: { peak: 0, nextPeak: 0, forecast: 0, level: 0, dayInSeason: -1, breachMoodPeriods: 0, breachesThisYear: 0, dikesChanged: false, floodedTiles: 0 },
    court: initCourt(0, courtCfg.favor.start),
    worship: initWorship(),
    ratings: initRatings(),
    scenario: { key: 'sandbox', name: 'Tự do', goals: { population: 0, culture: 0, prosperity: 0, peace: 0, favor: 0 }, timeLimitYears: 0, milestoneYears: [], routes: ROUTES.map((r) => r.key), king: '', peakChances: null, promoteTo: 0, next: '', map: '', land: [] },
    scenarioEvents: [],
    gameOver: '',
    trade: initTrade(),
    war: initWar(),
    events: [],
    dirty: new Set(),
  };
  updateProtection(s);
  s.dirty.clear(); // snapshot đầu gửi trọn lưới
  return s;
}

/** Thông tin công trình cho bảng chi tiết. */
export interface BuildingInfo {
  id: number;
  type: BuildingType;
  name: string;
  isHouse: boolean;
  level: number;
  population: number;
  capacity: number;
  happiness: number;
  /** nhà: thiếu gì để lên bậc kế; null = đang chờ lên / đã tối đa */
  nextLevel: string | null;
  missing: string | null;
  /** nhà: thiếu gì để GIỮ bậc hiện tại (sắp tụt) */
  devolving: string | null;
  services: { water: number; dinh: number; temple: number; school: number; clinic: number; entertainment: number; market: number; tax: number; academy: number; puppet: number; shrine: number; altar: number };
  workers: number;
  workersNeeded: number;
  laborAccess: boolean;
  roadAccess: boolean;
  progress: number;
  progressMax: number;
  store: { resource: Resource; name: string; units: number }[];
  policy: number[] | null;
  fireRisk: number;
  damageRisk: number;
  x: number;
  y: number;
  // M4
  flooded: boolean;
  /** M6a: thành, lính, giặc */
  hp: number | null;
  /** đê/cống */
  dike: { height: number; target: number; integrity: number; workPct: number; sluiceOpen: boolean | null; working: boolean } | null;
  /** ruộng lúa */
  paddy: { silted: boolean; dryYears: number; yieldPct: number } | null;
  pollutedDays: number;
}

export function inspectBuilding(s: GameState, id: number): BuildingInfo | null {
  const b = s.buildings[id];
  if (!b || b.type === BuildingType.None) return null;
  const def = BUILDING_DEFS[b.type];
  const isHouse = b.type === BuildingType.House;
  const lvl = HOUSE_LEVELS[b.level];
  const store: BuildingInfo['store'] = [];
  for (let r = 1; r < RES_COUNT; r++) if (b.store[r] > 0) store.push({ resource: r, name: RESOURCES[r].name, units: b.store[r] });
  return {
    id, type: b.type,
    name: isHouse ? lvl.name : def.name,
    isHouse, level: b.level, population: b.population,
    capacity: isHouse ? HOUSE_LEVELS[Math.max(1, b.level)].capacity : 0,
    happiness: b.happiness,
    nextLevel: isHouse && b.level < MAX_HOUSE_LEVEL ? HOUSE_LEVELS[b.level + 1].name : null,
    missing: isHouse && b.level < MAX_HOUSE_LEVEL && b.population > 0 ? missingFor(s, b, b.level + 1) : null,
    devolving: isHouse && b.population > 0 ? missingFor(s, b, b.level) : null,
    services: { water: b.water, dinh: b.dinh, temple: b.temple, school: b.school, clinic: b.clinic, entertainment: b.entertainment, market: b.marketAccess, tax: b.taxCoverage, academy: b.academy, puppet: b.puppet, shrine: b.shrine, altar: b.altar },
    workers: b.numWorkers, workersNeeded: def.workers,
    laborAccess: b.housesCovered > 0, roadAccess: roadAccess(s.grid, b) >= 0,
    progress: b.progress, progressMax: def.progressMax,
    store,
    policy: b.type === BuildingType.Warehouse || b.type === BuildingType.Granary ? [...b.policy] : null,
    fireRisk: b.fireRisk, damageRisk: b.damageRisk,
    x: b.x, y: b.y,
    flooded: b.flooded,
    dike: isDike(b.type) ? {
      height: b.height, target: b.targetHeight, integrity: b.integrity,
      workPct: b.height < b.targetHeight ? Math.floor((b.workDone * 100) / workNeeded(b)) : 100,
      sluiceOpen: b.type === BuildingType.Sluice ? b.sluiceOpen : null, working: b.figureId !== 0,
    } : null,
    paddy: b.type === BuildingType.Paddy ? { silted: b.silted, dryYears: b.dryYears, yieldPct: Math.round(paddyYield(b) * 100) } : null,
    pollutedDays: b.pollutedDays,
    hp: isWall(b.type) ? b.integrity : null,
  };
}

export const buildingIdAt = (s: GameState, x: number, y: number): number =>
  x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE ? s.grid.buildingId[gridOffset(x, y)] : 0;

/** Số liệu thành phố cho thanh trên và bảng cố vấn. */
export interface CityStats {
  sentiment: number;
  lowMoodCause: MoodCause;
  taxRate: number;
  workforce: number;
  employed: number;
  unemploymentPct: number;
  laborPriority: number[];
  laborNeeded: number[];
  laborAllocated: number[];
  thisYear: Ledger;
  lastYear: Ledger;
  /** ước tính tháng tới */
  estTaxes: number;
  estUncollected: number;
  estWages: number;
  /** tổng hàng trong vựa + kho, đơn vị */
  stored: number[];
  stockpile: boolean[];
  houseLevels: number[]; // số nhà theo bậc 0..10
  events: string[];
  /** M4: mùa lũ và đê */
  flood: FloodStats;
  /** M5 */
  ratings: RatingStats;
  court: CourtStats;
  worship: WorshipStats;
  scenario: { key: string; name: string; goals: Goals; current: Goals; timeLimitYears: number; gameOver: GameOver; next: string; king: string; kingText: string; map: string; /** ô đưa camera tới lúc mở màn: giữa vùng đất cấp đầu, không có thì cửa ngõ */ start: [number, number] };
  /** M6a */
  trade: TradeStats;
  war: WarStats;
}
export interface TradeStats {
  routes: { index: number; key: string; name: string; kind: string; open: boolean; available: boolean; openCost: number; loadsPerTrip: number; traderOut: boolean; nextTripDays: number;
    goods: { resource: Resource; name: string; citySells: boolean; quota: number; traded: number; tradedLastYear: number; price: number }[] }[];
  orders: number[];
  prices: [number, number][];
  shipsThisYear: number;
  caravansThisYear: number;
}
export interface WarStats { enemiesAlive: number; militia: number; killedThisYear: number; warning: string | null; wallHp: Record<string, number> }

export interface RatingStats {
  culture: number; prosperity: number; prosperityCap: number; peace: number; health: number;
  cultureBreakdown: { key: string; name: string; coverage: number; points: number; max: number }[];
  yearsCalm: number;
}
export interface EdictInfo {
  id: number; type: EdictType; typeText: string; title: string; state: EdictState; extended: boolean;
  /** ngày còn lại tới hạn (hoặc −1) */
  daysLeft: number; reward: number; amount: number; progress: number; corveePct: number;
  /** có đủ điều kiện thi hành ngay (thuế vật/tiền/binh dịch) */
  ready: boolean; have: number; need: number;
}
export interface CourtStats {
  favor: number; rank: number; rankName: string; salaryLevel: number; salaryNames: string[]; salaryTable: number[];
  personalFunds: number; tributeDue: number; tributePaid: boolean; tributeMissedYears: number;
  giftsInWindow: number; giftCosts: number[]; giftFavor: number[];
  edicts: EdictInfo[]; dismissalDays: number; graduates: number; corveeWorkers: number; corveePctOptions: number[];
}
export interface WorshipStats {
  gods: { deity: number; name: string; mood: number; target: number; bolts: number; monthsSinceFestival: number; temples: number; coverage: number; blessings: number; wraths: number }[];
  festivalCosts: number[];
  healersOffDays: number; paddyFreezeDays: number; healthBonusMonths: number;
}

export interface FloodStats {
  /** đang trong các tháng theo dõi lũ (tháng 4–9) */
  watch: boolean;
  inSeason: boolean;
  dayInSeason: number;
  seasonDays: number;
  forecast: number;
  forecastName: string;
  peak: number;
  peakName: string;
  level: number;
  floodedTiles: number;
  /** an toàn đê 0–100 = độ bền trung bình đoạn đã đắp */
  safety: number;
  dikesBuilt: number;
  dikesPlanned: number;
  breachesThisYear: number;
  siltedPaddies: number;
  sluices: { id: number; x: number; y: number; open: boolean; height: number }[];
}

/** M6b: ô giữa vùng đất cấp thấp nhất (màn có đất cấp) hoặc cửa ngõ. */
function startTile(s: GameState): [number, number] {
  const first = [...s.scenario.land].sort((a, b) => a.rank - b.rank)[0];
  if (first) return [Math.round((first.rect[0] + first.rect[2]) / 2), Math.round((first.rect[1] + first.rect[3]) / 2)];
  return [s.entryOffset % GRID_SIZE, Math.floor(s.entryOffset / GRID_SIZE)];
}

export function cityStats(s: GameState): CityStats {
  const stored = new Array(RES_COUNT).fill(0);
  const houseLevels = new Array(HOUSE_LEVELS.length).fill(0);
  for (const b of s.buildings) {
    if (b.type === BuildingType.Granary || b.type === BuildingType.Warehouse) for (let r = 1; r < RES_COUNT; r++) stored[r] += b.store[r];
    else if (b.type === BuildingType.House && b.population > 0) houseLevels[b.level]++;
  }
  const base = monthlyTaxBase(s);
  const dk = dikeSafety(s);
  let siltedPaddies = 0;
  const sluices: FloodStats['sluices'] = [];
  for (const b of s.buildings) {
    if (b.type === BuildingType.Paddy && b.silted) siltedPaddies++;
    else if (b.type === BuildingType.Sluice) sluices.push({ id: b.id, x: b.x, y: b.y, open: b.sluiceOpen, height: b.height });
  }
  const F = s.flood;
  const floodStats: FloodStats = {
    watch: inFloodWatch(s), inSeason: F.dayInSeason >= 0, dayInSeason: F.dayInSeason, seasonDays: SEASON_DAYS,
    forecast: F.forecast, forecastName: LEVEL_NAMES[F.forecast], peak: F.peak, peakName: LEVEL_NAMES[F.peak], level: F.level,
    floodedTiles: F.floodedTiles, safety: dk.safety, dikesBuilt: dk.built, dikesPlanned: dk.planned,
    breachesThisYear: F.breachesThisYear, siltedPaddies, sluices,
  };
  const C = s.court;
  const edicts: EdictInfo[] = C.edicts.filter((e) => e.state !== 'coming' || e.deadlineDay === -2).map((e) => {
    let have = 0, need = 0;
    if (e.type === 'goods') { have = storedLoads(s, e.resource); need = e.amount; }
    else if (e.type === 'money') { have = s.treasury; need = e.amount; }
    else if (e.type === 'troops') { have = Math.min(draftablePopulation(s), storedLoads(s, Resource.Weapons) * courtCfg.troops.menPerWeaponLoad); need = e.amount; }
    return {
      id: e.id, type: e.type, typeText: EDICT_TYPE_TEXT[e.type], title: e.title, state: e.state, extended: e.extended,
      daysLeft: e.state === 'active' ? e.deadlineDay - s.time.totalDays : -1, reward: e.reward, amount: e.amount, progress: e.progress, corveePct: e.corveePct,
      ready: e.state === 'active' && need > 0 && have >= need, have, need,
    };
  });
  const courtStats: CourtStats = {
    favor: C.favor, rank: C.rank, rankName: RANK_NAMES[C.rank], salaryLevel: C.salaryLevel, salaryNames: RANK_NAMES, salaryTable: SALARY,
    personalFunds: C.personalFunds, tributeDue: C.tributeDue, tributePaid: C.tributePaid, tributeMissedYears: C.tributeMissedYears,
    giftsInWindow: C.giftsInWindow.length, giftCosts: [0, 1, 2].map((k) => giftCost(s, k)), giftFavor: courtCfg.gifts.favor,
    edicts, dismissalDays: C.dismissalDay >= 0 ? C.dismissalDay - s.time.totalDays : -1, graduates: C.graduates, corveeWorkers: C.corveeWorkers, corveePctOptions: courtCfg.corvee.pctOptions,
  };
  const worshipStats: WorshipStats = {
    gods: s.worship.gods.map((g, d) => ({ deity: d, name: DEITY_NAMES[d], mood: g.mood, target: moodTarget(s, d), bolts: g.bolts, monthsSinceFestival: g.monthsSinceFestival, temples: templeCount(s, d), coverage: coverage(s, d), blessings: g.blessings, wraths: g.wraths })),
    festivalCosts: [0, 1, 2].map((k) => festivalCost(s, k)),
    healersOffDays: s.worship.healersOffDays, paddyFreezeDays: s.worship.paddyFreezeDays, healthBonusMonths: s.worship.healthBonusMonths,
  };
  const tradeStats: TradeStats = {
    routes: ROUTES.map((def, i) => {
      const rs = s.trade.routes[i];
      const goods = [...routeBuys(i).map((r) => ({ r, citySells: true })), ...routeSells(i).map((r) => ({ r, citySells: false }))];
      return {
        index: i, key: def.key, name: def.name, kind: def.kind, open: rs.open, available: s.scenario.routes.includes(def.key), openCost: def.openCost, loadsPerTrip: def.loadsPerTrip,
        traderOut: rs.traderId !== 0, nextTripDays: Math.max(0, rs.nextTripDay - s.time.totalDays),
        goods: goods.map(({ r, citySells }) => ({ resource: r, name: RESOURCES[r].name, citySells, quota: quotaOf(rs, r), traded: rs.tradedThisYear[r], tradedLastYear: rs.tradedLastYear[r], price: citySells ? PRICES[r][0] : PRICES[r][1] })),
      };
    }),
    orders: [...s.trade.orders], prices: PRICES, shipsThisYear: s.trade.shipsThisYear, caravansThisYear: s.trade.caravansThisYear,
  };
  const inv = nextInvasion(s);
  let militia = 0;
  for (const f of s.figures) if (f.type === FigureType.Militia) militia++;
  const warStats: WarStats = {
    enemiesAlive: s.war.enemiesAlive, militia, killedThisYear: s.war.killedThisYear,
    warning: inv && inv.warned ? `${inv.size} tên ${SOURCE_TEXT[inv.source]} sẽ tới tháng ${inv.month} năm ${inv.year}` : null,
    wallHp: WAR.wallHp,
  };
  return {
    sentiment: s.sentiment, lowMoodCause: s.lowMoodCause, taxRate: s.taxRate,
    workforce: s.labor.workforce, employed: s.labor.employed, unemploymentPct: s.labor.unemploymentPct,
    laborPriority: [...s.labor.priority], laborNeeded: [...s.labor.needed], laborAllocated: [...s.labor.allocated],
    thisYear: { ...s.thisYear }, lastYear: { ...s.lastYear },
    estTaxes: Math.floor((base.covered * s.taxRate) / 100),
    estUncollected: Math.floor((base.uncovered * s.taxRate) / 100),
    estWages: monthlyWages(s),
    stored, stockpile: [...s.stockpile], houseLevels, events: [...s.events],
    flood: floodStats,
    ratings: { culture: s.ratings.culture, prosperity: s.ratings.prosperity, prosperityCap: prosperityCap(s), peace: s.ratings.peace, health: s.ratings.health, cultureBreakdown: cultureBreakdown(s), yearsCalm: s.ratings.yearsCalm },
    court: courtStats,
    worship: worshipStats,
    scenario: {
      key: s.scenario.key, name: s.scenario.name, goals: { ...s.scenario.goals }, current: currentRatings(s), timeLimitYears: s.scenario.timeLimitYears, gameOver: s.gameOver,
      next: s.scenario.next, king: kingDef(s.scenario.king)?.name ?? '', kingText: kingDef(s.scenario.king)?.text ?? '', map: s.scenario.map, start: startTile(s),
    },
    trade: tradeStats,
    war: warStats,
  };
}

/** Snapshot gửi sang render. Lưới gửi trọn lần đầu, sau đó chỉ ô đã đổi; figure gửi mỗi lần. */
export interface Snapshot {
  time: GameState['time'];
  speed: number;
  treasury: number;
  population: number;
  housingCapacity: number;
  city: CityStats;
  selected: BuildingInfo | null;
  /** M6b: ô cửa ngõ (camera đưa tới khi mở bản đồ thật) */
  entryOffset: number;
  full?: { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array; bLevel: Uint8Array };
  changed?: { offsets: Uint32Array; terrain: Uint16Array; bType: Uint8Array; bLevel: Uint8Array };
  /** [x, y, nx, ny, progress, type, resource] × n */
  figures: Int16Array;
}

export const FIG_STRIDE = 7;

export function takeSnapshot(s: GameState, full: boolean, selectedId = 0): Snapshot {
  let n = 0;
  for (const f of s.figures) if (f.type !== FigureType.None) n++;
  const figures = new Int16Array(n * FIG_STRIDE);
  let k = 0;
  for (const f of s.figures) {
    if (f.type === FigureType.None) continue;
    // progress quy về thang TICKS_PER_TILE để render nội suy chung (thuyền nan đi nhanh hơn)
    figures[k++] = f.x; figures[k++] = f.y; figures[k++] = f.nx; figures[k++] = f.ny; figures[k++] = Math.round((f.progress * TICKS_PER_TILE) / ticksPerTile(f)); figures[k++] = f.type;
    figures[k++] = f.loads > 0 ? f.resource : 0;
  }
  const snap: Snapshot = {
    time: { ...s.time },
    speed: s.speed,
    treasury: s.treasury,
    population: s.population,
    housingCapacity: s.housingCapacity,
    city: cityStats(s),
    entryOffset: s.entryOffset,
    selected: selectedId ? inspectBuilding(s, selectedId) : null,
    figures,
  };
  const g = s.grid;
  if (full) {
    snap.full = { terrain: g.terrain.slice(), elevation: g.elevation.slice(), bType: g.bType.slice(), bLevel: g.bLevel.slice() };
  } else if (s.dirty.size) {
    const m = s.dirty.size;
    const offsets = new Uint32Array(m), terrain = new Uint16Array(m), bType = new Uint8Array(m), bLevel = new Uint8Array(m);
    let i = 0;
    for (const o of s.dirty) { offsets[i] = o; terrain[i] = g.terrain[o]; bType[i] = g.bType[o]; bLevel[i] = g.bLevel[o]; i++; }
    snap.changed = { offsets, terrain, bType, bLevel };
  }
  s.dirty.clear();
  return snap;
}

export { pctWorkers };
