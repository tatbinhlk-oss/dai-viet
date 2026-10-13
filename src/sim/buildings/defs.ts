// Bảng công trình M2. Số liệu lấy từ tài liệu thiết kế (phần 2, 4, 7); đổi ở đây, không đổi trong code logic.
import { BuildingType } from '../state';

export interface BuildingDef {
  name: string;
  size: number;
  cost: number;
  needsFloodplain: boolean; // ruộng lúa
  // độ hấp dẫn: giá trị tại vòng 1, mỗi `step` vòng cộng thêm `delta`, tới `range` vòng
  desirability: { value: number; step: number; delta: number; range: number } | null;
  spawnsRoamer: boolean;
  maxRoam: number;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  [BuildingType.None]: { name: '', size: 0, cost: 0, needsFloodplain: false, desirability: null, spawnsRoamer: false, maxRoam: 0 },
  [BuildingType.House]: { name: 'Nhà', size: 1, cost: 10, needsFloodplain: false, desirability: null, spawnsRoamer: false, maxRoam: 0 },
  [BuildingType.Paddy]: { name: 'Ruộng lúa', size: 2, cost: 40, needsFloodplain: true, desirability: null, spawnsRoamer: false, maxRoam: 0 },
  [BuildingType.Granary]: { name: 'Vựa thóc', size: 3, cost: 100, needsFloodplain: false, desirability: { value: -4, step: 1, delta: 1, range: 3 }, spawnsRoamer: false, maxRoam: 0 },
  [BuildingType.Market]: { name: 'Chợ', size: 2, cost: 50, needsFloodplain: false, desirability: { value: -2, step: 1, delta: 1, range: 3 }, spawnsRoamer: true, maxRoam: 192 },
  [BuildingType.Well]: { name: 'Giếng', size: 1, cost: 15, needsFloodplain: false, desirability: { value: 4, step: 1, delta: -1, range: 4 }, spawnsRoamer: false, maxRoam: 0 },
  [BuildingType.Dinh]: { name: 'Đình làng', size: 2, cost: 120, needsFloodplain: false, desirability: { value: 8, step: 2, delta: -2, range: 6 }, spawnsRoamer: true, maxRoam: 96 },
};

/** Tên và sức chứa nhà theo bậc (1×1). Bậc 0 = lều trống. */
export const HOUSE_LEVELS = [
  { name: 'Lều trống', capacity: 5 },
  { name: 'Lều tranh', capacity: 5 },
  { name: 'Nhà tranh', capacity: 8 },
  { name: 'Nhà đất', capacity: 12 },
  { name: 'Nhà gỗ', capacity: 16 },
  { name: 'Nhà gạch', capacity: 20 },
];
export const MAX_HOUSE_LEVEL = 5;

export const WELL_RANGE = 2; // ô, mỗi phía
export const SERVICE_RANGE = 2; // walker phủ 5×5 quanh ô đang đứng
export const SERVICE_MAX = 96; // như MAX_COVERAGE của Julius, giảm 1/ngày
export const FOOD_PER_LOAD = 100;
export const PADDY_MAX_PROGRESS = 200; // như MAX_PROGRESS_RAW
export const PADDY_PROGRESS_PER_DAY = 4; // ~50 ngày/kiện; chỉnh ở M3 khi có lao động
export const GRANARY_CAPACITY = 24 * FOOD_PER_LOAD;
export const MARKET_CAPACITY = 8 * FOOD_PER_LOAD;
export const MARKET_BUYER_LOADS = 4;
export const MARKET_REORDER_BELOW = 4 * FOOD_PER_LOAD;
export const SPAWN_DELAY_DAYS = 3; // 100% nhân công theo Julius; M3 nối với lao động
export const MIGRATION_INTERVAL_DAYS = 2;
export const MIGRANT_GROUP_MIN = 4;
export const MIGRANT_GROUP_RANDOM = 4;
