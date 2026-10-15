// QoL: lớp phủ thông tin trên bản đồ (như Caesar 3) và "công trình có vấn đề". Sim tính một mảng Uint8 mỗi ô cho chế độ đang bật;
// render tô theo giá trị: 0 không tô; 1–100 xấu (đỏ, càng cao càng đậm); 101–200 tốt (lục); 201 trung tính (vàng).
import { BuildingType, FOODS, isDike, isWall, Resource, type Building, type GameState } from './state';
import { BUILDING_DEFS, economy } from './buildings/defs';
import { GRID_SIZE, gridOffset, T_BUILDING, T_WATER } from './map/grid';
import { roadAccess } from './buildings/spawn';

export type OverlayMode = '' | 'flood' | 'problems' | 'water' | 'food' | 'fire' | 'damage' | 'crime' | 'desirability' | 'tax' | 'religion' | 'education' | 'health' | 'entertainment';
export const OVERLAY_MODES: { key: OverlayMode; name: string; hint: string }[] = [
  { key: '', name: 'Không', hint: '' },
  { key: 'problems', name: 'Có vấn đề', hint: 'Đỏ: công trình thiếu người làm, không kề đường, hết nguyên liệu, sắp cháy / sập, đang ngập' },
  { key: 'flood', name: 'Vùng ngập', hint: 'Xanh: bãi bồi lũ vừa sẽ ngập; lục: đã có đê che' },
  { key: 'water', name: 'Nước', hint: 'Nhà: đỏ không có nước, lục giếng, lục đậm giếng gạch; vàng: giếng' },
  { key: 'food', name: 'Lương thực', hint: 'Nhà: đỏ không có lương thực, lục có' },
  { key: 'fire', name: 'Cháy', hint: 'Càng đỏ càng dễ cháy (tuần đinh đi qua đặt lại 0)' },
  { key: 'damage', name: 'Sập', hint: 'Càng đỏ càng dễ sập (thợ cả đi qua đặt lại 0)' },
  { key: 'crime', name: 'Tội phạm', hint: 'Nhà: đỏ dân bất mãn (sinh trộm, loạn dân), lục yên' },
  { key: 'desirability', name: 'Độ hấp dẫn', hint: 'Đỏ: ô kém hấp dẫn (nhà không lên bậc); lục: hấp dẫn' },
  { key: 'tax', name: 'Thuế', hint: 'Nhà: đỏ lại thu thuế chưa tới, lục đã thu' },
  { key: 'religion', name: 'Tín ngưỡng', hint: 'Nhà: đỏ không được đình / chùa / miếu / đàn tế nào phủ; lục càng đậm càng nhiều' },
  { key: 'education', name: 'Học hành', hint: 'Nhà: đỏ không có thầy đồ / trường học, lục có' },
  { key: 'health', name: 'Y tế', hint: 'Nhà: đỏ không có thầy lang, lục có' },
  { key: 'entertainment', name: 'Giải trí', hint: 'Nhà: đỏ không có chèo / rối nước, lục có' },
];

const bad = (pct: number): number => Math.max(1, Math.min(100, Math.round(pct)));
const good = (pct: number): number => 100 + Math.max(1, Math.min(100, Math.round(pct)));
const NEUTRAL = 201;
const needsRoad = (t: BuildingType): boolean => !(t === BuildingType.Garden || t === BuildingType.LotusPond || t === BuildingType.Well || t === BuildingType.Ruins || isDike(t) || isWall(t) || t === BuildingType.Paddy || t === BuildingType.SaltPan);

/** Vì sao công trình có vấn đề (null = ổn). Dùng cho lớp phủ, biểu tượng báo và bảng chi tiết. */
export function buildingProblem(s: GameState, b: Building): string | null {
  if (b.type === BuildingType.None || b.type === BuildingType.Ruins || isDike(b.type) || isWall(b.type)) return null;
  const def = BUILDING_DEFS[b.type];
  if (b.flooded) return 'đang ngập';
  if (b.mothballed) return null;
  if (b.type === BuildingType.House) {
    if (b.population > 0 && b.hungryPeriods >= 2) return 'đói';
    return null;
  }
  if (needsRoad(b.type) && roadAccess(s.grid, b) < 0) return 'không kề đường';
  if (def.workers > 0) {
    if (b.housesCovered <= 0) return 'không có nhà ở gần để mộ phu';
    if (b.numWorkers === 0) return 'không có người làm';
    if (b.numWorkers * 2 < def.workers) return 'thiếu người làm';
  }
  if (def.input !== Resource.None && b.store[def.input] <= 0 && b.progress === 0) return 'hết nguyên liệu';
  if (b.fireRisk > economy.risk.fireThreshold * 0.8) return 'sắp cháy';
  if (b.damageRisk > economy.risk.collapseThreshold * 0.8) return 'sắp sập';
  return null;
}

