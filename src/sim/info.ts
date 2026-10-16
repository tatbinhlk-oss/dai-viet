// Bảng thông tin cho UI: chi tiết công trình (inspectBuilding) và số liệu thành phố (cityStats). Tách từ index.ts.
import { createRng } from './rng';
import type { Edict, EdictState, EdictType, Goals, GameOver } from './state';
import { createGrid, GRID_SIZE, gridOffset, T_WATER } from './map/grid';
import { generateTerrain, type TerrainOptions } from './map/terrain';
import { applyMapFile, type MapDef } from './map/mapfile';
import { BuildingType, emptyLedger, FigureType, isDike, isMilitaryBase, isWall, LABOR_CATS, RES_COUNT, Resource, TICKS_PER_TILE, type Ledger, type MoodCause } from './state';
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
import { initWar, invasionEntry, nextInvasion, SOURCE_TEXT, squadKind, squadMembers, WAR, watchtowerCovers } from './city/war';
import { offsetX, offsetY } from './map/grid';
import { figureDialogue, type FigureInfo } from './figures/dialogue';
import { findExpansion, houseCapacity, houseMinSize } from './buildings/merge';
import { buildingProblem, computeOverlay, problemAnchors, type OverlayMode } from './overlay';
import { cityProblems, type CityProblem } from './city/overview';
import { tutorialSteps, type TutorialStep } from './scenario/tutorial';
export interface BuildingInfo {
  id: number;
  type: BuildingType;
  name: string;
  isHouse: boolean;
  level: number;
  population: number;
  capacity: number;
  /** cỡ móng và nhà 2×2 do gộp */
  size: number; merged: boolean;
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
  /** QoL: vì sao công trình có vấn đề (thiếu người, không kề đường…), null = ổn */
  problem: string | null;
  mothballed: boolean;
  /** tầm cấp nước (giếng) để vẽ vùng phục vụ; 0 = không */
  range: number;
  /** đê/cống */
  dike: { height: number; target: number; integrity: number; workPct: number; sluiceOpen: boolean | null; working: boolean } | null;
  /** ruộng lúa */
  paddy: { silted: boolean; dryYears: number; yieldPct: number } | null;
  pollutedDays: number;
  /** M8: đội quân của trại lính / trại cung thủ / tàu voi */
  squad: SquadInfo | null;
}
export interface SquadInfo {
  buildingId: number; name: string; kind: 'militia' | 'archer' | 'elephant';
  count: number; max: number; hpPct: number;
  /** ô gác được lệnh; null = đứng ở cửa trại */
  post: { x: number; y: number } | null;
  /** ô đang đứng (trung bình) để nút → tới */
  at: { x: number; y: number };
  /** trại: số kiện vũ khí trong kho trại; tàu voi: % huấn luyện */
  weapons: number; trainPct: number;
  x: number; y: number;
}
export function squadInfo(s: GameState, b: GameState['buildings'][number]): SquadInfo {
  const k = squadKind(b.type), members = squadMembers(s, b);
  let hp = 0, sx = 0, sy = 0;
  for (const m of members) { hp += m.hp / k.hp; sx += m.x; sy += m.y; }
  const n = members.length;
  return {
    buildingId: b.id, name: BUILDING_DEFS[b.type].name, kind: b.type === BuildingType.ArcherCamp ? 'archer' : b.type === BuildingType.ElephantStable ? 'elephant' : 'militia',
    count: n, max: k.max, hpPct: n ? Math.round((hp * 100) / n) : 0,
    post: b.post >= 0 ? { x: offsetX(b.post), y: offsetY(b.post) } : null,
    at: n ? { x: Math.round(sx / n), y: Math.round(sy / n) } : { x: b.x, y: b.y },
    weapons: Math.floor(b.store[Resource.Weapons] / 100), trainPct: b.type === BuildingType.ElephantStable ? Math.min(100, Math.floor((b.progress * 100) / WAR.elephantTrainDays)) : 0,
    x: b.x, y: b.y,
  };
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
    capacity: isHouse ? houseCapacity(b) : 0,
    size: b.size, merged: b.merged,
    happiness: b.happiness,
    nextLevel: isHouse && b.level < MAX_HOUSE_LEVEL ? HOUSE_LEVELS[b.level + 1].name : null,
    missing: isHouse && b.level < MAX_HOUSE_LEVEL && b.population > 0 ? (missingFor(s, b, b.level + 1) ?? (b.size < houseMinSize(b.level + 1) && !findExpansion(s, b, houseMinSize(b.level + 1)) ? `chỗ nở rộng thành ${houseMinSize(b.level + 1)}×${houseMinSize(b.level + 1)} (đất trống, vườn hay nhà bậc thấp hơn kề bên)` : null)) : null,
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
    problem: buildingProblem(s, b),
    mothballed: b.mothballed,
    range: def.waterLevel > 0 ? def.waterRange : 0,
    squad: isMilitaryBase(b.type) ? squadInfo(s, b) : null,
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
  /** QoL: offset ô của từng sự kiện (−1 = không), song song với events; danh sách vấn đề (cố vấn tổng quan) */
  eventAt: number[];
  problems: CityProblem[];
  /** QoL: biểu đồ theo tháng và các bước hướng dẫn màn đầu */
  history: GameState['history'];
  tutorial: TutorialStep[];
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
export interface WarStats {
  enemiesAlive: number; militia: number; killedThisYear: number; warning: string | null; wallHp: Record<string, number>;
  /** M8: các đội quân, giặc sắp tới (đã báo) với ô mép vào, vũ khí trong kho / vựa toàn thành */
  squads: SquadInfo[];
  incoming: { source: string; text: string; x: number; y: number; months: number; size: number; watched: boolean }[];
  weaponsStored: number;
}

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
  let militia = 0, weaponsStored = 0;
  for (const f of s.figures) if (f.type === FigureType.Militia || f.type === FigureType.Archer || f.type === FigureType.Elephant) militia++;
  const squads: SquadInfo[] = [];
  for (const b of s.buildings) {
    if (b.type === BuildingType.Warehouse) weaponsStored += Math.floor(b.store[Resource.Weapons] / 100);
    if (isMilitaryBase(b.type)) squads.push(squadInfo(s, b));
  }
  const now = s.time.year * 12 + s.time.month;
  const incoming = s.war.invasions.filter((i) => !i.done && i.warned).map((i) => {
    const at = invasionEntry(s, i.source);
    const months = (i.year - 1) * 12 + (i.month - 1) - now;
    return { source: i.source, text: `${i.size} tên ${SOURCE_TEXT[i.source]}`, x: offsetX(at), y: offsetY(at), months, size: i.size, watched: watchtowerCovers(s, i.source) };
  });
  const warStats: WarStats = {
    enemiesAlive: s.war.enemiesAlive, militia, killedThisYear: s.war.killedThisYear,
    warning: inv && inv.warned ? `${inv.size} tên ${SOURCE_TEXT[inv.source]} sẽ tới tháng ${inv.month} năm ${inv.year}` : null,
    wallHp: WAR.wallHp, squads, incoming, weaponsStored,
  };
  return {
    sentiment: s.sentiment, lowMoodCause: s.lowMoodCause, taxRate: s.taxRate,
    workforce: s.labor.workforce, employed: s.labor.employed, unemploymentPct: s.labor.unemploymentPct,
    laborPriority: [...s.labor.priority], laborNeeded: [...s.labor.needed], laborAllocated: [...s.labor.allocated],
    thisYear: { ...s.thisYear }, lastYear: { ...s.lastYear },
    estTaxes: Math.floor((base.covered * s.taxRate) / 100),
    estUncollected: Math.floor((base.uncovered * s.taxRate) / 100),
    estWages: monthlyWages(s),
    stored, stockpile: [...s.stockpile], houseLevels, events: [...s.events], eventAt: [...s.eventAt], problems: cityProblems(s), history: s.history, tutorial: tutorialSteps(s),
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

