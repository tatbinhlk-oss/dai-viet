// Bản đồ chia chunk 16×16 ô. Mỗi chunk một Graphics, chỉ vẽ lại khi có ô trong chunk đổi.
// M2 vẫn vẽ bằng Graphics phẳng (placeholder); M4 thay bằng sprite từ spritesheet, cùng điểm neo.
import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE, T_BUILDING, T_FLOODPLAIN, T_ROAD, T_TREE, T_WATER } from '../sim/map/grid';
import { BuildingType } from '../sim/state';
import { HALF_H, HALF_W, tileToWorld, TILE_H } from './iso';

export const CHUNK = 16;
const CHUNKS_PER_SIDE = GRID_SIZE / CHUNK;

const COLOR = {
  grass: [0x6f8f3a, 0x76963f, 0x6a8a37, 0x7a9a44, 0x80a04a], // theo elevation 0..4
  floodplain: 0x8fa85a,
  water: 0x3b6e9c,
  road: 0xb89a62,
  tree: 0x3f6a2a,
};

// màu khối theo loại công trình: [mặt trái, mặt phải, mái]; nhà theo bậc 0..5
const HOUSE_COLORS: [number, number, number][] = [
  [0x8a8a7a, 0x6e6e60, 0xa8a898], // lều trống: xám
  [0x9c6b3c, 0x7d5530, 0xc9a06a], // lều tranh
  [0xa0743f, 0x80592f, 0xd8b06a], // nhà tranh
  [0xa66a3a, 0x85522c, 0xc98a4a], // nhà đất
  [0x8f5a2a, 0x70451f, 0xb08050], // nhà gỗ
  [0xb0553a, 0x8a3f2a, 0x7a3b2a], // nhà gạch: ngói đỏ
];
const TYPE_COLORS: Record<number, [number, number, number]> = {
  [BuildingType.Paddy]: [0x5f8f3a, 0x4f7a2e, 0x9bc45a],
  [BuildingType.Granary]: [0xb59a5a, 0x8f7a45, 0xd9c080],
  [BuildingType.Market]: [0xc08a4a, 0x9a6b35, 0xe8c070],
  [BuildingType.Well]: [0x777, 0x555, 0x4aa0d0],
  [BuildingType.Dinh]: [0x8a4a3a, 0x6a3428, 0x5a3a2a],
};
const TYPE_HEIGHT: Record<number, number> = {
  [BuildingType.House]: 14, [BuildingType.Paddy]: 2, [BuildingType.Granary]: 26, [BuildingType.Market]: 16, [BuildingType.Well]: 8, [BuildingType.Dinh]: 24,
};
const TYPE_SIZE: Record<number, number> = {
  [BuildingType.House]: 1, [BuildingType.Paddy]: 2, [BuildingType.Granary]: 3, [BuildingType.Market]: 2, [BuildingType.Well]: 1, [BuildingType.Dinh]: 2,
};

