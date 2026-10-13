// Sản xuất và sinh walker cho công trình — building/industry.c + building/figure.c của Julius.
//   nguyên liệu: progress += số nhân công mỗi ngày, đủ 200 → 1 kiện; ruộng lúa nhân hệ số mùa vụ
//   xưởng: chỉ chạy khi có ≥ 1 kiện nguyên liệu; đủ 400 → tiêu 1 kiện nguyên liệu, ra 1 kiện hàng
//   không sản xuất tiếp khi xe bò chưa về
import { BuildingType, FigureType, type Building, type GameState } from '../state';
import { BUILDING_DEFS, economy, isRawProducer, isWorkshop, spawnDelay, UNITS_PER_LOAD } from './defs';
import { roadAccess } from './spawn';
import { createFigure, removeFigure } from '../figures/figure';
import { startRoam } from '../figures/movement';
import { sendCart, planWarehouseman } from '../figures/cartpusher';
import { sendMarketBuyer } from '../figures/market';

const PADDY_SEASON: number[] = economy.paddySeason.byMonth;

export const pctWorkers = (b: Building): number => {
  const need = BUILDING_DEFS[b.type].workers;
  return need > 0 ? Math.floor((b.numWorkers * 100) / need) : 100;
};

/** Mỗi ngày (tick 8). */
export function updateProduction(s: GameState): void {
  for (const b of s.buildings) {
    const def = BUILDING_DEFS[b.type];
    if (!def || def.progressMax === 0 || b.figureId !== 0 || b.progress >= def.progressMax) continue;
    let gain = b.numWorkers;
    if (b.type === BuildingType.Paddy) gain *= PADDY_SEASON[s.time.month];
    if (isWorkshop(b.type)) {
      if (b.store[def.input] < UNITS_PER_LOAD) continue; // hết nguyên liệu
      b.progress = Math.min(def.progressMax, b.progress + gain);
      if (b.progress >= def.progressMax) b.store[def.input] -= UNITS_PER_LOAD;
    } else {
      b.progress = Math.min(def.progressMax, b.progress + gain);
    }
  }
}

/** Mỗi ngày (tick 12): mỗi công trình xét sinh walker — một walker mỗi slot tại một thời điểm, như Julius. */
export function generateFigures(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type === BuildingType.None || b.type === BuildingType.House || b.type === BuildingType.Ruins) continue;
    const def = BUILDING_DEFS[b.type];
    // bộ đếm giảm dần
    if (b.housesCovered > 0) b.housesCovered--;
    if (b.type === BuildingType.Market) for (let r = 0; r < b.demand.length; r++) if (b.demand[r] > 0) b.demand[r]--;

    const door = roadAccess(s.grid, b);
    if (door < 0) continue; // không có đường kề → không hoạt động

    // người mộ phu: công trình cần nhân công mà lâu không thấy nhà
    if (def.workers > 0 && b.laborSeekerId === 0 && b.housesCovered < economy.laborSeekerRespawnBelow && s.population > 0) {
      const f = createFigure(s, FigureType.LaborSeeker, door, b.id);
      if (f) { b.laborSeekerId = f.id; startRoam(f, economy.laborSeekerRoam); }
    }

    const pct = pctWorkers(b);

    // walker đi dạo (đình, chùa, chợ, điếm canh…)
    if (def.walker && b.figureId === 0) {
      const delay = def.workers > 0 ? spawnDelay(def.walker.delays, pct) : def.walker.delays[0];
      if (delay >= 0 && ++b.spawnCounter > delay) {
        b.spawnCounter = 0;
        const f = createFigure(s, def.walker.figure, door, b.id);
        if (f) { b.figureId = f.id; startRoam(f, def.walker.roam); }
      }
    }

    // xe bò: đủ một kiện → chở đi
    if ((isRawProducer(b.type) || isWorkshop(b.type)) && b.figureId === 0 && b.progress >= def.progressMax) {
      const f = createFigure(s, FigureType.CartPusher, door, b.id);
      if (f) {
        f.resource = def.produces;
        f.loads = 1;
        if (sendCart(s, f)) { b.figureId = f.id; b.progress = 0; }
        else removeFigure(s, f.id); // chưa ai nhận: hàng chờ tại chỗ
      }
    }

    // người gánh chợ
    if (b.type === BuildingType.Market && b.figureId2 === 0 && b.numWorkers > 0) {
      const f = createFigure(s, FigureType.MarketBuyer, door, b.id);
      if (f) {
        if (sendMarketBuyer(s, f)) b.figureId2 = f.id;
        else removeFigure(s, f.id);
      }
    }

    // phu kho
    if (b.type === BuildingType.Warehouse && b.figureId === 0 && b.numWorkers > 0) {
      const f = createFigure(s, FigureType.Warehouseman, door, b.id);
      if (f) {
        if (planWarehouseman(s, b, door, f)) b.figureId = f.id;
        else removeFigure(s, f.id);
      }
    }
  }
}