/** Ô neo của mọi công trình có vấn đề (để vẽ biểu tượng báo). */
export function problemAnchors(s: GameState): Uint32Array {
  const out: number[] = [];
  for (const b of s.buildings) if (b.type !== BuildingType.None && buildingProblem(s, b)) out.push(gridOffset(b.x, b.y));
  return Uint32Array.from(out);
}

function fill(out: Uint8Array, b: Building, v: number): void {
  for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) out[gridOffset(b.x + dx, b.y + dy)] = v;
}

/** Tính lớp phủ `mode` vào `out` (GRID_SIZE² ô). 'flood' do render tô theo cờ địa hình nên không tính ở đây. */
export function computeOverlay(s: GameState, mode: OverlayMode, out: Uint8Array): void {
  out.fill(0);
  if (!mode || mode === 'flood') return;
  if (mode === 'desirability') {
    const g = s.grid;
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      if (g.terrain[i] & (T_WATER | T_BUILDING)) continue;
      const d = g.desirability[i];
      out[i] = d < 0 ? bad(-d * 4) : d > 0 ? good(d * 2) : 0;
    }
    return;
  }
  for (const b of s.buildings) {
    if (b.type === BuildingType.None) continue;
    const house = b.type === BuildingType.House && b.population > 0;
    let v = 0;
    switch (mode) {
      case 'problems': {
        if (b.type === BuildingType.Ruins || isDike(b.type) || isWall(b.type)) break;
        v = buildingProblem(s, b) ? bad(80) : b.type === BuildingType.House ? 0 : good(30);
        break;
      }
      case 'water':
        if (house) v = b.water === 0 ? bad(70) : b.water === 1 ? good(50) : good(100);
        else if (b.type === BuildingType.Well || b.type === BuildingType.BrickWell) v = NEUTRAL;
        break;
      case 'food':
        if (house) v = FOODS.some((r) => b.store[r] > 0) ? good(60) : bad(70);
        else if (b.type === BuildingType.Market || b.type === BuildingType.Granary) v = NEUTRAL;
        break;
      case 'fire':
        if (b.type !== BuildingType.Ruins && b.fireRisk > 0) v = bad((b.fireRisk * 100) / economy.risk.fireThreshold);
        break;
      case 'damage':
        if (b.type !== BuildingType.Ruins && b.damageRisk > 0) v = bad((b.damageRisk * 100) / economy.risk.collapseThreshold);
        break;
      case 'crime':
        if (house) v = b.happiness < 50 ? bad((50 - b.happiness) * 2) : good((b.happiness - 50) * 2);
        else if (b.type === BuildingType.WatchPost) v = NEUTRAL;
        break;
      case 'tax':
        if (house) v = b.taxCoverage > 0 ? good(60) : bad(60);
        else if (b.type === BuildingType.Yamen) v = NEUTRAL;
        break;
      case 'religion': {
        if (house) { const n = (b.dinh > 0 ? 1 : 0) + (b.temple > 0 ? 1 : 0) + (b.shrine > 0 ? 1 : 0) + (b.altar > 0 ? 1 : 0); v = n === 0 ? bad(70) : good(n * 25); }
        else if (b.type === BuildingType.Dinh || b.type === BuildingType.Temple || b.type === BuildingType.Shrine || b.type === BuildingType.Altar || b.type === BuildingType.VanMieu) v = NEUTRAL;
        break;
      }
      case 'education':
        if (house) v = b.school > 0 || b.academy > 0 ? good(b.academy > 0 ? 100 : 50) : bad(70);
        else if (b.type === BuildingType.School || b.type === BuildingType.Academy || b.type === BuildingType.QuocTuGiam) v = NEUTRAL;
        break;
      case 'health':
        if (house) v = b.clinic > 0 ? good(60) : bad(70);
        else if (b.type === BuildingType.Clinic) v = NEUTRAL;
        break;
      case 'entertainment':
        if (house) v = b.entertainment > 0 || b.puppet > 0 ? good(b.puppet > 0 ? 100 : 50) : bad(70);
        else if (b.type === BuildingType.Theater || b.type === BuildingType.PuppetStage) v = NEUTRAL;
        break;
    }
    if (v) fill(out, b, v);
  }
}