export class ChunkLayer {
  readonly container = new Container();
  private readonly ground: Graphics[] = [];
  private readonly objects: Graphics[] = [];
  private readonly dirty = new Set<number>();
  private terrain: Uint16Array = new Uint16Array(GRID_SIZE * GRID_SIZE);
  private elevation: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);
  private bType: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);
  private bLevel: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);

  constructor() {
    this.container.sortableChildren = true;
    for (let cy = 0; cy < CHUNKS_PER_SIDE; cy++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const g = new Graphics();
        const o = new Graphics();
        g.zIndex = (cx + cy) * 2;
        o.zIndex = (cx + cy) * 2 + 1;
        this.ground.push(g);
        this.objects.push(o);
        this.container.addChild(g, o);
      }
    }
  }

  setFull(terrain: Uint16Array, elevation: Uint8Array, bType: Uint8Array, bLevel: Uint8Array): void {
    this.terrain = terrain; this.elevation = elevation; this.bType = bType; this.bLevel = bLevel;
    for (let i = 0; i < this.ground.length; i++) this.dirty.add(i);
  }

  applyChanges(offsets: Uint32Array, terrain: Uint16Array, bType: Uint8Array, bLevel: Uint8Array): void {
    for (let k = 0; k < offsets.length; k++) {
      const o = offsets[k];
      this.terrain[o] = terrain[k]; this.bType[o] = bType[k]; this.bLevel[o] = bLevel[k];
      const x = o % GRID_SIZE, y = (o / GRID_SIZE) | 0;
      // công trình lớn có thể vắt qua chunk lân cận: đánh bẩn cả 3×3 chunk quanh
      const cx = (x / CHUNK) | 0, cy = (y / CHUNK) | 0;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const ax = cx + dx, ay = cy + dy;
        if (ax >= 0 && ay >= 0) this.dirty.add(ay * CHUNKS_PER_SIDE + ax);
      }
    }
  }

  /** Công trình tại ô (tìm ô neo trong vùng 3×3 phía dưới-phải vì bType chỉ ghi ở neo). */
  buildingAt(x: number, y: number): { type: number; level: number } | null {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null;
    if (!(this.terrain[y * GRID_SIZE + x] & T_BUILDING)) return null;
    for (let d = 0; d < 3; d++) {
      for (let dy = 0; dy <= d; dy++) {
        for (let dx = 0; dx <= d; dx++) {
          const ax = x + dx, ay = y + dy;
          if (ax >= GRID_SIZE || ay >= GRID_SIZE) continue;
          const i = ay * GRID_SIZE + ax;
          const t = this.bType[i];
          if (t && (TYPE_SIZE[t] ?? 1) > Math.max(dx, dy)) return { type: t, level: this.bLevel[i] };
        }
      }
    }
    return null;
  }

  /** Vẽ lại các chunk bẩn. Gọi mỗi frame; thường là 0 việc. */
  flush(): void {
    for (const c of this.dirty) this.redraw(c);
    this.dirty.clear();
  }

  private redraw(c: number): void {
    const cx = c % CHUNKS_PER_SIDE, cy = (c / CHUNKS_PER_SIDE) | 0;
    const g = this.ground[c].clear();
    const o = this.objects[c].clear();
    // Duyệt theo x+y tăng dần để thứ tự vẽ đúng ngay cả trong một Graphics
    for (let s = 0; s < CHUNK * 2 - 1; s++) {
      for (let dx = Math.max(0, s - CHUNK + 1); dx <= Math.min(CHUNK - 1, s); dx++) {
        const dy = s - dx;
        const x = cx * CHUNK + dx, y = cy * CHUNK + dy;
        const i = y * GRID_SIZE + x;
        const t = this.terrain[i];
        const { wx, wy } = tileToWorld(x, y);
        let fill: number;
        if (t & T_WATER) fill = COLOR.water;
        else if (t & T_ROAD) fill = COLOR.road;
        else if (t & T_BUILDING) fill = 0x55503a;
        else if (t & T_FLOODPLAIN) fill = COLOR.floodplain;
        else fill = COLOR.grass[this.elevation[i]] ?? COLOR.grass[0];
        diamond(g, wx, wy, fill);
        if (t & T_ROAD) g.stroke({ color: 0x8a7046, width: 1 });
        if (t & T_TREE) o.circle(wx, wy + HALF_H - 6, 7).fill(COLOR.tree);
        const bt = this.bType[i];
        if (bt) this.drawBuilding(o, x, y, bt, this.bLevel[i]);
      }
    }
  }

  /** Vẽ khối N×N với ô neo (x, y) = góc dưới móng. Điểm neo đúng như buildingAnchor() trong iso.ts. */
  private drawBuilding(o: Graphics, ax: number, ay: number, type: number, level: number): void {
    const n = TYPE_SIZE[type] ?? 1;
    const h = TYPE_HEIGHT[type] ?? 10;
    const col = type === BuildingType.House ? HOUSE_COLORS[level] ?? HOUSE_COLORS[0] : TYPE_COLORS[type] ?? HOUSE_COLORS[0];
    const x0 = ax - n + 1, y0 = ay - n + 1;
    // 4 đỉnh hình thoi móng: trên (x0,y0), phải (ax, y0), dưới (ax, ay), trái (x0, ay)
    const top = tileToWorld(x0, y0);
    const right = tileToWorld(ax, y0);
    const bottom = tileToWorld(ax, ay);
    const left = tileToWorld(x0, ay);
    const T = { x: top.wx, y: top.wy }, R = { x: right.wx + HALF_W, y: right.wy + HALF_H };
    const B = { x: bottom.wx, y: bottom.wy + TILE_H }, L = { x: left.wx - HALF_W, y: left.wy + HALF_H };
    // mặt trái: L→B, nâng cao h
    o.poly([L.x, L.y, L.x, L.y - h, B.x, B.y - h, B.x, B.y]).fill(col[0]);
    // mặt phải: B→R
    o.poly([B.x, B.y, B.x, B.y - h, R.x, R.y - h, R.x, R.y]).fill(col[1]);
    // mái
    o.poly([T.x, T.y - h, R.x, R.y - h, B.x, B.y - h, L.x, L.y - h]).fill(col[2]);
  }
}

function diamond(g: Graphics, wx: number, wy: number, color: number): void {
  // Hình thoi với tâm trên tại (wx, wy): đỉnh trên wy, trái/phải wy+HALF_H, dưới wy+TILE_H
  g.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).fill(color);
}
