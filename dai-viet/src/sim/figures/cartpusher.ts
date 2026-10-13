// Xe bò (cart pusher) và phu kho (warehouseman) — figuretype/cartpusher.c + warehouse.c của Julius.
// Quy tắc chọn đích của xe bò (thiết kế phần 3):
//   1. kho đang "Đi lấy" loại hàng này  2. vựa nhận lương thực (đủ 100% nhân công)
//   3. xưởng cùng nguyên liệu đang giữ < 2 kiện (giữ 1 kiện: +20 khoảng cách)  4. kho bất kỳ còn chỗ
//   5. không ai nhận: về chờ, công trình giữ hàng.
// Sửa hai lỗi gốc của Julius: xưởng chỉ nhận đúng nguyên liệu; đích đầy khi tới nơi thì chọn lại.
import { BuildingType, isFood, Resource, StorePolicy, type Building, type Figure, type GameState } from '../state';
import { BUILDING_DEFS, economy, isRawProducer, isWorkshop, UNITS_PER_LOAD } from '../buildings/defs';
import { roadAccess } from '../buildings/spawn';
import { loadsIn, storageAccepts, takeable, warehouseHasRoom, workshopIntake } from '../buildings/storage';
import { bfs, passRoad, UNREACHABLE } from '../map/routing';
import { removeFigure } from './figure';
import { figureOffset, setWalkPath, step, StepResult } from './movement';

interface Pick { b: Building; door: number; dist: number }

function better(cur: Pick | null, b: Building, door: number, dist: number): Pick | null {
  if (dist >= UNREACHABLE) return cur;
  if (!cur || dist < cur.dist) return { b, door, dist };
  return cur;
}

/** Chọn đích cho `loads` kiện `r` xuất phát từ ô `from`; bỏ qua công trình `exclude`. */
export function chooseCartDestination(s: GameState, from: number, r: Resource, exclude: number): Pick | null {
  const dist = bfs(s.grid, from, passRoad).dist;
  let t1: Pick | null = null, t2: Pick | null = null, t3: Pick | null = null, t4: Pick | null = null;
  for (const b of s.buildings) {
    if (b.id === exclude || b.type === BuildingType.None) continue;
    const isStore = b.type === BuildingType.Warehouse || b.type === BuildingType.Granary;
    const ws = isWorkshop(b.type);
    if (!isStore && !ws) continue;
    const door = roadAccess(s.grid, b);
    if (door < 0 || dist[door] >= UNREACHABLE) continue;
    const d = dist[door];
    if (b.type === BuildingType.Warehouse && storageAccepts(b, r)) {
      if (b.policy[r] === StorePolicy.Get) t1 = better(t1, b, door, d);
      else t4 = better(t4, b, door, d);
    } else if (b.type === BuildingType.Granary && isFood(r) && storageAccepts(b, r)) {
      t2 = better(t2, b, door, d);
    } else if (ws) {
      const have = workshopIntake(s, b, r);
      if (have >= 0) t3 = better(t3, b, door, d + (have > 0 ? economy.workshopHalfFullPenalty : 0));
    }
  }
  return t1 ?? t2 ?? t3 ?? t4;
}

/** Đặt đích và đường đi cho xe bò; false nếu không ai nhận. */
export function sendCart(s: GameState, f: Figure): boolean {
  const pick = chooseCartDestination(s, figureOffset(f), f.resource, f.destBuildingId);
  if (!pick) return false;
  f.destBuildingId = pick.b.id;
  return setWalkPath(s, f, pick.door, true);
}

/** Dỡ hàng vào công trình đích; true nếu nhận. */
function unload(s: GameState, f: Figure, b: Building): boolean {
  if (b.type === BuildingType.None || f.loads <= 0) return false;
  if (b.type === BuildingType.Warehouse || b.type === BuildingType.Granary) {
    let n = 0;
    while (n < f.loads && storageAccepts(b, f.resource)) { b.store[f.resource] += UNITS_PER_LOAD; n++; }
    f.loads -= n;
    return n > 0;
  }
  if (BUILDING_DEFS[b.type].input === f.resource) {
    // xưởng: tối đa 2 kiện (không tính chính xe này trong "đang tới")
    const room = Math.max(0, economy.workshopMaxRawLoads - loadsIn(b, f.resource));
    const n = Math.min(room, f.loads);
    b.store[f.resource] += n * UNITS_PER_LOAD;
    f.loads -= n;
    return n > 0;
  }
  return false;
}

