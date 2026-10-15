// Gộp nhà và nở rộng nhà theo Caesar 3 (Julius building/house.c):
// - Gộp: bốn nhà 1×1 cùng bậc (bậc 1–8), có dân, chưa gộp, xếp thành ô vuông 2×2 lấy nhà làm góc trên trái → một nhà 2×2 "đã gộp",
//   cùng bậc, sức chứa ×4, dân và hàng cộng dồn. Như C3 (map_random theo ô): 5/8 số ô cho gộp, 3/8 không bao giờ — tính bằng băm (ô, seed),
//   không tiêu RNG chung nên không làm lệch các việc ngẫu nhiên khác.
// - Nở: bậc 9 (Tư dinh) chỉ có cỡ 2×2, bậc 10 (Phủ đệ) chỉ có cỡ 3×3. Khi đủ điều kiện lên bậc, thử đặt khối N×N chứa nhà hiện tại
//   ở các vị trí có thể; ô được nhận nếu là chính nhà, nhà khác bậc thấp hơn hoặc bằng nằm trọn trong khối, đất trống xây được, hay vườn;
//   ba vòng ưu tiên: chỉ nhà → thêm đất trống → thêm vườn. Không có chỗ thì nhà đứng ở bậc hiện tại.
// - Tụt: 3×3 (bậc 10) xuống bậc 9 thì co về 2×2 ở góc trên trái, năm ô kia thành nhà 1×1 bậc 8 chia nhau dân dư; 2×2 bậc 9 xuống 8 giữ 2×2 (đã gộp).
import { BuildingType, newBuilding, type Building, type GameState } from '../state';
import { gridOffset, inBounds, T_BUILDING, T_RESERVED, T_ROAD, T_TREE, T_WATER } from '../map/grid';
import { HOUSE_LEVELS } from './defs';
import { anchorOffset, removeBuilding, setHouseLevel } from './spawn';
/** Số ngẫu nhiên cố định theo ô và seed màn (0–7), thay cho map_random của Caesar 3. */
export function tileRandom(seed: number, x: number, y: number): number {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 7;
}

/** Cỡ tối thiểu của nhà ở bậc `level`: 1–8 là 1×1 (gộp được thành 2×2), 9 là 2×2, 10 là 3×3. */
export const houseMinSize = (level: number): number => (level >= 10 ? 3 : level >= 9 ? 2 : 1);

/** Sức chứa: bậc 1–8 nhân theo số ô khi đã gộp (2×2 → ×4); bậc 9–10 theo bảng (40 / 90). */
export function houseCapacity(b: { level: number; size: number }): number {
  const base = HOUSE_LEVELS[Math.max(1, Math.min(b.level, HOUSE_LEVELS.length - 1))].capacity;
  return b.level <= 8 ? base * b.size * b.size : base;
}

/** Đổi móng nhà `b` sang khối (x, y, size): bỏ các công trình bị nuốt, ghi lại lưới, giữ id. */
function reshape(s: GameState, b: Building, x: number, y: number, size: number, absorbed: Building[]): void {
  for (const a of absorbed) if (a.id !== b.id) removeBuilding(s, a);
  for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) {
    const o = gridOffset(b.x + dx, b.y + dy);
    s.grid.terrain[o] &= ~T_BUILDING; s.grid.buildingId[o] = 0; s.grid.bType[o] = 0; s.grid.bLevel[o] = 0; s.dirty.add(o);
  }
  b.x = x; b.y = y; b.size = size;
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
    const o = gridOffset(x + dx, y + dy);
    s.grid.terrain[o] = (s.grid.terrain[o] & ~T_TREE) | T_BUILDING; s.grid.buildingId[o] = b.id; s.grid.bType[o] = 0; s.grid.bLevel[o] = 0; s.dirty.add(o);
  }
  s.grid.bType[anchorOffset(x, y, size)] = BuildingType.House;
  setHouseLevel(s, b, b.level);
}

/** Cộng dân, hàng và dịch vụ của nhà bị nuốt vào nhà chính. */
function absorb(into: Building, from: Building): void {
  into.population += from.population;
  for (let r = 0; r < into.store.length; r++) into.store[r] += from.store[r];
  for (const k of ['water', 'dinh', 'temple', 'school', 'clinic', 'entertainment', 'academy', 'puppet', 'shrine', 'altar', 'marketAccess', 'taxCoverage'] as const) into[k] = Math.max(into[k], from[k]);
  from.population = 0;
}

