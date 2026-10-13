// Ruộng lúa, vựa, chợ và việc sinh walker cho công trình — building/industry.c + building/figure.c của Julius.
import { BuildingType, FigureType, type GameState } from '../state';
import { BUILDING_DEFS, FOOD_PER_LOAD, MARKET_REORDER_BELOW, PADDY_MAX_PROGRESS, PADDY_PROGRESS_PER_DAY, SPAWN_DELAY_DAYS } from './defs';
import { roadAccess } from './spawn';
import { createFigure, removeFigure, sendBuyerToGranary, sendCartToGranary, startRoam } from '../figures/behaviors';

/** Mỗi ngày (tick 8): ruộng lớn lên. M3 nhân với % nhân công. */
export function updateProduction(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== BuildingType.Paddy) continue;
    if (b.progress < PADDY_MAX_PROGRESS) b.progress = Math.min(PADDY_MAX_PROGRESS, b.progress + PADDY_PROGRESS_PER_DAY);
  }
}

/** Mỗi ngày (tick 12): mỗi công trình xét sinh walker — một walker mỗi loại tại một thời điểm, như Julius. */
export function generateFigures(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type === BuildingType.None) continue;
    const door = roadAccess(s.grid, b);
    if (door < 0) continue; // không có đường kề → không hoạt động
    const def = BUILDING_DEFS[b.type];

    // roamer (đình, chợ)
    if (def.spawnsRoamer && b.figureId === 0) {
      if (++b.spawnCounter > SPAWN_DELAY_DAYS) {
        b.spawnCounter = 0;
        const type = b.type === BuildingType.Dinh ? FigureType.DinhRoamer : FigureType.MarketTrader;
        const f = createFigure(s, type, door, b.id);
        if (f) { b.figureId = f.id; startRoam(f, def.maxRoam); }
      }
    }

    // xe bò: ruộng đầy → chở 1 kiện tới vựa
    if (b.type === BuildingType.Paddy && b.figureId === 0 && b.progress >= PADDY_MAX_PROGRESS) {
      const f = createFigure(s, FigureType.CartPusher, door, b.id);
      if (f) {
        f.loads = 1;
        if (sendCartToGranary(s, f)) { b.figureId = f.id; b.progress = 0; }
        else removeFigure(s, f.id); // chưa có vựa: lúa chờ trên ruộng
      }
    }

    // người gánh chợ: chợ sắp hết hàng → đi vựa
    if (b.type === BuildingType.Market && b.figureId2 === 0 && b.stock < MARKET_REORDER_BELOW) {
      const f = createFigure(s, FigureType.MarketBuyer, door, b.id);
      if (f) {
        if (sendBuyerToGranary(s, f)) b.figureId2 = f.id;
        else removeFigure(s, f.id);
      }
    }
  }
}

export const loadsOf = (units: number): number => Math.floor(units / FOOD_PER_LOAD);