function goHome(s: GameState, f: Figure): void {
  const home = s.buildings[f.buildingId];
  const door = home.type !== BuildingType.None ? roadAccess(s.grid, home) : -1;
  f.returning = true;
  if (door < 0 || !setWalkPath(s, f, door, true)) removeFigure(s, f.id);
}

export function updateCartPusher(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  if (r === StepResult.Blocked) {
    if (!f.returning && sendCart(s, f)) return;
    removeFigure(s, f.id); // hàng mất như Julius khi xe kẹt
    return;
  }
  if (!f.returning) {
    const dest = s.buildings[f.destBuildingId];
    unload(s, f, dest);
    if (f.loads > 0 && sendCart(s, f)) return; // đích đầy khi tới nơi → chọn lại
    goHome(s, f);
    return;
  }
  // về tới nhà: còn hàng thì công trình giữ lại, chờ chuyến sau
  const home = s.buildings[f.buildingId];
  if (f.loads > 0 && (isRawProducer(home.type) || isWorkshop(home.type))) home.progress = BUILDING_DEFS[home.type].progressMax;
  removeFigure(s, f.id);
}

// ---------- phu kho ----------

/** Việc của phu kho: chở nguyên liệu tới xưởng đang thiếu, hoặc đi lấy hàng ở kho khác theo lệnh "Đi lấy". */
export function planWarehouseman(s: GameState, w: Building, door: number, f: Figure): boolean {
  const dist = bfs(s.grid, door, passRoad).dist;
  // (a) giao nguyên liệu cho xưởng
  let best: Pick | null = null, bestRes = Resource.None;
  for (const b of s.buildings) {
    if (!isWorkshop(b.type)) continue;
    const input = BUILDING_DEFS[b.type].input;
    if (loadsIn(w, input) < 1 || takeable(s, w, input) < UNITS_PER_LOAD) continue;
    if (workshopIntake(s, b, input) < 0) continue;
    const bd = roadAccess(s.grid, b);
    if (bd < 0) continue;
    const prev: Pick | null = best;
    best = better(best, b, bd, dist[bd]);
    if (best !== prev) bestRes = input;
  }
  if (best) {
    w.store[bestRes] -= UNITS_PER_LOAD;
    f.resource = bestRes; f.loads = 1; f.destBuildingId = best.b.id;
    if (setWalkPath(s, f, best.door, true)) return true;
    w.store[bestRes] += UNITS_PER_LOAD;
    return false;
  }
  // (b) đi lấy hàng
  for (let r = 1; r < w.policy.length; r++) {
    if (w.policy[r] !== StorePolicy.Get || !warehouseHasRoom(w, r)) continue;
    let src: Pick | null = null;
    for (const b of s.buildings) {
      if (b.id === w.id || b.type !== BuildingType.Warehouse || b.policy[r] === StorePolicy.Get) continue;
      if (loadsIn(b, r) < 1) continue;
      const bd = roadAccess(s.grid, b);
      if (bd < 0) continue;
      src = better(src, b, bd, dist[bd]);
    }
    if (src) {
      f.resource = r; f.loads = 0; f.destBuildingId = src.b.id;
      return setWalkPath(s, f, src.door, true);
    }
  }
  return false;
}

export function updateWarehouseman(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  const home = s.buildings[f.buildingId];
  if (r === StepResult.Blocked) { if (f.returning) { removeFigure(s, f.id); return; } goHome(s, f); return; }
  if (!f.returning) {
    const dest = s.buildings[f.destBuildingId];
    if (f.loads > 0) unload(s, f, dest);
    else if (dest.type === BuildingType.Warehouse) {
      let n = 0;
      while (n < economy.warehouseSlotLoads && loadsIn(dest, f.resource) >= 1) { dest.store[f.resource] -= UNITS_PER_LOAD; n++; }
      f.loads = n;
    }
    goHome(s, f);
    return;
  }
  if (home.type === BuildingType.Warehouse) {
    while (f.loads > 0 && warehouseHasRoom(home, f.resource)) { home.store[f.resource] += UNITS_PER_LOAD; f.loads--; }
  }
  removeFigure(s, f.id);
}
