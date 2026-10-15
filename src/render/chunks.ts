// Bản đồ: đất nền chia chunk 16×16 ô, mỗi chunk một ParticleContainer (mọi ô dùng chung sheet ground) chỉ dựng lại khi có ô đổi;
// công trình là Sprite từ sheet buildings đặt tại điểm neo (góc dưới hình thoi móng), zIndex = (x + y) × 8 + layer.
// Thiếu frame thì vẽ khối màu bằng Graphics như trước (không crash). Nhãn tên Pixi bật/tắt bằng nút "Hiện tên".
import { Container, Graphics, Particle, ParticleContainer, Sprite, Text, type Texture } from 'pixi.js';
import { GRID_SIZE, T_BUILDING, T_FLOODED, T_FLOODPLAIN, T_RESERVED, T_ROAD, T_SUNKEN, T_TREE, T_UNPROTECTED, T_WATER } from '../sim/map/grid';
import { BuildingType, isDike } from '../sim/state';
import { BUILDING_DEFS, HOUSE_LEVELS } from '../sim/buildings/defs';
import { HALF_H, HALF_W, LAYER_BUILDING, tileToWorld, TILE_H, zIndexOf, LAYER_OVERLAY } from './iso';
import { blockColors, typeHeight } from './palette';
import { frameOf, isPlaceholder, type Sheets } from './sheets';

export const CHUNK = 16;
const CHUNKS_PER_SIDE = GRID_SIZE / CHUNK;

/** Kích thước móng tại ô neo: đống tro ghi kích thước vào bLevel. */
const sizeOf = (t: number, level: number): number => (t === BuildingType.Ruins ? Math.max(1, level) : t === BuildingType.House ? ((level >> 4) & 3) + 1 : BUILDING_DEFS[t]?.size ?? 1);
/** bậc nhà nằm ở 4 bit thấp của bLevel (bit 4–5 là cỡ) */
export const houseLevelOf = (bLevel: number): number => bLevel & 15;
const keyOf = (t: BuildingType): string => BUILDING_DEFS[t].key;

/** Tên frame công trình trong sheet buildings. */
export function buildingFrame(t: BuildingType, level: number): string {
  if (t === BuildingType.House) { const n = ((level >> 4) & 3) + 1; return `house${n > 1 ? n : ''}_l${Math.min(level & 15, 10)}`; }
  if (t === BuildingType.Ruins) return `ruins_${Math.max(1, level)}`;
  return keyOf(t);
}
/** Tên frame đê / cống trong sheet ground (bLevel = cao + 16 nếu cống mở). */
export function dikeFrame(t: BuildingType, level: number, road: boolean): string {
  const h = level & 15, open = (level & 16) !== 0;
  if (t === BuildingType.Sluice) return `sluice${h}_${open ? 'open' : 'closed'}`;
  return road ? `dike${h}_road` : `dike${h}`;
}

/** Khối màu dự phòng, cùng hình dạng PNG tạm: gốc tại đỉnh dưới hình thoi móng. */
export function drawBlock(g: Graphics, n: number, h: number, col: [number, number, number]): void {
  const L = { x: -n * HALF_W, y: -n * HALF_H }, R = { x: n * HALF_W, y: -n * HALF_H }, B = { x: 0, y: 0 }, T = { x: 0, y: -n * TILE_H };
  g.poly([L.x, L.y, L.x, L.y - h, B.x, B.y - h, B.x, B.y]).fill(col[0]);
  g.poly([B.x, B.y, B.x, B.y - h, R.x, R.y - h, R.x, R.y]).fill(col[1]);
  g.poly([T.x, T.y - h, R.x, R.y - h, B.x, B.y - h, L.x, L.y - h]).fill(col[2]);
}

