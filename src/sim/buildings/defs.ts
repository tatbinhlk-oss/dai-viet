// Nạp bảng số từ src/data/*.json và đổi sang kiểu có enum. Chỉnh cân bằng ở JSON, không ở đây.
// File này kiểm tra dữ liệu ngay khi nạp: thiếu khóa hay sai tên là ném lỗi (test bắt được).
import buildingsJson from '../../data/buildings.json';
import housesJson from '../../data/houses.json';
import economyJson from '../../data/economy.json';
import resourcesJson from '../../data/resources.json';
import floodJson from '../../data/flood.json';
import courtJson from '../../data/court.json';
import { BuildingType, FigureType, LaborCat, Resource, RES_COUNT } from '../state';

const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);
function enumKeys<T extends Record<string, string | number>>(e: T): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of Object.keys(e)) if (isNaN(Number(k))) m.set(lowerFirst(k), e[k] as number);
  return m;
}
const FIGURE_KEYS = enumKeys(FigureType);
const LABOR_KEYS = enumKeys(LaborCat);
export const BUILDING_KEYS = enumKeys(BuildingType); // 'paddy' → BuildingType.Paddy

// ---------- tài nguyên ----------

export type ResourceKind = 'none' | 'food' | 'raw' | 'good' | 'material';
export interface ResourceDef { key: string; name: string; kind: ResourceKind }
export const RESOURCES: ResourceDef[] = resourcesJson.list as ResourceDef[];
if (RESOURCES.length !== RES_COUNT) throw new Error(`resources.json có ${RESOURCES.length} loại, enum có ${RES_COUNT}`);
const RES_KEYS = new Map(RESOURCES.map((r, i) => [r.key, i]));
function res(key: string | undefined): Resource {
  if (!key) return Resource.None;
  const r = RES_KEYS.get(key);
  if (r === undefined) throw new Error(`Không có tài nguyên "${key}"`);
  return r;
}
export const GOODS: Resource[] = RESOURCES.map((_, i) => i).filter((i) => RESOURCES[i].kind === 'good');

// ---------- công trình ----------

export type TerrainRule = 'any' | 'floodplain' | 'highland' | 'mountain' | 'shore' | 'land' | 'road';
export interface Desirability { value: number; step: number; delta: number; range: number }
export interface WalkerDef { figure: FigureType; roam: number; delays: number[] }
export interface BuildingDef {
  key: string;
  name: string;
  /** M6-0: tên ngắn ghi lên hình tạm / nhãn */
  short?: string;
  group: string;
  size: number;
  cost: number;
  workers: number;
  labor: LaborCat | -1;
  terrain: TerrainRule;
  produces: Resource;
  input: Resource;
  progressMax: number;
  fire: number;
  damage: number;
  desirability: Desirability | null;
  walker: WalkerDef | null;
  waterLevel: number;
  waterRange: number;
  /** M5: phẩm hàm tối thiểu để xây (0 = ai cũng xây được) */
  rank: number;
}

interface RawBuilding {
  name: string; short?: string; group: string; size: number; cost: number; workers: number; labor?: string; terrain?: string;
  produces?: string; input?: string; progressMax?: number; fire: number; damage: number;
  desirability?: number[]; walker?: { figure: string; roam: number; delays: string }; waterLevel?: number; waterRange?: number; rank?: number;
}

export const economy = economyJson;
/** Số cân bằng lũ và đê (M4). */
export const flood = floodJson;
/** Triều đình, tín ngưỡng, chỉ số (M5). */
export const court = courtJson;
if (court.ranks.names.length !== 9 || court.ranks.salary.length !== 9) throw new Error('court.json: phải có 9 phẩm hàm');
if (flood.peakChances.byLevel.reduce((a, v) => a + v, 0) !== 100) throw new Error('flood.json: peakChances phải cộng đúng 100');
if (flood.season.riseDays + flood.season.holdDays + flood.season.recedeDays !== 64) throw new Error('flood.json: mùa lũ phải đúng 64 ngày (4 tháng)');
const DELAYS = economy.spawnDelays as unknown as Record<string, number[]>;

const desir = (a: number[] | null | undefined): Desirability | null => (a ? { value: a[0], step: a[1], delta: a[2], range: a[3] } : null);

function toDef(key: string, r: RawBuilding): BuildingDef {
  let labor: LaborCat | -1 = -1;
  if (r.labor) {
    const l = LABOR_KEYS.get(r.labor);
    if (l === undefined) throw new Error(`${key}: ngành lao động "${r.labor}" không có`);
    labor = l;
  }
  let walker: WalkerDef | null = null;
  if (r.walker) {
    const f = FIGURE_KEYS.get(r.walker.figure);
    if (f === undefined) throw new Error(`${key}: walker "${r.walker.figure}" không có`);
    const d = DELAYS[r.walker.delays];
    if (!d) throw new Error(`${key}: bảng chu kỳ "${r.walker.delays}" không có`);
    walker = { figure: f, roam: r.walker.roam, delays: d };
  }
  return {
    key, name: r.name, short: r.short, group: r.group, size: r.size, cost: r.cost, workers: r.workers, labor,
    terrain: (r.terrain ?? 'any') as TerrainRule,
    produces: res(r.produces), input: res(r.input), progressMax: r.progressMax ?? 0,
    fire: r.fire, damage: r.damage, desirability: desir(r.desirability), walker,
    waterLevel: r.waterLevel ?? 0, waterRange: r.waterRange ?? 0, rank: r.rank ?? 0,
  };
}

