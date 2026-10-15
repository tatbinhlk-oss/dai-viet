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
import { figureDialogue, type FigureInfo } from './figures/dialogue';
import { findExpansion, houseCapacity, houseMinSize } from './buildings/merge';
import { buildingProblem, computeOverlay, problemAnchors, type OverlayMode } from './overlay';
import { cityProblems, type CityProblem } from './city/overview';
import { tutorialSteps, type TutorialStep } from './scenario/tutorial';
export { OVERLAY_MODES, type OverlayMode } from './overlay';
export { placementError } from './buildings/spawn';
export { placementCheck, type TileView } from './buildings/placement';
export { undoBefore, undoAfter, applyUndo, type UndoRecord } from './undo';
export { figureAt } from './figures/dialogue';
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
    history: { pop: [], treasury: [], favor: [] },
    eventAt: [],
    dirty: new Set(),
  };
  updateProtection(s);
  s.dirty.clear(); // snapshot đầu gửi trọn lưới
  return s;
}

/** Thông tin công trình cho bảng chi tiết. */

export * from './info';
export * from './snapshot';
export { pctWorkers };

