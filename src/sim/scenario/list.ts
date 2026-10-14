// M6b: danh sách màn chơi nạp từ mọi file src/data/scenarios/*.json (thêm màn = thêm file). Không kéo theo sim — UI dùng được.
import type { EdictType, InvasionSource, KingKind, ScenarioState } from '../state';
import type { ScenarioEventKind } from './events';

export interface ScenarioEdictDef { year: number; month?: number; type: EdictType; resource?: string; building?: string; amount: number; height?: number; deadlineMonths: number; reward: number }
export interface ScenarioEventDef { year: number; month?: number; kind: ScenarioEventKind; amount?: number; height?: number; source?: InvasionSource }
export interface ScenarioDef {
  key: string; name: string;
  /** thứ tự trong chuỗi màn (1 = màn đầu); không có = màn lẻ, không nằm trong chuỗi */
  order?: number;
  /** 'flat' | 'random' | tên file trong src/data/maps (không đuôi .json) */
  map: string;
  rank: number; favor: number; treasury: number;
  goals: ScenarioState['goals']; timeLimitYears: number; milestoneYears: number[];
  edicts: ScenarioEdictDef[]; events: ScenarioEventDef[];
  /** M6a: khóa các tuyến buôn (trade.json) mở được trong màn */
  routes?: string[];
  /** M6b */
  king?: KingKind;
  flood?: { peakChances: number[] };
  promoteTo?: number;
  next?: string;
  description?: string;
}

const files = import.meta.glob('../../data/scenarios/*.json', { eager: true }) as Record<string, { default: ScenarioDef }>;
export const SCENARIOS: Record<string, ScenarioDef> = {};
for (const [path, mod] of Object.entries(files)) {
  const def = mod.default;
  if (!def.key) throw new Error(`${path}: thiếu key`);
  if (SCENARIOS[def.key]) throw new Error(`${path}: trùng key "${def.key}"`);
  SCENARIOS[def.key] = def;
}
/** Chuỗi màn theo `order` (làng ven sông → trấn lị → Sơn Nam → Thăng Long), rồi các màn lẻ. */
export const SCENARIO_LIST: ScenarioDef[] = Object.values(SCENARIOS).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.key.localeCompare(b.key));
/** Màn kế trong chuỗi: `next` nếu ghi, không thì màn có order kế tiếp. */
export function nextScenarioKey(key: string): string {
  const def = SCENARIOS[key];
  if (!def) return '';
  if (def.next !== undefined) return def.next;
  if (def.order === undefined) return '';
  return SCENARIO_LIST.find((d) => d.order === def.order! + 1)?.key ?? '';
}