const NONE_DEF = toDef('none', { name: '', group: 'none', size: 0, cost: 0, workers: 0, fire: 0, damage: 0 });
export const BUILDING_DEFS: BuildingDef[] = [];
for (const [key, type] of BUILDING_KEYS) {
  if (type === BuildingType.None) { BUILDING_DEFS[type] = NONE_DEF; continue; }
  const raw = (buildingsJson as unknown as Record<string, RawBuilding>)[key];
  if (!raw) throw new Error(`buildings.json thiếu "${key}"`);
  BUILDING_DEFS[type] = toDef(key, raw);
}

export const isRawProducer = (t: BuildingType): boolean => BUILDING_DEFS[t].produces !== Resource.None && BUILDING_DEFS[t].input === Resource.None;
export const isWorkshop = (t: BuildingType): boolean => BUILDING_DEFS[t].input !== Resource.None;

// ---------- nhà ở ----------

export interface HouseNeeds {
  water: number; foodTypes: number; dinh: boolean; temple: boolean; school: boolean; clinic: boolean;
  entertainment: boolean; market: boolean; goods: Resource[]; desirability: number;
  academy: boolean; puppet: boolean; shrine: boolean; // M5
}
export interface HouseLevel {
  name: string; tier: number; capacity: number; tax: number; fire: number;
  prosperity: number; // M5: giá trị thịnh vượng của bậc
  desirability: Desirability | null;
  /** yêu cầu CỘNG DỒN để ở bậc này */
  needs: HouseNeeds;
}

interface RawNeeds { water?: number; foodTypes?: number; dinh?: boolean; temple?: boolean; school?: boolean; clinic?: boolean; entertainment?: boolean; market?: boolean; goods?: string[]; desirability?: number; academy?: boolean; puppet?: boolean; shrine?: boolean }
const cumulative: HouseNeeds = { water: 0, foodTypes: 0, dinh: false, temple: false, school: false, clinic: false, entertainment: false, market: false, goods: [], desirability: -100, academy: false, puppet: false, shrine: false };
export const HOUSE_LEVELS: HouseLevel[] = housesJson.levels.map((l) => {
  const n = l.needs as RawNeeds;
  if (n.water !== undefined) cumulative.water = n.water;
  if (n.foodTypes !== undefined) cumulative.foodTypes = n.foodTypes;
  if (n.dinh) cumulative.dinh = true;
  if (n.temple) cumulative.temple = true;
  if (n.school) cumulative.school = true;
  if (n.clinic) cumulative.clinic = true;
  if (n.entertainment) cumulative.entertainment = true;
  if (n.market) cumulative.market = true;
  if (n.academy) cumulative.academy = true;
  if (n.puppet) cumulative.puppet = true;
  if (n.shrine) cumulative.shrine = true;
  if (n.goods) cumulative.goods = [...cumulative.goods, ...n.goods.map(res)];
  if (n.desirability !== undefined) cumulative.desirability = n.desirability;
  return { name: l.name, tier: l.tier, capacity: l.capacity, tax: l.tax, fire: l.fire, prosperity: (l as { prosperity?: number }).prosperity ?? 5, desirability: desir(l.desirability), needs: { ...cumulative, goods: [...cumulative.goods] } };
});
export const MAX_HOUSE_LEVEL: number = housesJson.maxLevel;
export const EVOLVE_AFTER_DAYS: number = housesJson.evolveAfterDays;
export const DEVOLVE_AFTER_DAYS: number = housesJson.devolveAfterDays;

// ---------- hằng số dùng chung ----------

export const UNITS_PER_LOAD = 100;
export const FOOD_PER_LOAD = UNITS_PER_LOAD;
export const SERVICE_RANGE = 2; // walker phủ 5×5 quanh ô đang đứng
export const SERVICE_MAX: number = economy.serviceMax; // như MAX_COVERAGE của Julius, giảm 1/ngày
export const GRANARY_CAPACITY = economy.granaryCapacityLoads * UNITS_PER_LOAD;
export const MIGRATION_INTERVAL_DAYS = 1;

/** Chu kỳ sinh walker theo % nhân công (bảng 5 mức của Julius). Trả −1 nếu không có người làm. */
export function spawnDelay(delays: number[], pctWorkers: number): number {
  if (pctWorkers >= 100) return delays[0];
  if (pctWorkers >= 75) return delays[1];
  if (pctWorkers >= 50) return delays[2];
  if (pctWorkers >= 25) return delays[3];
  if (pctWorkers > 0) return delays[4];
  return -1;
}
