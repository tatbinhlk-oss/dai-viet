import type { Rng } from './rng';
import type { Grid } from './map/grid';

export const TICKS_PER_DAY = 50;
export const DAYS_PER_MONTH = 16;
export const MONTHS_PER_YEAR = 12;
export const TICKS_PER_TILE = 15; // walker đi 1 ô mất 15 tick, như Caesar 3

/** Loại công trình. Số thứ tự là id lưu trong lưới (bType) — chỉ thêm vào cuối, không đổi số cũ. */
export enum BuildingType {
  None = 0,
  House = 1, // level 0 = lều trống chờ dân; 1–8 theo bảng thiết kế (9–10 ở M5)
  Paddy = 2, // ruộng lúa 2×2, chỉ trên FLOODPLAIN
  Granary = 3, // vựa thóc 3×3
  Market = 4, // chợ 2×2
  Well = 5, // giếng 1×1, phủ vùng
  Dinh = 6, // đình làng 2×2
  // --- M3: nguyên liệu ---
  FishWharf = 7, // bến cá, kề sông
  VegGarden = 8, // vườn rau
  PigSty = 9, // chuồng lợn
  ClayPit = 10, // bãi đất sét, trên bãi bồi
  CottonField = 11, // ruộng bông, đất cao
  TeaHill = 12, // đồi chè, đất cao
  MulberryField = 13, // nương dâu nuôi tằm, đất cao
  CopperMine = 14, // mỏ đồng, núi
  IronMine = 15, // mỏ sắt, núi
  SaltPan = 16, // ruộng muối, kề nước
  LumberCamp = 17, // trại gỗ, đất cao
  // --- M3: xưởng ---
  Kiln = 18, // lò gốm
  Loom = 19, // khung cửi
  TeaHouse = 20, // nhà sao chè
  SilkWorkshop = 21, // xưởng dệt lụa
  Foundry = 22, // lò đúc đồng
  Smithy = 23, // lò rèn
  // --- M3: kho, dịch vụ ---
  Warehouse = 24, // kho 3×3, 8 ngăn × 4 kiện
  Temple = 25, // chùa
  School = 26, // lớp học thầy đồ
  Clinic = 27, // nhà thuốc
  BrickWell = 28, // giếng gạch (nước bậc 2)
  Theater = 29, // sân diễn chèo
  WatchPost = 30, // điếm canh — tuần đinh
  BuilderPost = 31, // trại thợ — thợ cả
  Yamen = 32, // nha môn — lại thu thuế
  Garden = 33, // vườn cây
  LotusPond = 34, // ao sen
  Ruins = 35, // đống tro đang cháy
}

export enum Resource {
  None = 0,
  Rice = 1, Fish = 2, Veg = 3, Pork = 4,
  Clay = 5, Pottery = 6,
  Salt = 7,
  Cotton = 8, Cloth = 9,
  TeaLeaf = 10, Tea = 11,
  Cocoon = 12, Silk = 13,
  CopperOre = 14, Bronze = 15,
  IronOre = 16, Weapons = 17,
  Timber = 18,
}
export const RES_COUNT = 19;
export const FOODS: readonly Resource[] = [Resource.Rice, Resource.Fish, Resource.Veg, Resource.Pork];
export const isFood = (r: Resource): boolean => r >= Resource.Rice && r <= Resource.Pork;

/** 9 ngành lao động, thứ tự mặc định như Julius. */
export enum LaborCat {
  Food = 0, Industry = 1, Engineering = 2, Water = 3, Watch = 4, Military = 5, Entertainment = 6, HealthEdu = 7, GovReligion = 8,
}
export const LABOR_CATS = 9;

export enum FigureType {
  None = 0,
  DinhRoamer = 1, // lý trưởng — dịch vụ "đình"
  MarketTrader = 2, // bà bán chợ — phát lương thực + hàng
  MarketBuyer = 3, // người gánh chợ — đi vựa/kho lấy hàng
  CartPusher = 4, // xe bò chở 1 kiện
  Immigrant = 5, // dân nhập cư
  // M3
  Emigrant = 6, // dân bỏ đi
  LaborSeeker = 7, // người mộ phu
  Monk = 8, // sư — chùa
  Teacher = 9, // học trò / thầy đồ
  Healer = 10, // thầy lang
  WellKeeper = 11, // người gánh nước giếng gạch
  Actor = 12, // phường chèo
  Watchman = 13, // tuần đinh
  Builder = 14, // thợ cả
  TaxCollector = 15, // lại thu thuế
  Warehouseman = 16, // phu kho
  Protester = 17, // dân kêu oan
  Thief = 18, // trộm
  Rioter = 19, // loạn dân
}

export enum FigureMode {
  Idle = 0,
  Walk = 1, // theo path
  Roam = 2, // đi ngẫu nhiên trên đường
}

/** Chính sách kho cho từng loại hàng. */
export enum StorePolicy { Accept = 0, Refuse = 1, Get = 2 }

