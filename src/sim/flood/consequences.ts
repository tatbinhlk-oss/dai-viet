// Hậu quả ngập theo loại ô — bảng thiết kế phần 5. Áp MỘT LẦN khi công trình chuyển từ khô sang ngập;
// khi còn ngập: không sản xuất, không sinh walker (industry.ts kiểm tra b.flooded).
import { BuildingType, FOODS, isDike, type Building, type GameState } from '../state';
import { gridOffset, T_FLOODED } from '../map/grid';
import { BUILDING_DEFS, court, flood, HOUSE_LEVELS } from '../buildings/defs';
import { removeBuilding, setHouseLevel } from '../buildings/spawn';
import { spawnEmigrants } from '../figures/migrant';

const C = flood.consequences;

const anyTileFlooded = (s: GameState, b: Building): boolean => {
  for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) if (s.grid.terrain[gridOffset(b.x + dx, b.y + dy)] & T_FLOODED) return true;
  return false;
};

/** Sau flood-fill mỗi ngày: xét chuyển trạng thái ngập của từng công trình. Trả số công trình mới ngập. */
export function updateFloodedBuildings(s: GameState): number {
  let newly = 0;
  const n = s.buildings.length;
  for (let i = 1; i < n; i++) {
    const b = s.buildings[i];
    if (b.type === BuildingType.None || isDike(b.type)) continue;
    const now = anyTileFlooded(s, b);
    if (now === b.flooded) continue;
    b.flooded = now;
    if (now) { newly++; onFlooded(s, b); } else onDried(s, b);
  }
  return newly;
}

function onFlooded(s: GameState, b: Building): void {
  const def = BUILDING_DEFS[b.type];
  switch (b.type) {
    case BuildingType.House: {
      // lều (bậc ≤ 1) bị xóa; nhà khác tụt 1 bậc ngay, 50% dân bỏ đi, lòng dân −3/kỳ trong 3 tháng
      if (b.population > 0) s.ratings.floodedHousesThisYear++; // M5: Thịnh vượng −2
      if (b.level <= 1) {
        const pop = b.population;
        b.population = 0;
        if (pop > 0) spawnEmigrants(s, b, pop);
        removeBuilding(s, b);
        return;
      }
      setHouseLevel(s, b, b.level - 1);
      const leave = Math.min(b.population, Math.ceil((b.population * C.houseLeavePct) / 100));
      b.population -= leave;
      const cap = HOUSE_LEVELS[b.level].capacity;
      if (b.population > cap) b.population = cap;
      if (leave > 0) spawnEmigrants(s, b, leave);
      b.floodMoodPeriods = C.houseMoodPeriods;
      if (b.population === 0) setHouseLevel(s, b, 0);
      return;
    }
    case BuildingType.Paddy:
      b.progress = 0;
      b.floodedThisSeason = true;
      s.ratings.paddiesFloodedThisYear++; // M5: Thịnh vượng (mất mùa do lũ)
      return;
    case BuildingType.Granary:
      for (const r of FOODS) b.store[r] = Math.floor((b.store[r] * (100 - C.granaryLossPct)) / 100);
      return;
    case BuildingType.Well:
    case BuildingType.BrickWell:
      b.pollutedDays = C.wellPollutedDays;
      s.ratings.floodedWellMonths = court.health.floodedWellMonths; // M5: tăng xác suất dịch 2 tháng
      return;
    default:
      // xưởng, kho, chợ, nguyên liệu khác: mất toàn bộ hàng, tiến độ về 0; ngừng tới khi nước rút
      if (def.produces || def.input || b.type === BuildingType.Warehouse || b.type === BuildingType.Market) {
        b.store.fill(0);
        b.progress = 0;
      }
  }
}

function onDried(_s: GameState, _b: Building): void {
  // phù sa ghi nhận ở cuối mùa lũ (endOfSeason) để "tiến độ × 1,5 trong năm sau" áp trọn một năm canh tác
}

/** Hệ số sản lượng ruộng lúa: phù sa × 1,5; không ngập lâu năm thì bạc màu. */
export function paddyYield(b: Building): number {
  if (b.silted) return C.siltMultiplier;
  const steps = Math.floor(b.dryYears / C.fallowYears);
  return Math.max(C.fallowMinPct, 100 - steps * C.fallowPenaltyPct) / 100;
}

/** Cuối mùa lũ (ngày 1 tháng 10): ruộng ngập mùa này được phù sa, ruộng không ngập thêm một năm khô. */
export function endOfSeason(s: GameState): { silted: number } {
  let silted = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Paddy) continue;
    if (b.floodedThisSeason) { b.silted = true; b.dryYears = 0; silted++; }
    else { b.silted = false; b.dryYears++; }
    b.floodedThisSeason = false;
  }
  return { silted };
}
