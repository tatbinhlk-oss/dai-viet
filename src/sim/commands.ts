// Lệnh từ UI vào sim. Đây là đường DUY NHẤT để thay đổi state từ ngoài, nên replay/undo làm được.
import { BuildingType, isDike, LABOR_CATS, LaborCat, StorePolicy, type GameState, type Resource } from './state';
import { dispatchEdict, sendGift, setSalary } from './city/court';
import { holdFestival } from './city/worship';
import { placeBuilding, placeRoad, raze } from './buildings/spawn';
import { BUILDING_KEYS } from './buildings/defs';
import { planDike, setSluice } from './buildings/dike';

/** 'road' hoặc khóa công trình trong buildings.json (house, paddy, kiln, warehouse…). */
export type BuildKind = string;

export type Command =
  | { type: 'build'; kind: BuildKind; x: number; y: number }
  | { type: 'raze'; x: number; y: number }
  | { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 }
  | { type: 'setTax'; rate: number }
  | { type: 'setLaborPriority'; category: number; priority: number }
  | { type: 'setStorePolicy'; buildingId: number; resource: Resource; policy: StorePolicy }
  | { type: 'setStockpile'; resource: Resource; on: boolean }
  /** M4: mở/đóng cống (đoạn đê đặc biệt) */
  | { type: 'openSluice'; buildingId: number; open: boolean }
  /** M5: triều đình — tiến cống (cỡ 0..2), thi hành chiếu chỉ (lao dịch: option = 0..2 nhanh/chậm), bổng lộc, lễ hội */
  | { type: 'sendGift'; size: number }
  | { type: 'dispatchEdict'; id: number; option?: number }
  | { type: 'setSalary'; level: number }
  | { type: 'holdFestival'; deity: number; size: number };

export function applyCommand(s: GameState, c: Command): void {
  switch (c.type) {
    case 'build': {
      if (c.kind === 'road') { placeRoad(s, c.x, c.y); break; }
      const t = BUILDING_KEYS.get(c.kind);
      if (t === undefined || t === BuildingType.None || t === BuildingType.Ruins) break;
      if (isDike(t)) planDike(s, t, c.x, c.y); // vẽ đoạn mới hoặc tôn cao đoạn có sẵn
      else placeBuilding(s, t, c.x, c.y);
      break;
    }
    case 'raze':
      raze(s, c.x, c.y);
      break;
    case 'setSpeed':
      s.speed = c.speed;
      break;
    case 'setTax':
      s.taxRate = Math.max(0, Math.min(25, Math.round(c.rate)));
      break;
    case 'setLaborPriority': {
      if (c.category < 0 || c.category >= LABOR_CATS || c.category === LaborCat.Corvee) break; // lao dịch không chỉnh được (M5)
      const p = Math.max(0, Math.min(9, Math.round(c.priority)));
      // mỗi mức ưu tiên chỉ một ngành, như Julius: ngành đang giữ mức này bị bỏ ưu tiên
      if (p > 0) for (let k = 0; k < LABOR_CATS; k++) if (s.labor.priority[k] === p) s.labor.priority[k] = 0;
      s.labor.priority[c.category] = p;
      break;
    }
    case 'setStorePolicy': {
      const b = s.buildings[c.buildingId];
      if (b && (b.type === BuildingType.Warehouse || b.type === BuildingType.Granary)) b.policy[c.resource] = c.policy;
      break;
    }
    case 'setStockpile':
      s.stockpile[c.resource] = c.on;
      break;
    case 'openSluice': {
      const b = s.buildings[c.buildingId];
      if (b && b.type === BuildingType.Sluice) setSluice(s, b, c.open);
      break;
    }
    case 'sendGift': { const why = sendGift(s, c.size); if (why) s.events.push(`Không tiến cống được: ${why}`); break; }
    case 'dispatchEdict': { const why = dispatchEdict(s, c.id, c.option ?? 0); if (why) s.events.push(`Chưa thi hành được: ${why}`); break; }
    case 'setSalary': setSalary(s, c.level); break;
    case 'holdFestival': { const why = holdFestival(s, c.deity, c.size); if (why) s.events.push(`Không mở lễ được: ${why}`); break; }
  }
}
