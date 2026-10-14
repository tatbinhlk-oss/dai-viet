// Lái buôn (M6a): đoàn buôn đi bộ từ cửa ngõ tới kho, thuyền buôn đi trên sông từ mép bản đồ tới bến cảng (mua bán với kho
// gần cảng nhất theo đường bộ); xong thì quay về mép và biến mất. Người ngoài: không cần đường.
import { BuildingType, FigureType, type Figure, type GameState } from '../state';
import { removeFigure } from './figure';
import { setWalkPath, step, StepResult } from './movement';
import { roadAccess } from '../buildings/spawn';
import { doTrade, nearestWarehouse, ROUTES } from '../city/trade';
import { RESOURCES } from '../buildings/defs';

function finish(s: GameState, f: Figure): void {
  const rs = s.trade.routes[f.route];
  if (rs && rs.traderId === f.id) rs.traderId = 0;
  removeFigure(s, f.id);
}

export function updateTrader(s: GameState, f: Figure): void {
  const r = step(s, f);
  if (r === StepResult.Moving || r === StepResult.ArrivedTile) return;
  if (f.returning || r === StepResult.Blocked) { finish(s, f); return; }
  const def = ROUTES[f.route];
  const dest = s.buildings[f.destBuildingId];
  let w = dest && dest.type === BuildingType.Warehouse ? dest : null;
  if (f.type === FigureType.TradeShip && dest && dest.type === BuildingType.Port) {
    const door = roadAccess(s.grid, dest);
    w = door >= 0 ? nearestWarehouse(s, door, true)?.b ?? null : null;
  }
  let sold = 0, bought = 0;
  if (w) [sold, bought] = doTrade(s, f.route, w, def.loadsPerTrip);
  if (f.type === FigureType.TradeShip) s.trade.shipsThisYear++; else s.trade.caravansThisYear++;
  const who = f.type === FigureType.TradeShip ? 'Thuyền buôn cập bến' : 'Đoàn buôn tới kho';
  s.events.push(w ? `${who}: bán ${sold}, mua ${bought} kiện` : `${who} nhưng không có kho để mua bán`);
  f.loads = bought; // chở hàng về (chỉ để nhìn)
  f.resource = 0;
  f.returning = true;
  if (!setWalkPath(s, f, f.boatHome, false)) finish(s, f);
}
export { RESOURCES };
