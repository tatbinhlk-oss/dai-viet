// Nạp kịch bản (màn chơi) từ src/data/scenarios/*.json: bản đồ (file / phẳng / ngẫu nhiên), phẩm hàm, vốn, mục tiêu,
// chiếu chỉ theo năm, sự kiện, tính cách vua, lũ riêng, đất cấp theo phẩm hàm (M6b).
import { createSim } from '../index';
import { BuildingType, Resource, type GameState } from '../state';
import { BUILDING_KEYS, RESOURCES } from '../buildings/defs';
import { scheduleEdict } from '../city/court';
import { addScenarioEvent } from './events';
import { applyLandGrants, type MapDef } from '../map/mapfile';
import { nextScenarioKey, SCENARIOS, type ScenarioDef } from './list';

export { SCENARIOS, SCENARIO_LIST, nextScenarioKey, type ScenarioDef } from './list';

const mapFiles = import.meta.glob('../../data/maps/*.json', { eager: true }) as Record<string, { default: MapDef }>;
/** Bản đồ thật theo tên file (không đuôi): lang-ven-song, tran-li, thang-long. */
export const MAPS: Record<string, MapDef> = {};
for (const [path, mod] of Object.entries(mapFiles)) MAPS[path.replace(/^.*\//, '').replace(/\.json$/, '')] = mod.default;

const RES_KEYS = new Map(RESOURCES.map((r, i) => [r.key, i as Resource]));

/**
 * Tạo sim theo kịch bản. `flat` ép bản đồ phẳng (demo/test) bất kể kịch bản.
 * `carriedRank`: phẩm hàm mang từ màn trước trong chuỗi (M6b) — lấy max với phẩm hàm màn ghi.
 */
export function createScenario(key: string, seed: number, flat?: boolean, carriedRank = 0): GameState {
  const def = SCENARIOS[key];
  if (!def) throw new Error(`Không có kịch bản "${key}"`);
  const useFile = !flat && def.map !== 'flat' && def.map !== 'random';
  if (useFile && !MAPS[def.map]) throw new Error(`Kịch bản ${key}: không có bản đồ "${def.map}"`);
  const s = createSim(seed, useFile ? { map: MAPS[def.map] } : { flat: flat ?? def.map === 'flat' });
  const rank = Math.max(def.rank, carriedRank);
  s.treasury = def.treasury;
  s.court.rank = rank;
  s.court.salaryLevel = rank;
  s.court.favor = def.favor;
  if (def.flood && (def.flood.peakChances.length !== 4 || def.flood.peakChances.reduce((a, v) => a + v, 0) !== 100)) throw new Error(`Kịch bản ${key}: flood.peakChances phải có 4 mức cộng đúng 100`);
  s.scenario = {
    key: def.key, name: def.name, goals: { ...def.goals }, timeLimitYears: def.timeLimitYears, milestoneYears: [...def.milestoneYears], routes: def.routes ?? [],
    king: def.king ?? '', peakChances: def.flood ? [...def.flood.peakChances] : null, promoteTo: def.promoteTo ?? 0, next: nextScenarioKey(key),
    map: useFile ? def.map : '', land: useFile ? (MAPS[def.map].land ?? []).map((g) => ({ rank: g.rank, rect: [...g.rect] as [number, number, number, number] })) : [],
  };
  if (useFile) { applyLandGrants(s.grid, s.scenario.land, rank); s.dirty.clear(); }
  for (const e of def.edicts) {
    const resource = e.resource ? RES_KEYS.get(e.resource) : undefined;
    if (e.resource && resource === undefined) throw new Error(`Kịch bản ${key}: không có hàng "${e.resource}"`);
    const building = e.building ? BUILDING_KEYS.get(e.building) : undefined;
    if (e.building && building === undefined) throw new Error(`Kịch bản ${key}: không có công trình "${e.building}"`);
    scheduleEdict(s, {
      type: e.type, year: e.year, month: e.month, resource: resource ?? Resource.None, building: (building ?? BuildingType.None) as BuildingType,
      amount: e.amount, height: e.height ?? 2, deadlineMonths: e.deadlineMonths, reward: e.reward,
    });
  }
  for (const ev of def.events) addScenarioEvent(s, ev.year, ev.kind, ev.month, ev.amount, ev.height, ev.source);
  return s;
}
