import type { Rng } from './rng';
import type { Grid } from './map/grid';

export const TICKS_PER_DAY = 50;
export const DAYS_PER_MONTH = 16;
export const MONTHS_PER_YEAR = 12;

export enum BuildingType {
  None = 0,
  HouseVacant = 1, // lều tranh trống, chờ dân đến (M2)
}

export interface Building {
  id: number;
  type: BuildingType;
  x: number; // ô góc trên-trái của móng
  y: number;
  size: number; // N×N
  state: number; // 0 = trống, 1 = đang dùng (M2)
}

export interface Time {
  tick: number; // 0..49 trong ngày
  day: number; // 0..15
  month: number; // 0..11
  year: number; // năm kịch bản, hiển thị +1
  totalDays: number;
}

export interface GameState {
  seed: number;
  rng: Rng;
  time: Time;
  grid: Grid;
  buildings: Building[]; // index 0 giữ trống, id = index
  speed: number; // 0 = dừng, 1..3
  treasury: number;
  population: number;
  dirty: Set<number>; // offset ô đã đổi kể từ snapshot trước
}
