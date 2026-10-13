// Bộ phân phối: mỗi tick cập nhật mọi walker theo loại.
import { FigureType, type GameState } from '../state';
import { updateBoatFigure, updateCartPusher, updateWarehouseman } from './cartpusher';
import { updateMarketBuyer } from './market';
import { updateEmigrant, updateImmigrant } from './migrant';
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
      case FigureType.Emigrant: updateEmigrant(s, f); break;
      case FigureType.LevyWorker: updateLevyWorker(s, f); break;
      case FigureType.Boat: updateBoatFigure(s, f); break;
      default: updateRoamer(s, f); break; // mọi loại đi dạo
    }
  }
}
