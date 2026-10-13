// Bản đồ chia chunk 16×16 ô. Mỗi chunk một Graphics, chỉ vẽ lại khi có ô trong chunk đổi.
// M1 vẽ bằng Graphics phẳng (placeholder); M2+ thay bằng sprite từ spritesheet, cùng điểm neo.
import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE, T_BUILDING, T_FLOODPLAIN, T_ROAD, T_TREE, T_WATER } from '../sim/map/grid';
import { HALF_H, HALF_W, tileToWorld, TILE_H } from './iso';

export const CHUNK = 16;
const CHUNKS_PER_SIDE = GRID_SIZE / CHUNK;

const COLOR = {
  grass: [0x6f8f3a, 0x76963f, 0x6a8a37, 0x7a9a44, 0x80a04a], // theo elevation 0..4
  floodplain: 0x8fa85a,
  water: 0x3b6e9c,
  road: 0xb89a62,
  tree: 0x3f6a2a,
  house: 0x9c6b3c,
  houseRoof: 0xc9a06a,
};

export class ChunkLayer {
  readonly container = new Container();
  private readonly ground: Graphics[] = [];
  private readonly objects: Graphics[] = [];
  private readonly dirty = new Set<number>();
  private terrain: Uint16Array = new Uint16Array(GRID_SIZE * GRID_SIZE);
  private elevation: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);

  constructor() {
    this.container.sortableChildren = true;
    for (let cy = 0; cy < CHUNKS_PER_SIDE; cy++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const g = new Graphics();
        const o = new Graphics();
        // Thứ tự chunk theo x+y; trong chunk, đối tượng vẽ theo x+y tăng dần nên chồng đúng.
        g.zIndex = (cx + cy) * 2;
        o.zIndex = (cx + cy) * 2 + 1;
        this.ground.push(g);
        this.objects.push(o);
        this.container.addChild(g, o);
      }
    }
  }

  setFull(terrain: Uint16Array, elevation: Uint8Array): void {
    this.terrain = terrain;
    this.elevation = elevation;
    for (let i = 0; i < this.ground.length; i++) this.dirty.add(i);
  }

  applyChanges(offsets: Uint32Array, terrain: Uint16Array): void {
    for (let k = 0; k < offsets.length; k++) {
      const o = offsets[k];
      this.terrain[o] = terrain[k];
      const x = o % GRID_SIZE, y = (o / GRID_SIZE) | 0;
      this.dirty.add(((y / CHUNK) | 0) * CHUNKS_PER_SIDE + ((x / CHUNK) | 0));
    }
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
        else if (t & T_FLOODPLAIN) fill = COLOR.floodplain;
        else fill = COLOR.grass[this.elevation[i]] ?? COLOR.grass[0];
        diamond(g, wx, wy, fill);
        if (t & T_ROAD) g.stroke({ color: 0x8a7046, width: 1 });
        if (t & T_TREE) {
          o.circle(wx, wy + HALF_H - 6, 7).fill(COLOR.tree);
        }
        if (t & T_BUILDING) {
          // Lều tranh 1×1: khối nổi cao 14 px trên móng, neo ở góc dưới hình thoi.
          const h = 14;
          const bx = wx, by = wy + HALF_H; // điểm neo = góc dưới
          o.poly([bx - HALF_W, by - HALF_H, bx - HALF_W, by - HALF_H - h, bx, by - h, bx, by]).fill(COLOR.house);
          o.poly([bx, by, bx, by - h, bx + HALF_W, by - HALF_H - h, bx + HALF_W, by - HALF_H]).fill(0x7d5530);
          o.poly([bx - HALF_W, by - HALF_H - h, bx, by - TILE_H - h, bx + HALF_W, by - HALF_H - h, bx, by - h]).fill(COLOR.houseRoof);
        }
      }
    }
  }
}

function diamond(g: Graphics, wx: number, wy: number, color: number): void {
  // Hình thoi với tâm trên tại (wx, wy): đỉnh trên wy, trái/phải wy+HALF_H, dưới wy+TILE_H
  g.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).fill(color);
}
