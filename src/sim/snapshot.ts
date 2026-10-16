// Snapshot gửi từ worker sang render / UI mỗi khung: lưới đổi, walker, lớp phủ, bảng thông tin. Tách từ index.ts.
import { createRng } from './rng';
import type { Edict, EdictState, EdictType, Goals, GameOver } from './state';
import { createGrid, GRID_SIZE, gridOffset, T_WATER } from './map/grid';
import { generateTerrain, type TerrainOptions } from './map/terrain';
import { applyMapFile, type MapDef } from './map/mapfile';
import { BuildingType, emptyLedger, FigureType, isDike, isHostile, isSoldier, isWall, LABOR_CATS, RES_COUNT, Resource, TICKS_PER_TILE, type Ledger, type MoodCause } from './state';
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
import { cityStats, inspectBuilding, type BuildingInfo, type CityStats } from './info';
export interface Snapshot {
  time: GameState['time'];
  speed: number;
  treasury: number;
  population: number;
  housingCapacity: number;
  city: CityStats;
  selected: BuildingInfo | null;
  /** M6c: walker đang chọn (câu thoại) */
  selectedFigure: FigureInfo | null;
  /** QoL: lớp phủ đang bật — giá trị mỗi ô (xem sim/overlay.ts); không bật = undefined */
  overlay?: Uint8Array;
  /** QoL: ô neo các công trình có vấn đề (biểu tượng báo) */
  problems: Uint32Array;
  /** QoL: còn hoàn tác được lần xây gần nhất (worker đặt) */
  undoable?: boolean;
  /** M6b: ô cửa ngõ (camera đưa tới khi mở bản đồ thật) */
  entryOffset: number;
  full?: { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array; bLevel: Uint8Array };
  changed?: { offsets: Uint32Array; terrain: Uint16Array; bType: Uint8Array; bLevel: Uint8Array };
  /** [x, y, nx, ny, progress, type, resource, variant] × n — variant (M8): 4 bit thấp = biến thể hình (giặc: nguồn 0 Chiêm / 1 cướp biển / 2 phương Bắc; xác: loại), bit 16 = đang đánh */
  figures: Int16Array;
}

export const FIG_STRIDE = 8;
export const FIG_FIGHTING = 16;

export function takeSnapshot(s: GameState, full: boolean, selectedId = 0, selectedFigureId = 0, overlayMode: OverlayMode = ''): Snapshot {
  let n = 0;
  for (const f of s.figures) if (f.type !== FigureType.None) n++;
  const figures = new Int16Array(n * FIG_STRIDE);
  let k = 0;
  for (const f of s.figures) {
    if (f.type === FigureType.None) continue;
    // progress quy về thang TICKS_PER_TILE để render nội suy chung (thuyền nan đi nhanh hơn)
    figures[k++] = f.x; figures[k++] = f.y; figures[k++] = f.nx; figures[k++] = f.ny; figures[k++] = Math.round((f.progress * TICKS_PER_TILE) / ticksPerTile(f)); figures[k++] = f.type;
    figures[k++] = f.type === FigureType.Enemy ? f.resource : f.loads > 0 ? f.resource : 0; // giặc: kiện vừa cướp (M8)
    const variant = f.type === FigureType.Enemy || f.type === FigureType.Corpse ? Math.max(0, f.route) & 15 : 0;
    figures[k++] = variant | ((isSoldier(f.type) || isHostile(f.type)) && f.waitTicks > 0 ? FIG_FIGHTING : 0);
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
    selectedFigure: selectedFigureId && s.figures[selectedFigureId]?.type !== FigureType.None ? figureDialogue(s, s.figures[selectedFigureId]) : null,
    problems: problemAnchors(s),
    figures,
  };
  const g = s.grid;
  if (overlayMode && overlayMode !== 'flood') { snap.overlay = new Uint8Array(GRID_SIZE * GRID_SIZE); computeOverlay(s, overlayMode, snap.overlay); }
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

