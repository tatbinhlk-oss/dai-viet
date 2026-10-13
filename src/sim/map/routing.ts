// Tìm đường BFS trên lưới — tương đương map/routing.c của Julius (tính lazy khi cần).
// Hai chế độ: chỉ đi trên đường (walker có việc), hoặc đi trên đất (dân nhập cư).
import { GRID_CELLS, type Grid, isLand, isRoad, isWater, neighbors4 } from './grid';

export const UNREACHABLE = 0xffff;

export interface Routing {
  dist: Uint16Array; // khoảng cách từ nguồn, UNREACHABLE nếu không tới
  parent: Int32Array; // ô trước đó trên đường ngắn nhất
}

const queue = new Int32Array(GRID_CELLS);
const nb = new Int32Array(4);

/** BFS từ `from`; `passable(o)` quyết định ô đi được. Có thể dừng sớm khi tới `stopAt`. */
export function bfs(g: Grid, from: number, passable: (g: Grid, o: number) => boolean, stopAt = -1): Routing {
  const dist = new Uint16Array(GRID_CELLS).fill(UNREACHABLE);
  const parent = new Int32Array(GRID_CELLS).fill(-1);
  let head = 0, tail = 0;
  queue[tail++] = from;
  dist[from] = 0;
  while (head < tail) {
    const o = queue[head++];
    if (o === stopAt) break;
    neighbors4(o, nb);
    const d = dist[o] + 1;
    for (let k = 0; k < 4; k++) {
      const n = nb[k];
      if (n < 0 || dist[n] !== UNREACHABLE) continue;
      if (!passable(g, n)) continue;
      dist[n] = d;
      parent[n] = o;
      queue[tail++] = n;
    }
  }
  return { dist, parent };
}

/** Dựng đường đi từ nguồn tới `to` (không gồm nguồn, gồm đích). Rỗng nếu không tới. */
export function buildPath(r: Routing, to: number): Int32Array {
  if (r.dist[to] === UNREACHABLE) return new Int32Array(0);
  const path = new Int32Array(r.dist[to]);
  let o = to;
  for (let i = path.length - 1; i >= 0; i--) {
    path[i] = o;
    o = r.parent[o];
  }
  return path;
}

export const passRoad = isRoad;
/** Đất đi bộ được; cho phép bước vào ô đích dù là công trình (để tới cửa nhà). */
export const passLandTo = (target: number) => (g: Grid, o: number): boolean => o === target || isLand(g, o);
export const passLand = isLand;
/** Thuyền nan: chỉ đi trên ô sông (M4). */
export const passWater = isWater;

/** Đường ngắn nhất từ `from` đến `to` theo luật `passable`. */
export function findPath(g: Grid, from: number, to: number, passable: (g: Grid, o: number) => boolean): Int32Array {
  if (from === to) return new Int32Array(0);
  return buildPath(bfs(g, from, passable, to), to);
}
