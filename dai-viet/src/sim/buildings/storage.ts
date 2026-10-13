// Vựa, kho, xưởng, chợ: ai nhận hàng gì, còn bao nhiêu chỗ — building/storage.c + warehouse.c + granary.c của Julius.
// Đơn vị: 100 = 1 kiện. Kho tính theo ngăn: 8 ngăn × 4 kiện, mỗi ngăn một loại.
import { BuildingType, FigureType, isFood, Resource, StorePolicy, type Building, type GameState } from '../state';
import { BUILDING_DEFS, economy, GRANARY_CAPACITY, UNITS_PER_LOAD } from './defs';

const SLOT_LOADS = economy.warehouseSlotLoads;
const SLOTS = economy.warehouseSlots;

export const loadsIn = (b: Building, r: Resource): number => Math.floor(b.store[r] / UNITS_PER_LOAD);
export const totalUnits = (b: Building): number => b.store.reduce((a, v) => a + v, 0);

export function warehouseSlotsUsed(b: Building): number {
  let n = 0;
  for (let r = 1; r < b.store.length; r++) n += Math.ceil(b.store[r] / UNITS_PER_LOAD / SLOT_LOADS);
  return n;
}

/** Kho còn chỗ cho thêm 1 kiện loại r? */
export function warehouseHasRoom(b: Building, r: Resource): boolean {
  const loads = loadsIn(b, r);
  const extraSlot = loads % SLOT_LOADS === 0 ? 1 : 0; // kiện này mở ngăn mới
  return warehouseSlotsUsed(b) + extraSlot <= SLOTS;
}

/** Công trình chứa này có nhận 1 kiện r không (vựa cần đủ 100% nhân công, kho cần có người). */
export function storageAccepts(b: Building, r: Resource): boolean {
  if (b.policy[r] === StorePolicy.Refuse) return false;
  if (b.type === BuildingType.Granary) {
    return isFood(r) && b.numWorkers >= BUILDING_DEFS[b.type].workers && totalUnits(b) + UNITS_PER_LOAD <= GRANARY_CAPACITY;
  }
  if (b.type === BuildingType.Warehouse) return b.numWorkers > 0 && warehouseHasRoom(b, r);
  return false;
}

/** Số kiện xe bò / phu kho đang chở tới công trình b. */
export function incomingLoads(s: GameState, b: Building, r: Resource): number {
  let n = 0;
  for (const f of s.figures) {
    if (f.destBuildingId !== b.id || f.returning || f.resource !== r) continue;
    if (f.type === FigureType.CartPusher || f.type === FigureType.Warehouseman) n += f.loads;
  }
  return n;
}

/** Xưởng cần thêm nguyên liệu: đang giữ + đang tới < 2 kiện. Trả số kiện đang giữ + tới (để tính phạt), −1 nếu không nhận. */
export function workshopIntake(s: GameState, b: Building, r: Resource): number {
  if (BUILDING_DEFS[b.type].input !== r || b.numWorkers <= 0) return -1;
  const have = loadsIn(b, r) + incomingLoads(s, b, r);
  return have < economy.workshopMaxRawLoads ? have : -1;
}

/** Lấy được bao nhiêu đơn vị r từ công trình chứa này (tôn trọng lệnh tích trữ). */
export function takeable(s: GameState, b: Building, r: Resource): number {
  if (s.stockpile[r]) return 0;
  if (b.type !== BuildingType.Granary && b.type !== BuildingType.Warehouse) return 0;
  return b.store[r];
}

export function take(b: Building, r: Resource, maxUnits: number): number {
  const n = Math.min(maxUnits, b.store[r]);
  b.store[r] -= n;
  return n;
}
