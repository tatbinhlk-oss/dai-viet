// Walker đi dạo (roamer): dịch vụ, người mộ phu, tuần đinh, thợ cả, lại thu thuế, tội phạm.
// Mỗi ô đặt chân lên, tác dụng phủ 5×5 quanh mình — figuretype/service.c của Julius.
import { BuildingType, FigureType, isDike, type Building, type Figure, type GameState } from '../state';
import { logEvent } from '../log';
import { gridOffset, inBounds } from '../map/grid';
import { economy, flood, SERVICE_MAX, SERVICE_RANGE } from '../buildings/defs';
import { removeBuilding, roadAccess } from '../buildings/spawn';
import { nextInt } from '../rng';
import { removeFigure } from './figure';
import { setWalkPath, startRoam, step, StepResult } from './movement';
import { serveHouseFromMarket } from './market';

/** Duyệt mọi công trình trong 5×5 quanh walker (mỗi công trình một lần). */
function forBuildingsAround(s: GameState, f: Figure, range: number, fn: (b: Building) => void): void {
  const seen: number[] = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const x = f.x + dx, y = f.y + dy;
      if (!inBounds(x, y)) continue;
      const id = s.grid.buildingId[gridOffset(x, y)];
      if (!id || seen.includes(id)) continue;
      seen.push(id);
      fn(s.buildings[id]);
    }
  }
}

function forHousesAround(s: GameState, f: Figure, fn: (b: Building) => void): void {
  forBuildingsAround(s, f, SERVICE_RANGE, (b) => { if (b.type === BuildingType.House && b.population > 0) fn(b); });
}

const isCriminal = (t: FigureType) => t === FigureType.Protester || t === FigureType.Thief || t === FigureType.Rioter;

/** Tác dụng khi walker đặt chân lên ô mới. */
function applyService(s: GameState, f: Figure): void {
  switch (f.type) {
    case FigureType.DinhRoamer: forHousesAround(s, f, (b) => { b.dinh = SERVICE_MAX; }); break;
    case FigureType.Monk: forHousesAround(s, f, (b) => { b.temple = SERVICE_MAX; }); break;
    case FigureType.Teacher: forHousesAround(s, f, (b) => { b.school = SERVICE_MAX; }); break;
    case FigureType.Healer: forHousesAround(s, f, (b) => { b.clinic = SERVICE_MAX; }); break;
    case FigureType.Actor: forHousesAround(s, f, (b) => { b.entertainment = SERVICE_MAX; }); break;
    // M5
    case FigureType.Academic: forHousesAround(s, f, (b) => { b.academy = SERVICE_MAX; }); break;
    case FigureType.Puppeteer: forHousesAround(s, f, (b) => { b.entertainment = SERVICE_MAX; b.puppet = SERVICE_MAX; }); break;
    case FigureType.TempleKeeper: {
      const home = s.buildings[f.buildingId];
      const altar = home.type === BuildingType.Altar;
      forHousesAround(s, f, (b) => { if (altar) b.altar = SERVICE_MAX; else b.shrine = SERVICE_MAX; });
      break;
    }
    case FigureType.Mandarin: {
      // quan đi kiệu: +1 độ hấp dẫn tạm thời (8 ngày) trong 3×3 quanh đường đi
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = f.x + dx, y = f.y + dy;
        if (inBounds(x, y)) s.grid.prestige[gridOffset(x, y)] = 8;
      }
      break;
    }
    case FigureType.TaxCollector: forHousesAround(s, f, (b) => { b.taxCoverage = economy.taxCoverageDays; }); break;
    case FigureType.MarketTrader: {
      const m = s.buildings[f.buildingId];
      if (m.type === BuildingType.Market) forHousesAround(s, f, (b) => serveHouseFromMarket(m, b));
      break;
    }
    case FigureType.LaborSeeker: {
      let found = false;
      forHousesAround(s, f, () => { found = true; });
      if (found) s.buildings[f.buildingId].housesCovered = economy.laborAccessDays;
      break;
    }
    case FigureType.Builder: forBuildingsAround(s, f, SERVICE_RANGE, (b) => { b.damageRisk = 0; if (isDike(b.type) && b.height > 0) b.integrity = flood.dike.integrityMax; }); break; // M4: thợ cả kiểm tra đê
    case FigureType.Watchman: {
      forBuildingsAround(s, f, SERVICE_RANGE, (b) => {
        if (b.type === BuildingType.Ruins) removeBuilding(s, b); // dập lửa
        else b.fireRisk = 0;
      });
      // bắt tội phạm trong tầm
      const R = economy.crime.catchRange;
      for (const c of s.figures) {
        if (!isCriminal(c.type)) continue;
        if (Math.abs(c.x - f.x) <= R && Math.abs(c.y - f.y) <= R) {
          logEvent(s, c.type === FigureType.Thief ? 'Tuần đinh bắt được trộm' : c.type === FigureType.Rioter ? 'Tuần đinh dẹp loạn dân' : 'Tuần đinh giải tán dân kêu oan');
          removeFigure(s, c.id);
        }
      }
      break;
    }
    case FigureType.Rioter: {
      // loạn dân: 1/4 khả năng đốt một công trình (không phải nhà) kề bên
      if (nextInt(s.rng, 4) !== 0) break;
      forBuildingsAround(s, f, 1, (b) => {
        if (b.type !== BuildingType.House && b.type !== BuildingType.Ruins && b.type !== BuildingType.None && b.fireRisk <= economy.risk.fireThreshold) {
          b.fireRisk = economy.risk.fireThreshold + 1;
          if (b.type !== BuildingType.WatchPost) s.ratings.destroyedThisYear++; // M5: Trị an −1 mỗi công trình bị phá (không tính lều, điếm canh)
        }
      });
      break;
    }
    default: break;
  }
}

/** Trộm hết đường: lấy một phần ngân khố rồi biến mất. */
function finishCriminal(s: GameState, f: Figure): void {
  if (f.type === FigureType.Thief) {
    const amount = Math.min(economy.crime.thiefStealMax, Math.floor((s.treasury * economy.crime.thiefStealPct) / 100));
    if (amount > 0) {
      s.treasury -= amount;
      s.thisYear.stolen += amount;
      logEvent(s, `Trộm lấy ${amount} quan`);
    }
  }
  removeFigure(s, f.id);
}

export function updateRoamer(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.ArrivedTile) {
    applyService(s, f);
    return;
  }
  if (r === StepResult.RoamDone) {
    if (isCriminal(f.type)) { finishCriminal(s, f); return; }
    const home = s.buildings[f.buildingId];
    const door = home.type !== BuildingType.None ? roadAccess(s.grid, home) : -1;
    f.returning = true;
    if (door < 0 || !setWalkPath(s, f, door, true)) removeFigure(s, f.id);
    return;
  }
  if (r === StepResult.PathDone || r === StepResult.Blocked) {
    if (f.returning || isCriminal(f.type)) removeFigure(s, f.id);
    else startRoam(f, f.maxRoamLength);
  }
}