export class ChunkLayer {
  /** đất nền — luôn dưới mọi thứ */
  readonly groundContainer = new Container();
  /** công trình (+ walker do FigureLayer thêm vào), sắp theo zIndex */
  readonly objects = new Container();
  private readonly chunks: ParticleContainer[] = [];
  private readonly dirty = new Set<number>();
  private readonly dirtyBuildings = new Set<number>();
  private readonly sprites = new Map<number, { node: Sprite | Graphics; label: Text | null; key: string }>();
  private terrain: Uint16Array = new Uint16Array(GRID_SIZE * GRID_SIZE);
  private elevation: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);
  private bType: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);
  private bLevel: Uint8Array = new Uint8Array(GRID_SIZE * GRID_SIZE);
  private overlay = false; // vùng ngập (theo cờ địa hình)
  private overlayData: Uint8Array | null = null; // QoL: lớp phủ giá trị mỗi ô
  private readonly overlayChunks: ParticleContainer[] = [];
  private readonly overlayHash: number[] = [];
  private readonly dirtyOverlay = new Set<number>();
  private dim = false; // mờ công trình khi bật lớp phủ giá trị
  private readonly markers = new Map<number, Container>(); // QoL: biểu tượng ⚠ theo ô neo
  private showNames = false;

  constructor(private readonly sheets: Sheets) {
    this.objects.sortableChildren = true;
    for (let cy = 0; cy < CHUNKS_PER_SIDE; cy++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const pc = new ParticleContainer({ texture: sheets.ground.base, dynamicProperties: { position: false, vertex: false, rotation: false, uvs: false, color: false } });
        pc.zIndex = cx + cy;
        this.chunks.push(pc);
        this.groundContainer.addChild(pc);
        const oc = new ParticleContainer({ texture: sheets.ground.base, dynamicProperties: { position: false, vertex: false, rotation: false, uvs: false, color: false } });
        oc.zIndex = cx + cy + 0.5;
        this.overlayChunks.push(oc);
        this.overlayHash.push(0);
        this.groundContainer.addChild(oc);
      }
    }
    this.groundContainer.sortableChildren = true;
  }

  /** QoL: dữ liệu lớp phủ mỗi snapshot (null = tắt). Chỉ dựng lại chunk có giá trị đổi. Công trình mờ đi để thấy màu ô dưới. */
  setOverlayData(data: Uint8Array | null): void {
    const wasOn = this.overlayData !== null;
    this.overlayData = data;
    if (data === null) {
      if (wasOn) for (let c = 0; c < this.overlayChunks.length; c++) { this.overlayChunks[c].removeParticles(); this.overlayChunks[c].update(); this.overlayHash[c] = 0; }
    } else {
      for (let c = 0; c < this.overlayChunks.length; c++) {
        const cx = c % CHUNKS_PER_SIDE, cy = (c / CHUNKS_PER_SIDE) | 0;
        let h = 1;
        for (let dy = 0; dy < CHUNK; dy++) { const row = (cy * CHUNK + dy) * GRID_SIZE + cx * CHUNK; for (let dx = 0; dx < CHUNK; dx++) h = (Math.imul(h, 31) + data[row + dx] + 1) | 0; }
        if (h !== this.overlayHash[c]) { this.overlayHash[c] = h; this.dirtyOverlay.add(c); }
      }
    }
    const dim = data !== null;
    if (dim !== this.dim) {
      this.dim = dim;
      for (const sp of this.sprites.values()) { sp.node.alpha = dim ? 0.3 : 1; if (sp.label) sp.label.visible = !dim; }
    }
  }

  /** QoL: biểu tượng ⚠ trên công trình có vấn đề (ô neo). */
  setProblems(offsets: Uint32Array): void {
    const want = new Set<number>();
    for (let i = 0; i < offsets.length; i++) want.add(offsets[i]);
    for (const [o, node] of this.markers) if (!want.has(o)) { node.destroy({ children: true }); this.markers.delete(o); }
    for (const o of want) {
      if (this.markers.has(o)) continue;
      const bt = this.bType[o] as BuildingType;
      if (!bt) continue;
      const level = this.bLevel[o], n = sizeOf(bt, level);
      const ax = o % GRID_SIZE, ay = (o / GRID_SIZE) | 0;
      const { wx, wy } = tileToWorld(ax, ay);
      const node = new Container();
      const g = new Graphics();
      g.circle(0, 0, 7).fill(0xd84a3a).stroke({ color: 0x3a1410, width: 1.5 });
      g.rect(-1.2, -4.5, 2.4, 5.5).fill(0xfff6e0);
      g.circle(0, 3.4, 1.3).fill(0xfff6e0);
      node.addChild(g);
      node.position.set(wx, wy + TILE_H - typeHeight(bt, n, level) - n * HALF_H - 10);
      node.zIndex = zIndexOf(ax, ay, LAYER_OVERLAY);
      this.objects.addChild(node);
      this.markers.set(o, node);
    }
  }

  /** M4: bật/tắt lớp phủ vùng ngập — dựng lại mọi chunk. */
  setOverlay(on: boolean): void {
    if (this.overlay === on) return;
    this.overlay = on;
    for (let i = 0; i < this.chunks.length; i++) this.dirty.add(i);
  }

  /** M6-0: nhãn tên Pixi đè lên công trình có hình thật (hình tạm đã có nhãn trong PNG). */
  setShowNames(on: boolean): void {
    if (this.showNames === on) return;
    this.showNames = on;
    for (const o of this.sprites.keys()) this.dirtyBuildings.add(o);
  }

  setFull(terrain: Uint16Array, elevation: Uint8Array, bType: Uint8Array, bLevel: Uint8Array): void {
    this.terrain = terrain; this.elevation = elevation; this.bType = bType; this.bLevel = bLevel;
    for (let i = 0; i < this.chunks.length; i++) this.dirty.add(i);
    for (const o of this.sprites.keys()) this.dirtyBuildings.add(o);
    for (let o = 0; o < bType.length; o++) if (bType[o]) this.dirtyBuildings.add(o);
  }

  applyChanges(offsets: Uint32Array, terrain: Uint16Array, bType: Uint8Array, bLevel: Uint8Array): void {
    for (let k = 0; k < offsets.length; k++) {
      const o = offsets[k];
      this.terrain[o] = terrain[k]; this.bType[o] = bType[k]; this.bLevel[o] = bLevel[k];
      const x = o % GRID_SIZE, y = (o / GRID_SIZE) | 0;
      this.dirty.add(((y / CHUNK) | 0) * CHUNKS_PER_SIDE + ((x / CHUNK) | 0));
      this.dirtyBuildings.add(o);
    }
  }

  /** QoL: lưới hiện có cho kiểm chỗ đặt (chỉ đọc). */
  tiles(): { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array } { return { terrain: this.terrain, elevation: this.elevation, bType: this.bType }; }

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
          if (t && sizeOf(t, this.bLevel[i]) > Math.max(dx, dy)) return { type: t, level: t === BuildingType.House ? this.bLevel[i] & 15 : this.bLevel[i] };
        }
      }
    }
    return null;
  }

  /** Vẽ lại các chunk và công trình bẩn. Gọi mỗi frame; thường là 0 việc. */
  flush(): void {
    for (const c of this.dirty) this.redrawChunk(c);
    this.dirty.clear();
    for (const c of this.dirtyOverlay) this.redrawOverlayChunk(c);
    this.dirtyOverlay.clear();
    for (const o of this.dirtyBuildings) this.redrawBuilding(o);
    this.dirtyBuildings.clear();
  }

  private ground(key: string): Texture | null { return frameOf(this.sheets.ground, key); }

  /** Lớp phủ giá trị: ô trắng tint theo giá trị — 1–100 đỏ, 101–200 lục, 201 vàng; độ mờ theo cường độ. */
  private redrawOverlayChunk(c: number): void {
    const data = this.overlayData;
    const pc = this.overlayChunks[c];
    pc.removeParticles();
    const tex = this.ground('overlay_white');
    if (data && tex) {
      const cx = c % CHUNKS_PER_SIDE, cy = (c / CHUNKS_PER_SIDE) | 0;
      for (let dy = 0; dy < CHUNK; dy++) {
        for (let dx = 0; dx < CHUNK; dx++) {
          const x = cx * CHUNK + dx, y = cy * CHUNK + dy;
          const v = data[y * GRID_SIZE + x];
          if (!v) continue;
          let tint = 0xf0d040, alpha = 0.5;
          if (v <= 100) { tint = 0xe03a2a; alpha = 0.25 + (0.5 * v) / 100; }
          else if (v <= 200) { tint = 0x40c050; alpha = 0.25 + (0.5 * (v - 100)) / 100; }
          const { wx, wy } = tileToWorld(x, y);
          pc.addParticle(new Particle({ texture: tex, x: wx, y: wy + TILE_H, anchorX: 0.5, anchorY: 1, tint, alpha }));
        }
      }
    }
    pc.update();
  }

  private redrawChunk(c: number): void {
    const cx = c % CHUNKS_PER_SIDE, cy = (c / CHUNKS_PER_SIDE) | 0;
    const pc = this.chunks[c];
    pc.removeParticles();
    const add = (key: string, wx: number, wy: number): void => {
      const tex = this.ground(key);
      if (tex) pc.addParticle(new Particle({ texture: tex, x: wx, y: wy + TILE_H, anchorX: 0.5, anchorY: 1 }));
    };
    // Duyệt theo x+y tăng dần để thứ tự vẽ đúng (đê cao che ô phía sau)
    for (let s = 0; s < CHUNK * 2 - 1; s++) {
      for (let dx = Math.max(0, s - CHUNK + 1); dx <= Math.min(CHUNK - 1, s); dx++) {
        const dy = s - dx;
        const x = cx * CHUNK + dx, y = cy * CHUNK + dy;
        const i = y * GRID_SIZE + x;
        const t = this.terrain[i];
        const { wx, wy } = tileToWorld(x, y);
        const bt = this.bType[i];
        const dike = bt && isDike(bt as BuildingType);
        let base: string;
        if (t & T_WATER) base = 'water';
        else if (dike) base = t & T_FLOODPLAIN ? 'floodplain' : `grass${this.elevation[i]}`;
        else if (t & T_ROAD) base = 'road';
        else if (t & T_BUILDING) base = 'floor';
        else if (t & T_SUNKEN) base = 'sunken';
        else if (t & T_FLOODPLAIN) base = 'floodplain';
        else base = `grass${Math.min(4, this.elevation[i])}`;
        add(base, wx, wy);
        if (t & T_FLOODED) add('flooded', wx, wy);
        else if (this.overlay && t & T_FLOODPLAIN && !(t & T_WATER)) add(t & T_UNPROTECTED ? 'overlay_unprotected' : 'overlay_protected', wx, wy);
        if (t & T_TREE) add('tree', wx, wy);
        if (t & T_RESERVED) add('reserved', wx, wy); // M6b: đất chưa cấp phủ tối
        if (dike) add(dikeFrame(bt as BuildingType, this.bLevel[i], (t & T_ROAD) !== 0), wx, wy);
      }
    }
    pc.update();
  }

  /** Sprite công trình tại ô neo o (đê, cống vẽ ở lớp đất). */
  private redrawBuilding(o: number): void {
    const cur = this.sprites.get(o);
    const bt = this.bType[o] as BuildingType;
    if (!bt || isDike(bt)) {
      if (cur) { cur.node.destroy(); cur.label?.destroy(); this.sprites.delete(o); }
      const mk = this.markers.get(o);
      if (mk) { mk.destroy({ children: true }); this.markers.delete(o); }
      return;
    }
    const level = this.bLevel[o];
    const key = buildingFrame(bt, level);
    const wantLabel = this.showNames && !isPlaceholder(this.sheets.buildings, key);
    if (cur && cur.key === key && (cur.label !== null) === wantLabel) return;
    if (cur) { cur.node.destroy(); cur.label?.destroy(); }
    const ax = o % GRID_SIZE, ay = (o / GRID_SIZE) | 0;
    const { wx, wy } = tileToWorld(ax, ay);
    const px = wx, py = wy + TILE_H; // góc dưới hình thoi ô neo
    const n = sizeOf(bt, level);
    const tex = frameOf(this.sheets.buildings, key);
    let node: Sprite | Graphics;
    if (tex) {
      const sp = new Sprite(tex);
      sp.anchor.set(0.5, 1);
      node = sp;
    } else {
      const g = new Graphics();
      drawBlock(g, n, typeHeight(bt, n, level), blockColors(bt, level));
      node = g;
    }
    node.position.set(px, py);
    node.zIndex = zIndexOf(ax, ay, LAYER_BUILDING);
    if (this.dim) node.alpha = 0.3;
    this.objects.addChild(node);
    const mk = this.markers.get(o); // công trình đổi → bỏ biểu tượng, snapshot sau đặt lại
    if (mk) { mk.destroy({ children: true }); this.markers.delete(o); }
    let label: Text | null = null;
    if (wantLabel) {
      const lv = level & 15;
      const name = bt === BuildingType.House ? (lv <= 1 ? `Lều ${lv}` : `Nhà ${lv}`) : BUILDING_DEFS[bt].short ?? BUILDING_DEFS[bt].name;
      label = new Text({ text: name, style: { fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold', fill: 0xfff6e0, stroke: { color: 0x14100a, width: 3 } } });
      label.anchor.set(0.5, 0.5);
      label.position.set(px, py - typeHeight(bt, n, level) - n * HALF_H);
      label.zIndex = zIndexOf(ax, ay, LAYER_BUILDING) + 0.5;
      if (this.dim) label.visible = false;
      this.objects.addChild(label);
    }
    this.sprites.set(o, { node, label, key });
  }
}

/** Tên hiển thị của nhà theo bậc (dùng cho hover). */
export const houseName = (level: number): string => HOUSE_LEVELS[level]?.name ?? '';
