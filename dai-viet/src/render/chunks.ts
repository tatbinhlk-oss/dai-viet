// Bản đồ chia chunk 16×16 ô. Mỗi chunk một Graphics, chỉ vẽ lại khi có ô trong chunk đổi.
// Vẫn vẽ khối Graphics phẳng (placeholder); sau thay bằng sprite từ spritesheet, cùng điểm neo.
import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE, T_BUILDING, T_FLOODPLAIN, T_ROAD, T_TREE, T_WATER } from '../sim/map/grid';
import { BuildingType } from '../sim/state';
import { BUILDING_DEFS } from '../sim/buildings/defs';
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

// màu khối placeholder: [mặt trái, mặt phải, mái]. Nhà theo bậc 0..10; công trình theo loại.
const HOUSE_COLORS: [number, number, number][] = [
  [0x8a8a7a, 0x6e6e60, 0xa8a898], // lều trống: xám
  [0x9c6b3c, 0x7d5530, 0xc9a06a], // lều tranh
  [0xa0743f, 0x80592f, 0xd8b06a], // nhà tranh vách đất
  [0xa66a3a, 0x85522c, 0xc98a4a], // nhà tranh
  [0x8f5a2a, 0x70451f, 0xb08050], // nhà gỗ lợp lá
  [0xb0553a, 0x8a3f2a, 0x9a4632], // nhà gỗ lợp ngói
  [0xc8b89a, 0xa89878, 0x8a3a2a], // nhà ba gian: tường vôi, ngói
  [0xd8c8a8, 0xb8a888, 0x7a2e22], // nhà ngói năm gian
  [0xe0d0b0, 0xc0b090, 0x6a2a20], // nhà phố
  [0xe8dcc0, 0xc8bca0, 0x4a2a20], // tư dinh
  [0xf0e4c8, 0xd0c4a8, 0x3a2418], // phủ đệ
];
const C = (l: number, r: number, t: number): [number, number, number] => [l, r, t];
const TYPE_COLORS: Partial<Record<BuildingType, [number, number, number]>> = {
  [BuildingType.Paddy]: C(0x5f8f3a, 0x4f7a2e, 0x9bc45a),
  [BuildingType.VegGarden]: C(0x5a8a3a, 0x4a7430, 0x7fbf4a),
  [BuildingType.PigSty]: C(0x8a6a4a, 0x6e543a, 0xc89a8a),
  [BuildingType.FishWharf]: C(0x7a6a50, 0x5e523e, 0x8ab0c0),
  [BuildingType.Granary]: C(0xb59a5a, 0x8f7a45, 0xd9c080),
  [BuildingType.Warehouse]: C(0x9a8060, 0x7a6448, 0x6a5a4a),
  [BuildingType.Market]: C(0xc08a4a, 0x9a6b35, 0xe8c070),
  [BuildingType.ClayPit]: C(0xa0603a, 0x80502e, 0xc07848),
  [BuildingType.CottonField]: C(0x8aa060, 0x70844c, 0xe8e8e0),
  [BuildingType.TeaHill]: C(0x4a7a3a, 0x3a642e, 0x5a9a48),
  [BuildingType.MulberryField]: C(0x5a7a40, 0x4a6434, 0x7a9a50),
  [BuildingType.CopperMine]: C(0x7a6a5a, 0x5e5246, 0xb87a4a),
  [BuildingType.IronMine]: C(0x6a6a6a, 0x505050, 0x8a8a90),
  [BuildingType.SaltPan]: C(0x9aa0a8, 0x7a8088, 0xf0f0f0),
  [BuildingType.LumberCamp]: C(0x7a5a3a, 0x5e4630, 0x4a6a30),
  [BuildingType.Kiln]: C(0xa05a3a, 0x80462e, 0x5a3a2a),
  [BuildingType.Loom]: C(0x9a7a5a, 0x7a6048, 0xc8b8a0),
  [BuildingType.TeaHouse]: C(0x8a7050, 0x6e5a40, 0x6a8a4a),
  [BuildingType.SilkWorkshop]: C(0xa08a6a, 0x806e54, 0xd8b84a),
  [BuildingType.Foundry]: C(0x6a5040, 0x523e32, 0xb87a3a),
  [BuildingType.Smithy]: C(0x5a5050, 0x443c3c, 0x7a7a80),
  [BuildingType.Well]: C(0x777777, 0x555555, 0x4aa0d0),
  [BuildingType.BrickWell]: C(0xa05a40, 0x804632, 0x4aa0d0),
  [BuildingType.Dinh]: C(0x8a4a3a, 0x6a3428, 0x5a3a2a),
  [BuildingType.Temple]: C(0xc8a060, 0xa0804a, 0x6a3020),
  [BuildingType.School]: C(0xb8a080, 0x988064, 0x5a4030),
  [BuildingType.Clinic]: C(0xb0b090, 0x909074, 0x4a7a5a),
  [BuildingType.Theater]: C(0xa03a3a, 0x80302e, 0xd8a040),
  [BuildingType.WatchPost]: C(0x6a5a4a, 0x52463a, 0xa03a2a),
  [BuildingType.BuilderPost]: C(0x7a6a5a, 0x5e5246, 0x4a6a8a),
  [BuildingType.Yamen]: C(0xa04040, 0x803434, 0x3a2a2a),
  [BuildingType.Garden]: C(0x4a7a30, 0x3a6428, 0x5aa040),
  [BuildingType.LotusPond]: C(0x4a7a90, 0x3a6474, 0x70b0a0),
  [BuildingType.Ruins]: C(0x3a3430, 0x2a2420, 0x4a3a30),
};
const FLAT = new Set<BuildingType>([BuildingType.Paddy, BuildingType.VegGarden, BuildingType.CottonField, BuildingType.TeaHill, BuildingType.MulberryField, BuildingType.SaltPan, BuildingType.ClayPit, BuildingType.Garden, BuildingType.LotusPond, BuildingType.Ruins]);
const HEIGHT_BY_SIZE = [0, 10, 18, 26];
function typeHeight(t: BuildingType, size: number, level: number): number {
  if (t === BuildingType.House) return 10 + Math.min(level, 10) * 1.5;
  if (FLAT.has(t)) return t === BuildingType.Garden ? 6 : 2;
  if (t === BuildingType.Well || t === BuildingType.BrickWell) return 8;
  return HEIGHT_BY_SIZE[size] ?? 20;
}
/** Kích thước móng tại ô neo: đống tro ghi kích thước vào bLevel. */
const sizeOf = (t: number, level: number): number => (t === BuildingType.Ruins ? Math.max(1, level) : BUILDING_DEFS[t]?.size ?? 1);

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
          if (t && sizeOf(t, this.bLevel[i]) > Math.max(dx, dy)) return { type: t, level: this.bLevel[i] };
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
    const n = sizeOf(type, level);
    const h = typeHeight(type, n, level);
    const col = type === BuildingType.House ? HOUSE_COLORS[level] ?? HOUSE_COLORS[0] : TYPE_COLORS[type as BuildingType] ?? HOUSE_COLORS[0];
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
