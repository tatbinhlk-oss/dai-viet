// Mảng figure cố định, tái dùng slot — như figure/figure.c của Julius.
import { FigureMode, FigureType, type Figure, type GameState } from '../state';
import { offsetX, offsetY } from '../map/grid';

export const MAX_FIGURES = 1000;

export function createFigure(s: GameState, type: FigureType, offset: number, buildingId: number): Figure | null {
  let id: number;
  if (s.freeFigures.length) id = s.freeFigures.pop()!;
  else if (s.figures.length < MAX_FIGURES) id = s.figures.length;
  else return null;
  const x = offsetX(offset), y = offsetY(offset);
  const f: Figure = {
    id, type, mode: FigureMode.Idle,
    x, y, nx: x, ny: y, progress: 0, prevOffset: -1,
    path: new Int32Array(0), pathIdx: 0,
    buildingId, destBuildingId: 0,
    roamLength: 0, maxRoamLength: 0, returning: false, loads: 0, waitTicks: 0,
  };
  s.figures[id] = f;
  return f;
}

export function removeFigure(s: GameState, id: number): void {
  const f = s.figures[id];
  if (!f || f.type === FigureType.None) return;
  const b = s.buildings[f.buildingId];
  if (b) {
    if (b.figureId === id) b.figureId = 0;
    if (b.figureId2 === id) b.figureId2 = 0;
  }
  f.type = FigureType.None;
  f.mode = FigureMode.Idle;
  s.freeFigures.push(id);
}
