// Nạp kịch bản (màn chơi) từ src/data/scenarios/*.json: phẩm hàm, vốn, mục tiêu, chiếu chỉ theo năm, sự kiện.
import sonNam from '../../data/scenarios/son-nam.json';
import { createSim } from '../index';
import { BuildingType, Resource, type EdictType, type GameState, type ScenarioState } from '../state';
import { BUILDING_KEYS, RESOURCES } from '../buildings/defs';
import { scheduleEdict } from '../city/court';
import { addScenarioEvent, type ScenarioEventKind } from './events';

export interface ScenarioEdictDef { year: number; month?: number; type: EdictType; resource?: string; building?: string; amount: number; height?: number; deadlineMonths: number; reward: number }
export interface ScenarioEventDef { year: number; month?: number; kind: ScenarioEventKind; amount?: number; height?: number }
export interface ScenarioDef {
  key: string; name: string; map: 'flat' | 'random'; rank: number; favor: number; treasury: number;
  goals: ScenarioState['goals']; timeLimitYears: number; milestoneYears: number[];
  edicts: ScenarioEdictDef[]; events: ScenarioEventDef[];
}

export const SCENARIOS: Record<string, ScenarioDef> = { sonNam: sonNam as ScenarioDef };

const RES_KEYS = new Map(RESOURCES.map((r, i) => [r.key, i as Resource]));

/** Tạo sim theo kịch bản. `flat` ép bản đồ phẳng (demo/test) bất kể kịch bản. */
export function createScenario(key: string, seed: number, flat?: boolean): GameState {
  const def = SCENARIOS[key];
  if (!def) throw new Error(`Không có kịch bản "${key}"`);
  const s = createSim(seed, { flat: flat ?? def.map === 'flat' });
  s.treasury = def.treasury;
  s.court.rank = def.rank;
  s.court.salaryLevel = def.rank;
  s.court.favor = def.favor;
  s.scenario = { key: def.key, name: def.name, goals: { ...def.goals }, timeLimitYears: def.timeLimitYears, milestoneYears: [...def.milestoneYears] };
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
  for (const ev of def.events) addScenarioEvent(s, ev.year, ev.kind, ev.month, ev.amount, ev.height);
  return s;
}