/** Gộp bốn nhà 1×1 cùng bậc (nhà là góc trên trái). Trả về true nếu gộp. */
export function tryMergeHouses(s: GameState, b: Building): boolean {
  if (b.type !== BuildingType.House || b.size !== 1 || b.merged || b.level < 1 || b.level > 8 || b.population === 0) return false;
  if (tileRandom(s.seed, b.x, b.y) >= 5) return false; // C3: (map_random & 7) >= 5 thì không gộp
  const others: Building[] = [];
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
    const x = b.x + dx, y = b.y + dy;
    if (!inBounds(x, y)) return false;
    const o = s.buildings[s.grid.buildingId[gridOffset(x, y)]];
    if (!o || o.type !== BuildingType.House || o.size !== 1 || o.merged || o.level !== b.level || o.population === 0 || o.x !== x || o.y !== y) return false;
    others.push(o);
  }
  for (const o of others) absorb(b, o);
  b.merged = true;
  reshape(s, b, b.x, b.y, 2, others);
  return true;
}

interface Plan { x: number; y: number; absorbed: Building[] }

/** Tìm khối `size`×`size` chứa nhà để nở; null = không có chỗ. Ba vòng: chỉ nhà → thêm đất trống → thêm vườn. */
export function findExpansion(s: GameState, b: Building, size: number): Plan | null {
  const g = s.grid;
  const origins: [number, number][] = [];
  for (let oy = b.y + b.size - size; oy <= b.y; oy++) for (let ox = b.x + b.size - size; ox <= b.x; ox++) origins.push([ox, oy]);
  for (let pass = 0; pass < 3; pass++) {
    for (const [ox, oy] of origins) {
      const absorbed = new Map<number, Building>();
      let ok = true;
      for (let dy = 0; dy < size && ok; dy++) for (let dx = 0; dx < size && ok; dx++) {
        const x = ox + dx, y = oy + dy;
        if (!inBounds(x, y)) { ok = false; break; }
        const o = gridOffset(x, y), t = g.terrain[o];
        if (t & (T_WATER | T_ROAD | T_RESERVED)) { ok = false; break; }
        const id = g.buildingId[o];
        if (id === b.id) continue;
        if (id) {
          const other = s.buildings[id];
          const inside = other.x >= ox && other.y >= oy && other.x + other.size <= ox + size && other.y + other.size <= oy + size;
          const house = other.type === BuildingType.House && other.level <= b.level && inside;
          const garden = pass >= 2 && other.type === BuildingType.Garden && inside;
          if (!house && !garden) { ok = false; break; }
          absorbed.set(id, other);
        } else if (t & T_BUILDING || pass < 1) { ok = false; break; } // đất trống chỉ từ vòng 2
      }
      if (ok) return { x: ox, y: oy, absorbed: [...absorbed.values()] };
    }
  }
  return null;
}

/** Nở nhà thành `size`×`size` (nuốt nhà bậc thấp hơn, đất trống, vườn). Trả về true nếu nở. */
export function tryExpandHouse(s: GameState, b: Building, size: number): boolean {
  if (b.size >= size) return true;
  const plan = findExpansion(s, b, size);
  if (!plan) return false;
  for (const o of plan.absorbed) if (o.type === BuildingType.House) absorb(b, o);
  b.merged = false;
  reshape(s, b, plan.x, plan.y, size, plan.absorbed);
  return true;
}

/** Co nhà về `size`×`size` ở góc trên trái (tụt bậc); các ô thừa thành nhà 1×1 bậc `spillLevel` chia nhau dân dư. */
export function shrinkHouse(s: GameState, b: Building, size: number, spillLevel: number): void {
  if (b.size <= size) return;
  const old = b.size, x0 = b.x, y0 = b.y;
  reshape(s, b, x0, y0, size, []);
  const spill: Building[] = [];
  for (let dy = 0; dy < old; dy++) for (let dx = 0; dx < old; dx++) {
    if (dx < size && dy < size) continue;
    const id = s.buildings.length;
    const h = newBuilding(id, BuildingType.House, x0 + dx, y0 + dy, 1);
    h.happiness = b.happiness;
    s.buildings.push(h);
    const o = gridOffset(x0 + dx, y0 + dy);
    s.grid.terrain[o] = (s.grid.terrain[o] & ~T_TREE) | T_BUILDING; s.grid.buildingId[o] = id; s.dirty.add(o);
    s.grid.bType[o] = BuildingType.House;
    setHouseLevel(s, h, spillLevel);
    spill.push(h);
  }
  let extra = Math.max(0, b.population - houseCapacity(b));
  b.population -= extra;
  for (const h of spill) { const take = Math.min(extra, houseCapacity(h)); h.population = take; extra -= take; if (take === 0) setHouseLevel(s, h, 0); }
}
