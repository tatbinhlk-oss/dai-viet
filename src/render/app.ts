// Pixi Application, camera, hover và chuyển sự kiện chuột thành ô. Chỉ đọc snapshot, không sửa state.
import { Application, Container, Graphics } from 'pixi.js';
import { GRID_SIZE } from '../sim/map/grid';
import type { Snapshot } from '../sim';
import { ChunkLayer } from './chunks';
import { FigureLayer } from './figures';
import { loadSheets } from './sheets';
import { HALF_H, HALF_W, TILE_H, tileToWorld, worldToTile, ZOOM_LEVELS } from './iso';
import { linePath } from './line';

export interface RenderApp {
  app: Application;
  onTileClick: (x: number, y: number, button: number) => void;
  onTileHover: (x: number, y: number) => void;
  /** công trình kéo dài (đường, đê, thành): bấm điểm đầu, kéo tới điểm cuối, thả → gọi với các ô theo đoạn gấp khúc một lần */
  onLine: (tiles: [number, number][]) => void;
  /** đang kéo đoạn: số ô hiện trong mờ (để UI hiện) */
  onLinePreview: (count: number) => void;
  /** kích thước khung đặt công trình hiện tại (1 = ô đơn) */
  ghostSize: number;
  /** công cụ hiện tại là loại kéo dài (đường, đê, cống, thành) */
  lineTool: boolean;
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
  const ghost = new Graphics(); // đoạn đang kéo (mờ)
  ghost.zIndex = 2;
  world.addChild(ghost);
  let lineStart: { x: number; y: number } | null = null;
  let lineTiles: [number, number][] = [];

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
  // M6c: cảm ứng — một ngón kéo dời bản đồ, hai ngón chụm zoom, chạm (không kéo) để đặt / xem
  const touches = new Map<number, { x: number; y: number }>();
  let touchDownAt = 0, pinchBase = 0, pinchZoomIdx = 1, pinched = false;
  const setZoom = (next: number, sx: number, sy: number) => {
    next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, next));
    if (next === zoomIdx) return;
    const before = screenToWorld(sx, sy);
    zoomIdx = next;
    applyCamera();
    const after = screenToWorld(sx, sy);
    camera.x += before.wx - after.wx;
    camera.y += before.wy - after.wy;
    applyCamera();
  };
  const touchCenter = () => {
    let x = 0, y = 0;
    for (const p of touches.values()) { x += p.x; y += p.y; }
    return { x: x / touches.size, y: y / touches.size };
  };
  const touchSpan = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { spaceHeld = true; e.preventDefault(); } });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceHeld = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* sự kiện giả lập không có con trỏ thật */ }
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) { downX = e.clientX; downY = e.clientY; touchDownAt = performance.now(); pinched = false; }
      if (touches.size === 2) { pinchBase = touchSpan(); pinchZoomIdx = zoomIdx; pinched = true; }
      const c = touchCenter(); lastX = c.x; lastY = c.y;
      return;
    }
    downX = lastX = e.clientX; downY = lastY = e.clientY;
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld)) { dragging = true; canvas.setPointerCapture(e.pointerId); return; }
    if (e.button === 0 && result.lineTool) {
      const t = screenToTile(e.clientX, e.clientY);
      if (inGrid(t.x, t.y)) { lineStart = t; updateLine(t.x, t.y); canvas.setPointerCapture(e.pointerId); }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = touchCenter();
      const z = ZOOM_LEVELS[zoomIdx];
      camera.x -= (c.x - lastX) / z;
      camera.y -= (c.y - lastY) / z;
      lastX = c.x; lastY = c.y;
      applyCamera();
      if (touches.size >= 2 && pinchBase > 0) {
        // mỗi lần khoảng cách hai ngón gấp √2 (hay chia √2) so với lúc bắt đầu chụm → đổi một mức zoom
        const ratio = touchSpan() / pinchBase;
        const steps = Math.round(Math.log(ratio) / Math.log(Math.SQRT2));
        setZoom(pinchZoomIdx + steps, c.x, c.y);
      }
      return;
    }
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
    if (lineStart) { updateLine(t.x, t.y); return; }
    // Kéo chuột trái khi không dời camera = đặt liên tục (công trình 1×1 không phải loại kéo dài)
    if (!dragging && (e.buttons & 1) && !spaceHeld && result.ghostSize === 1 && !result.lineTool) result.onTileClick(t.x, t.y, 0);
  });
  const endTouch = (e: PointerEvent) => {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    // chạm nhanh, không kéo, không chụm → đặt / xem tại ô
    if (touches.size === 0 && !pinched && e.type === 'pointerup' && performance.now() - touchDownAt < 500 && Math.hypot(e.clientX - downX, e.clientY - downY) < 10) {
      const t = screenToTile(e.clientX, e.clientY);
      hoverX = t.x; hoverY = t.y; result.onTileHover(t.x, t.y); drawHover();
      result.onTileClick(t.x, t.y, 0);
    }
    if (touches.size > 0) { const c = touchCenter(); lastX = c.x; lastY = c.y; }
    if (touches.size < 2) pinchBase = 0;
  };
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') { endTouch(e); return; }
    if (dragging) { dragging = false; return; }
    if (lineStart && e.button === 0) {
      const t = screenToTile(e.clientX, e.clientY);
      updateLine(t.x, t.y);
      const tiles = lineTiles;
      cancelLine();
      if (tiles.length) result.onLine(tiles);
      return;
    }
    if (e.button === 0 && Math.hypot(e.clientX - downX, e.clientY - downY) < 4) {
      const t = screenToTile(e.clientX, e.clientY);
      result.onTileClick(t.x, t.y, 0);
    }
  });
  canvas.addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') endTouch(e); else { dragging = false; cancelLine(); } });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelLine(); });
  window.addEventListener('blur', cancelLine);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(zoomIdx + (e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY);
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
  const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
  /** tính lại đoạn mờ từ điểm đầu tới ô (x, y) (kẹp vào lưới) và vẽ */
  function updateLine(x: number, y: number) {
    if (!lineStart) return;
    const cx = Math.max(0, Math.min(GRID_SIZE - 1, x)), cy = Math.max(0, Math.min(GRID_SIZE - 1, y));
    lineTiles = linePath(lineStart.x, lineStart.y, cx, cy);
    ghost.clear();
    for (const [tx, ty] of lineTiles) {
      const { wx, wy } = tileToWorld(tx, ty);
      ghost.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).fill({ color: 0xfff2a8, alpha: 0.35 }).stroke({ color: 0xfff2a8, width: 1, alpha: 0.8 });
    }
    result.onLinePreview(lineTiles.length);
  }
  function cancelLine() {
    if (!lineStart) return;
    lineStart = null; lineTiles = [];
    ghost.clear();
    result.onLinePreview(0);
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
    onLine: () => {},
    onLinePreview: () => {},
    ghostSize: 1,
    lineTool: true,
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
