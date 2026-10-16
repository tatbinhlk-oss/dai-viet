// Bộ phân phối: mỗi tick cập nhật mọi walker theo loại.
import { FigureType, type GameState } from '../state';
import { updateBoatFigure, updateCartPusher, updateWarehouseman } from './cartpusher';
import { updateTrader } from './trader';
import { updateCorpse, updateEnemy, updateSoldier } from './enemy';
import { updateMarketBuyer } from './market';
import { updateEmigrant, updateImmigrant, updateMessenger } from './migrant';
import { updateRoamer } from './service';
import { updateLevyWorker } from './levyWorker';

export function updateFigures(s: GameState): void {
  for (let i = 1; i < s.figures.length; i++) {
    const f = s.figures[i];
    switch (f.type) {
      case FigureType.None: break;
      case FigureType.MarketBuyer: updateMarketBuyer(s, f); break;
      case FigureType.CartPusher: updateCartPusher(s, f); break;
      case FigureType.Warehouseman: updateWarehouseman(s, f); break;
      case FigureType.Immigrant: updateImmigrant(s, f); break;
      case FigureType.Emigrant: case FigureType.Convoy: case FigureType.Soldiers: updateEmigrant(s, f); break; // đi ra cửa ngõ rồi biến mất
      case FigureType.Messenger: updateMessenger(s, f); break;
      case FigureType.Caravan: case FigureType.TradeShip: updateTrader(s, f); break;
      case FigureType.Enemy: case FigureType.CourtTroops: updateEnemy(s, f); break;
      case FigureType.Militia: case FigureType.Archer: case FigureType.Elephant: updateSoldier(s, f); break; // M8: đội quân
      case FigureType.Corpse: updateCorpse(s, f); break;
      case FigureType.LevyWorker: updateLevyWorker(s, f); break;
      case FigureType.Boat: updateBoatFigure(s, f); break;
      default: updateRoamer(s, f); break; // mọi loại đi dạo
    }
  }
}
