// Pixi Application, camera, hover và chuyển sự kiện chuột thành ô. Chỉ đọc snapshot, không sửa state.
import { Application, Container, Graphics } from 'pixi.js';
import { GRID_SIZE } from '../sim/map/grid';
import type { Snapshot } from '../sim';
import { ChunkLayer } from './chunks';
import { FigureLayer } from './figures';
import { loadSheets } from './sheets';
import { HALF_H, HALF_W, TILE_H, tileToWorld, worldToTile, ZOOM_LEVELS } from './iso';

export interface RenderApp {
  app: Application;
  onTileClick: (x: number, y: number, button: number) => void;
  onTileHover: (x: number, y: number) => void;
  /** kích thước khung đặt công trình hiện tại (1 = ô đơn) */
  ghostSize: number;
  applySnapshot(snap: Snapshot): void;
  tileBuilding(x: number, y: number): { type: number; level: number } | null;
  /** đưa camera tới ô (x, y) */
  lookAt(x: number, y: number): void;
  /** M4: lớp phủ vùng ngập */
  setOverlay(on: boolean): void;
  /** M6-0: nhãn tên Pixi đè lên công trình có hình thật */
  setShowNames(on: boolean): void;
  /** còn dùng hình tạm (nhãn đã vẽ trong PNG) */
  readonly placeholderArt: boolean;
  destroy(): void;
}

export async function createRenderApp(canvas: HTMLCanvasElement): Promise<RenderApp> {
  const app = new Application();
  await app.init({
    canvas,
    resizeTo: window,
    background: 0x1a1a1a,
    antialias: false,
    roundPixels: true, // pixel art không nhòe: tọa độ làm tròn về số nguyên
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  });

  const sheets = await loadSheets();
  const world = new Container();
  world.sortableChildren = true;
  app.stage.addChild(world);
  const chunks = new ChunkLayer(sheets);
  chunks.groundContainer.zIndex = 0;
  chunks.objects.zIndex = 1; // công trình + walker sắp chung theo (x + y) × 8 + layer (M6-0)
  world.addChild(chunks.groundContainer, chunks.objects);
  const figures = new FigureLayer(sheets, chunks.objects);

  const hover = new Graphics();
  hover.zIndex = 2;
  world.addChild(hover);

  // Camera: bắt đầu nhìn vào giữa bản đồ
  let zoomIdx = 1;
  const center = tileToWorld(GRID_SIZE / 2, GRID_SIZE / 2);
  const camera = { x: center.wx, y: center.wy };
  const applyCamera = () => {
    const z = ZOOM_LEVELS[zoomIdx];
    world.scale.set(z);
    world.position.set(Math.round(app.screen.width / 2 - camera.x * z), Math.round(app.screen.height / 2 - camera.y * z));
  };
  applyCamera();

  let dragging = false;
  let spaceHeld = false;
  let lastX = 0, lastY = 0;
  let downX = 0, downY = 0;
  let hoverX = -1, hoverY = -1;
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { spaceHeld = true; e.preventDefault(); } });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceHeld = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    downX = lastX = e.clientX; downY = lastY = e.clientY;
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld)) { dragging = true; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const z = ZOOM_LEVELS[zoomIdx];
      camera.x -= (e.clientX - lastX) / z;
      camera.y -= (e.clientY - lastY) / z;
      lastX = e.clientX; lastY = e.clientY;
      applyCamera();
    }
    const t = screenToTile(e.clientX, e.clientY);
    if (t.x !== hoverX || t.y !== hoverY) { hoverX = t.x; hoverY = t.y; result.onTileHover(t.x, t.y); }
    drawHover();
    // Kéo chuột trái khi không dời camera = đặt liên tục (vẽ đường)
    if (!dragging && (e.buttons & 1) && !spaceHeld && result.ghostSize === 1) result.onTileClick(t.x, t.y, 0);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (dragging) { dragging = false; return; }
    if (e.button === 0 && Math.hypot(e.clientX - downX, e.clientY - downY) < 4) {
      const t = screenToTile(e.clientX, e.clientY);
      result.onTileClick(t.x, t.y, 0);
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIdx + (e.deltaY < 0 ? 1 : -1)));
    if (next === zoomIdx) return;
    const before = screenToWorld(e.clientX, e.clientY);
    zoomIdx = next;
    applyCamera();
    const after = screenToWorld(e.clientX, e.clientY);
    camera.x += before.wx - after.wx;
    camera.y += before.wy - after.wy;
    applyCamera();
  }, { passive: false });
  window.addEventListener('resize', applyCamera);

  function screenToWorld(sx: number, sy: number) {
    const z = ZOOM_LEVELS[zoomIdx];
    return { wx: (sx - world.position.x) / z, wy: (sy - world.position.y) / z };
  }
  function screenToTile(sx: number, sy: number) {
    const { wx, wy } = screenToWorld(sx, sy);
    return worldToTile(wx, wy);
  }
  function drawHover() {
    hover.clear();
    const n = result.ghostSize;
    if (hoverX < 0 || hoverY < 0 || hoverX + n > GRID_SIZE || hoverY + n > GRID_SIZE) return;
    for (let dy = 0; dy < n; dy++) {
      for (let dx = 0; dx < n; dx++) {
        const { wx, wy } = tileToWorld(hoverX + dx, hoverY + dy);
        hover.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).stroke({ color: 0xfff2a8, width: 2 });
      }
    }
  }

  app.ticker.add(() => { chunks.flush(); figures.update(); });

  const result: RenderApp = {
    app,
    onTileClick: () => {},
    onTileHover: () => {},
    ghostSize: 1,
    applySnapshot(snap) {
      if (snap.full) chunks.setFull(snap.full.terrain, snap.full.elevation, snap.full.bType, snap.full.bLevel);
      if (snap.changed) chunks.applyChanges(snap.changed.offsets, snap.changed.terrain, snap.changed.bType, snap.changed.bLevel);
      figures.setSnapshot(snap.figures);
    },
    tileBuilding: (x, y) => chunks.buildingAt(x, y),
    lookAt(x, y) {
      const p = tileToWorld(x, y);
      camera.x = p.wx; camera.y = p.wy;
      applyCamera();
    },
    setOverlay(on) { chunks.setOverlay(on); },
    setShowNames(on) { chunks.setShowNames(on); },
    placeholderArt: sheets.buildings.placeholder,
    destroy() { app.destroy(); },
  };
  return result;
}
