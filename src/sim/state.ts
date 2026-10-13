import type { Rng } from './rng';
import type { Grid } from './map/grid';

export const TICKS_PER_DAY = 50;
export const DAYS_PER_MONTH = 16;
export const MONTHS_PER_YEAR = 12;
export const TICKS_PER_TILE = 15; // walker đi 1 ô mất 15 tick, như Caesar 3

export enum BuildingType {
  None = 0,
  House = 1, // level 0 = lều trống chờ dân; 1–5 theo bảng thiết kế
  Paddy = 2, // ruộng lúa 2×2, chỉ trên FLOODPLAIN
  Granary = 3, // vựa thóc 3×3
  Market = 4, // chợ 2×2
  Well = 5, // giếng 1×1, phủ vùng
  Dinh = 6, // đình làng 2×2, sinh walker
}

export enum FigureType {
  None = 0,
  DinhRoamer = 1, // ông từ / lý trưởng đi quanh làng — dịch vụ "đình"
  MarketTrader = 2, // bà bán chợ — phát lương thực cho nhà
  MarketBuyer = 3, // người gánh chợ — đi vựa lấy gạo về chợ
  CartPusher = 4, // xe bò chở lúa từ ruộng tới vựa
  Immigrant = 5, // dân nhập cư đi từ mép bản đồ tới nhà trống
}

export enum FigureMode {
  Idle = 0,
  Walk = 1, // theo path
  Roam = 2, // đi ngẫu nhiên trên đường
}

export interface Building {
  id: number;
  type: BuildingType;
  x: number; // ô góc trên-trái của móng
  y: number;
  size: number; // N×N
  // nhà
  level: number; // 0..5
  population: number;
  water: boolean; // trong tầm giếng (tính lại mỗi ngày)
  food: number; // đơn vị; 100 = 1 kiện
  dinh: number; // 0..96, giảm 1 mỗi ngày
  evolveDays: number; // số ngày liên tiếp đủ điều kiện lên bậc
  devolveDays: number; // số ngày liên tiếp hụt điều kiện bậc hiện tại
  // sản xuất / kho
  progress: number; // ruộng: 0..200
  stock: number; // vựa, chợ: đơn vị lương thực
  // walker
  figureId: number; // roamer / cart đang ra ngoài (0 = không)
  figureId2: number; // chợ: người gánh đi lấy hàng
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
  buildingId: number; // nhà/công trình sinh ra walker
  destBuildingId: number;
  roamLength: number;
  maxRoamLength: number;
  returning: boolean; // đang về nhà
  loads: number; // kiện hàng đang chở / số dân (immigrant)
  waitTicks: number;
}

export interface Time {
  tick: number; // 0..49 trong ngày
  day: number; // 0..15
  month: number; // 0..11
  year: number;
  totalDays: number;
}

export interface GameState {
  seed: number;
  rng: Rng;
  time: Time;
  grid: Grid;
  buildings: Building[]; // index 0 giữ trống, id = index
  figures: Figure[]; // index 0 giữ trống
  freeFigures: number[]; // id đã giải phóng để tái dùng
  entryOffset: number; // ô dân nhập cư xuất hiện
  speed: number; // 0 = dừng, 1..3
  treasury: number;
  population: number;
  housingCapacity: number;
  migrationCooldown: number; // ngày
  dirty: Set<number>; // offset ô đã đổi kể từ snapshot trước
}

export function newBuilding(id: number, type: BuildingType, x: number, y: number, size: number): Building {
  return {
    id, type, x, y, size,
    level: 0, population: 0, water: false, food: 0, dinh: 0, evolveDays: 0, devolveDays: 0,
    progress: 0, stock: 0, figureId: 0, figureId2: 0, spawnCounter: 0,
  };
}