export interface Building {
  id: number;
  type: BuildingType;
  x: number; // ô góc trên-trái của móng
  y: number;
  size: number; // N×N
  // nhà
  level: number; // 0..8
  population: number;
  water: number; // 0 không, 1 giếng, 2 giếng gạch (tính lại mỗi ngày)
  /** bộ đếm dịch vụ 0..96, giảm 1/ngày: dinh, temple, school, clinic, entertainment, market */
  dinh: number;
  temple: number;
  school: number;
  clinic: number;
  entertainment: number;
  marketAccess: number;
  taxCoverage: number; // ngày còn lại được thu thuế (đặt 50 khi lại thu thuế đi qua)
  happiness: number; // 0..100
  hungryPeriods: number; // số kỳ liên tiếp không có lương thực
  evolveDays: number;
  devolveDays: number;
  /** kho hàng theo Resource (đơn vị; 100 = 1 kiện): nhà, vựa, chợ, kho, xưởng (nguyên liệu) */
  store: number[];
  /** chợ: nhu cầu hàng còn lại (ngày) do bà bán chợ ghi khi gặp nhà muốn hàng */
  demand: number[];
  /** kho: chính sách theo Resource */
  policy: StorePolicy[];
  // sản xuất
  progress: number;
  // lao động
  numWorkers: number;
  housesCovered: number; // >0: người mộ phu đã thấy nhà gần đây
  // rủi ro
  fireRisk: number;
  damageRisk: number;
  burnDays: number; // Ruins: số ngày còn cháy
  // walker
  figureId: number; // walker chính (roamer / xe bò / phu kho)
  figureId2: number; // chợ: người gánh chợ
  laborSeekerId: number;
  spawnCounter: number;
}

export interface Figure {
  id: number;
  type: FigureType;
  mode: FigureMode;
  x: number; // ô hiện tại
  y: number;
  nx: number; // ô kế tiếp đang đi tới
  ny: number;
  progress: number; // 0..TICKS_PER_TILE
  prevOffset: number; // ô vừa rời (để roam không quay đầu)
  path: Int32Array; // offset các ô còn phải đi (mode Walk)
  pathIdx: number;
  buildingId: number; // công trình sinh ra walker
  destBuildingId: number;
  roamLength: number;
  maxRoamLength: number;
  returning: boolean; // đang về nhà
  resource: Resource; // hàng đang chở (xe bò, người gánh chợ, phu kho)
  loads: number; // kiện hàng / số dân (migrant)
  /** người gánh chợ: đơn vị từng loại đang gánh (một chuyến lấy nhiều loại, tối đa 8 kiện) */
  cargo: number[];
  waitTicks: number;
}

export interface Time {
  tick: number; // 0..49 trong ngày
  day: number; // 0..15
  month: number; // 0..11
  year: number;
  totalDays: number;
}

/** Sổ thu chi một năm. */
export interface Ledger {
  taxes: number;
  wages: number;
  construction: number;
  stolen: number;
}

export interface Labor {
  workforce: number; // người trong tuổi lao động (60% dân, trừ quan lại)
  employed: number;
  unemploymentPct: number;
  /** ưu tiên theo ngành: 0 = không ưu tiên, 1 = cao nhất … 9 */
  priority: number[];
  needed: number[];
  allocated: number[];
}

export type MoodCause = 'none' | 'tax' | 'unemployment' | 'food' | 'tents';

export interface GameState {
  seed: number;
  rng: Rng;
  time: Time;
  grid: Grid;
  buildings: Building[]; // index 0 giữ trống, id = index
  figures: Figure[]; // index 0 giữ trống
  freeFigures: number[];
  entryOffset: number; // ô dân nhập cư xuất hiện / dân bỏ đi rời bản đồ
  speed: number; // 0 = dừng, 1..3
  treasury: number;
  population: number;
  housingCapacity: number;
  migrationCooldown: number; // ngày
  /** di cư: số người tích lũy chờ đến (+) hoặc chờ đi (−) */
  migrationQuota: number;
  taxRate: number; // %
  sentiment: number; // lòng dân trung bình 0..100
  lowMoodCause: MoodCause;
  labor: Labor;
  thisYear: Ledger;
  lastYear: Ledger;
  /** tích trữ toàn thành: không cho chợ/xưởng lấy ra */
  stockpile: boolean[];
  /** sự kiện gần đây cho UI (cháy, sập, trộm…), tối đa 8 dòng */
  events: string[];
  dirty: Set<number>; // offset ô đã đổi kể từ snapshot trước
}

export function newBuilding(id: number, type: BuildingType, x: number, y: number, size: number): Building {
  return {
    id, type, x, y, size,
    level: 0, population: 0, water: 0,
    dinh: 0, temple: 0, school: 0, clinic: 0, entertainment: 0, marketAccess: 0, taxCoverage: 0,
    happiness: 60, hungryPeriods: 0, evolveDays: 0, devolveDays: 0,
    store: new Array(RES_COUNT).fill(0),
    demand: new Array(RES_COUNT).fill(0),
    policy: new Array(RES_COUNT).fill(StorePolicy.Accept),
    progress: 0, numWorkers: 0, housesCovered: 0,
    fireRisk: 0, damageRisk: 0, burnDays: 0,
    figureId: 0, figureId2: 0, laborSeekerId: 0, spawnCounter: 0,
  };
}

export const emptyLedger = (): Ledger => ({ taxes: 0, wages: 0, construction: 0, stolen: 0 });
