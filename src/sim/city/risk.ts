// Cháy và sập — building/maintenance.c của Julius.
// Mỗi ngày: damage_risk += damage (+2 khi trúng 1/8), sập khi > 200; fire_risk += fire khi trúng 1/8, cháy khi > 100.
// Tuần đinh / thợ cả đi qua đặt lại 0. Đống tro cháy 12 ngày, có thể lan sang công trình kề.
import { BuildingType, type Building, type GameState } from '../state';
import { logEvent } from '../log';
import { gridOffset, inBounds } from '../map/grid';
import { BUILDING_DEFS, economy, HOUSE_LEVELS } from '../buildings/defs';
import { burnBuilding, collapseBuilding, removeBuilding, ruinStage, RuinStage, setRuinStage } from '../buildings/spawn';
import { nextInt } from '../rng';

const R = economy.risk;

function label(b: Building): string {
  return b.type === BuildingType.House ? HOUSE_LEVELS[b.level].name : BUILDING_DEFS[b.type].name;
}

/** Mỗi ngày (tick 43). */
export function updateRisks(s: GameState): void {
  const n = s.buildings.length; // công trình mới sinh trong vòng lặp không xét
  for (let i = 1; i < n; i++) {
    const b = s.buildings[i];
    if (b.type === BuildingType.None) continue;
    if (b.type === BuildingType.Ruins) { updateRuins(s, b); continue; }
    const def = BUILDING_DEFS[b.type];
    const fire = b.type === BuildingType.House ? HOUSE_LEVELS[b.level].fire : def.fire;
    if (fire > 0 && nextInt(s.rng, 8) === 0) b.fireRisk += fire;
    if (def.damage > 0) b.damageRisk += def.damage + (nextInt(s.rng, 8) === 0 ? 2 : 0);
    if (b.fireRisk > R.fireThreshold) {
      logEvent(s, `Cháy: ${label(b)}`, gridOffset(b.x, b.y));
      burnBuilding(s, b, R.burnDays);
    } else if (b.damageRisk > R.collapseThreshold) {
      logEvent(s, `Sập: ${label(b)}`, gridOffset(b.x, b.y));
      collapseBuilding(s, b, R.collapseDays);
    }
  }
}

function updateRuins(s: GameState, b: Building): void {
  const stage = ruinStage(s.grid.bLevel[gridOffset(b.x + b.size - 1, b.y + b.size - 1)]);
  if (stage === RuinStage.Burning && b.burnDays <= R.burnDays / 2) setRuinStage(s, b, RuinStage.Ash); // nửa sau: lửa tắt, còn tro
  if (stage === RuinStage.Burning && nextInt(s.rng, 16) < R.spreadChancePer16) {
    // lan sang một ô kề ngẫu nhiên
    const side = nextInt(s.rng, 4);
    const k = nextInt(s.rng, b.size);
    const [x, y] = side === 0 ? [b.x + k, b.y - 1] : side === 1 ? [b.x + b.size, b.y + k] : side === 2 ? [b.x + k, b.y + b.size] : [b.x - 1, b.y + k];
    if (inBounds(x, y)) {
      const t = s.buildings[s.grid.buildingId[gridOffset(x, y)]];
      // công trình không bắt lửa (giếng, vườn, ao) không cháy lan
      if (t && t.id && t.type !== BuildingType.Ruins && t.type !== BuildingType.None && (t.type === BuildingType.House || BUILDING_DEFS[t.type].fire > 0)) t.fireRisk += R.spreadAmount;
    }
  }
  if (--b.burnDays <= 0) removeBuilding(s, b);
}
