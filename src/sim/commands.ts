// Lệnh từ UI vào sim. Đây là đường DUY NHẤT để thay đổi state từ ngoài, nên replay/undo làm được.
import { BuildingType, type GameState } from './state';
import { placeBuilding, placeRoad, raze } from './buildings/spawn';

export type Command =
  | { type: 'build'; kind: 'road' | 'house'; x: number; y: number }
  | { type: 'raze'; x: number; y: number }
  | { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 };

export function applyCommand(s: GameState, c: Command): void {
  switch (c.type) {
    case 'build':
      if (c.kind === 'road') placeRoad(s, c.x, c.y);
      else placeBuilding(s, BuildingType.HouseVacant, c.x, c.y, 1);
      break;
    case 'raze':
      raze(s, c.x, c.y);
      break;
    case 'setSpeed':
      s.speed = c.speed;
      break;
  }
}
