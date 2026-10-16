// Pixi Application, camera, hover và chuyển sự kiện chuột thành ô. Chỉ đọc snapshot, không sửa state.
import { Application, Container, Graphics } from 'pixi.js';
import { GRID_SIZE } from '../sim/map/grid';
import type { Snapshot } from '../sim';
import { ChunkLayer } from './chunks';
import { FigureLayer } from './figures';
import { loadSheets } from './sheets';
import { HALF_H, HALF_W, TILE_H, tileToWorld, worldToTile, ZOOM_LEVELS } from './iso';
import { linePath, rectPath, snapRoadStart, type LinePending } from './line';
import { Minimap } from './minimap';

export interface RenderApp {
  app: Application;
  onTileClick: (x: number, y: number, button: number) => void;
  onTileHover: (x: number, y: number) => void;
  /** công trình kéo dài (đường, đê, thành): bấm điểm đầu, kéo tới điểm cuối, thả → gọi với các ô theo đoạn gấp khúc một lần */
  onLine: (tiles: [number, number][]) => void;
  /** đang kéo đoạn: số ô hiện trong mờ (để UI hiện) */
  onLinePreview: (count: number) => void;
  /** điện thoại: chạm hai điểm (đầu → cuối) rồi xác nhận — trạng thái đoạn đang chờ cho thanh ✓ Xây · ↔ · ✕ Bỏ; null = không có */
  onLinePending: (p: LinePending | null) => void;
  /** điện thoại: ✓ xây đoạn đang chờ (đường / đê / thành: ô cuối thành điểm đầu đoạn kế) */
  confirmLine(): void;
  /** điện thoại: ↔ đổi chiều gấp khúc của đoạn đang chờ */
  flipLine(): void;
  /** bỏ đoạn đang kéo / đang chờ (Esc, ✕, đổi công cụ) */
  cancelLine(): void;
  /** kích thước khung đặt công trình hiện tại (1 = ô đơn) */
  ghostSize: number;
  /** công cụ hiện tại là loại kéo dài (đường, đê, cống, thành) */
  lineTool: boolean;
  /** công cụ kéo theo vùng chữ nhật (lều, vườn, phá) */
  rectTool: boolean;
  /** QoL: lý do không đặt được tại ô (null = được) — main đặt theo công cụ; khung đặt tô đỏ / lục */
  validate: (x: number, y: number) => string | null;
  /** lưới địa hình render đang giữ (để main kiểm chỗ đặt mà không hỏi worker) */
  tiles(): { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array };
  applySnapshot(snap: Snapshot): void;
  tileBuilding(x: number, y: number): { type: number; level: number } | null;
  /** đưa camera tới ô (x, y) */
  lookAt(x: number, y: number): void;
  /** QoL: vẽ vùng phục vụ (giếng: ô vuông bán kính range quanh móng) của công trình đang chọn; null = tắt */
  setRange(r: { x: number; y: number; size: number; range: number } | null): void;
  /** QoL: dời camera theo pixel màn hình (phím mũi tên) */
  pan(dx: number, dy: number): void;
  /** QoL: bật / tắt bản đồ thu nhỏ (vẽ trong Pixi, góc dưới phải) */
  setMinimap(on: boolean): void;
  /** QoL: vùng đang nhìn (ô tâm và bốn góc màn hình theo ô) cho bản đồ thu nhỏ */
  view(): { cx: number; cy: number; corners: [number, number][] };
  /** lớp phủ: 'flood' tô theo cờ địa hình (M4); các chế độ khác lấy dữ liệu từ snapshot (QoL); '' tắt */
  setOverlay(mode: string): void;
  /** M6-0: nhãn tên Pixi đè lên công trình có hình thật */
  setShowNames(on: boolean): void;
  /** M8: chấm đỏ nhấp nháy trên bản đồ thu nhỏ (mép giặc sắp vào) */
  setMarkers(pts: [number, number][]): void;
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
  // QoL: HUD trong Pixi (bản đồ thu nhỏ) — không chịu phép biến đổi camera
  const minimap = new Minimap();
  app.stage.addChild(minimap.node);
  minimap.layout(app.screen.width, app.screen.height);
  let miniDrag = false;
  let miniTick = 0;
  const rangeG = new Graphics(); // vùng phục vụ công trình đang chọn
  rangeG.zIndex = 2;
  world.addChild(rangeG);
  let rangeKey = '';
  const ghost = new Graphics(); // đoạn đang kéo (mờ)
  ghost.zIndex = 2;
  world.addChild(ghost);
  let lineStart: { x: number; y: number } | null = null;
  let lineTiles: [number, number][] = [];
  let dragRect = false; // đang kéo vùng (rectTool) thay vì đoạn
  // Điện thoại: chạm hai điểm. pending 1 = đã có điểm đầu (lineStart), 2 = đã có điểm cuối (tapEnd) và đoạn mờ chờ ✓.
  // Giữa hai lần chạm vẫn kéo / chụm dời bản đồ thoải mái. Sau ✓ ô cuối thành điểm đầu đoạn kế (chained: bỏ ô đầu vì đã là đường).
  let pending: 0 | 1 | 2 = 0;
  let tapEnd: { x: number; y: number } | null = null;
  let flip = false, chained = false;
  const TOUCH_OFFSET = 40; // giữ rồi kéo bằng ngón: điểm cuối lấy cao hơn ngón 40 px để ngón không che ô

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
  let touchDrawTimer = 0; // giữ một ngón ≥ 450 ms không nhúc nhích → vẽ đoạn / vùng thay vì dời bản đồ
  let touchDrawing = false;
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
    const mh = minimap.hit(e.clientX, e.clientY);
    if (mh && (e.button === 0 || e.pointerType === 'touch')) { result.lookAt(mh.x, mh.y); miniDrag = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* giả lập */ } return; }
    if (e.pointerType === 'touch') {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* sự kiện giả lập không có con trỏ thật */ }
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) {
        downX = e.clientX; downY = e.clientY; touchDownAt = performance.now(); pinched = false; touchDrawing = false;
        clearTimeout(touchDrawTimer);
        if (result.lineTool || result.rectTool) touchDrawTimer = window.setTimeout(() => {
          const p = touches.get(e.pointerId);
          if (!p || touches.size !== 1 || Math.hypot(p.x - downX, p.y - downY) >= 10) return;
          const t = screenToTile(p.x, p.y);
          if (!inGrid(t.x, t.y)) return;
          cancelLine();
          touchDrawing = true; lineStart = t; dragRect = result.rectTool; result.onLinePreview(updateLine(t.x, t.y));
        }, 450);
      }
      if (touches.size === 2) { pinchBase = touchSpan(); pinchZoomIdx = zoomIdx; pinched = true; }
      const c = touchCenter(); lastX = c.x; lastY = c.y;
      return;
    }
    downX = lastX = e.clientX; downY = lastY = e.clientY;
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld)) { dragging = true; canvas.setPointerCapture(e.pointerId); return; }
    if (e.button === 0 && (result.lineTool || result.rectTool)) {
      const t = screenToTile(e.clientX, e.clientY);
      if (inGrid(t.x, t.y)) { cancelLine(); lineStart = t; dragRect = result.rectTool; result.onLinePreview(updateLine(t.x, t.y)); canvas.setPointerCapture(e.pointerId); }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (miniDrag) { const mh = minimap.hit(e.clientX, e.clientY); if (mh) result.lookAt(mh.x, mh.y); return; }
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchDrawing) { const t = screenToTile(e.clientX, e.clientY - TOUCH_OFFSET); result.onLinePreview(updateLine(t.x, t.y)); return; }
      if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 10) clearTimeout(touchDrawTimer);
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
    if (lineStart && !pending) { result.onLinePreview(updateLine(t.x, t.y)); return; }
    // công trình khác: mỗi lần bấm đặt một cái (không còn đặt theo vệt chuột)
  });
  const endTouch = (e: PointerEvent) => {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    clearTimeout(touchDrawTimer);
    if (touchDrawing) {
      touchDrawing = false;
      if (e.type === 'pointerup') { const t = screenToTile(e.clientX, e.clientY - TOUCH_OFFSET); updateLine(t.x, t.y); const tiles = lineTiles; cancelLine(); if (tiles.length) result.onLine(tiles); } else cancelLine();
      return;
    }
    // chạm nhanh, không kéo, không chụm → đặt / xem tại ô; công cụ kéo dài / vùng: chạm hai điểm rồi ✓ (tapTile)
    if (touches.size === 0 && !pinched && e.type === 'pointerup' && performance.now() - touchDownAt < 500 && Math.hypot(e.clientX - downX, e.clientY - downY) < 10) {
      const t = screenToTile(e.clientX, e.clientY);
      hoverX = t.x; hoverY = t.y; result.onTileHover(t.x, t.y); drawHover();
      if ((result.lineTool || result.rectTool) && inGrid(t.x, t.y)) tapTile(t); else result.onTileClick(t.x, t.y, 0);
    }
    if (touches.size > 0) { const c = touchCenter(); lastX = c.x; lastY = c.y; }
    if (touches.size < 2) pinchBase = 0;
  };
  canvas.addEventListener('pointerup', (e) => {
    if (miniDrag) { miniDrag = false; return; }
    if (e.pointerType === 'touch') { endTouch(e); return; }
    if (dragging) { dragging = false; return; }
    if (lineStart && !pending && e.button === 0) {
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
  window.addEventListener('resize', () => { applyCamera(); minimap.layout(app.screen.width, app.screen.height); });

  function screenToWorld(sx: number, sy: number) {
    const z = ZOOM_LEVELS[zoomIdx];
    return { wx: (sx - world.position.x) / z, wy: (sy - world.position.y) / z };
  }
  function screenToTile(sx: number, sy: number) {
    const { wx, wy } = screenToWorld(sx, sy);
    return worldToTile(wx, wy);
  }
  const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
  /** tính lại đoạn mờ từ điểm đầu tới ô (x, y) (kẹp vào lưới) và vẽ; trả về số ô đặt được. Nối tiếp: bỏ ô đầu (đã là đường). */
  function updateLine(x: number, y: number): number {
    if (!lineStart) return 0;
    const cx = Math.max(0, Math.min(GRID_SIZE - 1, x)), cy = Math.max(0, Math.min(GRID_SIZE - 1, y));
    const path = dragRect ? rectPath(lineStart.x, lineStart.y, cx, cy) : linePath(lineStart.x, lineStart.y, cx, cy, flip);
    lineTiles = chained ? path.slice(1) : path;
    ghost.clear();
    let ok = 0;
    for (const [tx, ty] of lineTiles) {
      const { wx, wy } = tileToWorld(tx, ty);
      const bad = result.validate(tx, ty) !== null;
      if (!bad) ok++;
      const color = bad ? 0xe05040 : 0xfff2a8;
      ghost.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).fill({ color, alpha: bad ? 0.25 : 0.35 }).stroke({ color, width: 1, alpha: 0.8 });
    }
    if (pending) drawMarker();
    return ok;
  }
  /** điện thoại: dấu điểm đầu (viền dày + chấm giữa) đè lên đoạn mờ */
  function drawMarker() {
    if (!lineStart) return;
    const { wx, wy } = tileToWorld(lineStart.x, lineStart.y);
    ghost.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).stroke({ color: 0xffffff, width: 3, alpha: 0.95 });
    ghost.circle(wx, wy + HALF_H, 4).fill({ color: 0xfff2a8, alpha: 0.95 });
  }
  function pendingInfo(ok: number): LinePending {
    return { stage: pending === 2 ? 'end' : 'start', ok, count: lineTiles.length, rect: dragRect, chained };
  }
  /** điện thoại: một lần chạm nhanh với công cụ kéo dài / vùng — chọn điểm đầu, rồi điểm cuối (chạm nữa thì dời điểm cuối) */
  function tapTile(t: { x: number; y: number }) {
    if (pending === 0) {
      const [sx, sy] = result.lineTool && !result.rectTool ? snapRoadStart(chunks.tiles().terrain, GRID_SIZE, t.x, t.y) : [t.x, t.y];
      lineStart = { x: sx, y: sy }; dragRect = result.rectTool; pending = 1; flip = false; chained = false; lineTiles = []; tapEnd = null;
      ghost.clear(); drawMarker();
      result.onLinePending(pendingInfo(0));
      return;
    }
    if (pending === 1 && lineStart && t.x === lineStart.x && t.y === lineStart.y) {
      // chạm lại ô đầu: nối tiếp thì thôi nối; không thì đặt ngay một ô
      if (chained) { cancelLine(); return; }
      const ok = updateLine(t.x, t.y); const tiles = lineTiles; cancelLine(); if (ok) result.onLine(tiles);
      return;
    }
    tapEnd = t; pending = 2;
    result.onLinePending(pendingInfo(updateLine(t.x, t.y)));
  }
  function cancelLine() {
    if (!lineStart && !pending) return;
    lineStart = null; lineTiles = []; dragRect = false; pending = 0; tapEnd = null; flip = false; chained = false;
    ghost.clear();
    result.onLinePreview(0);
    result.onLinePending(null);
  }
  function drawHover() {
    hover.clear();
    const n = result.ghostSize;
    if (hoverX < 0 || hoverY < 0 || hoverX + n > GRID_SIZE || hoverY + n > GRID_SIZE) return;
    const bad = result.validate(hoverX, hoverY) !== null; // QoL: khung đặt đỏ khi không đặt được, lục khi được
    const color = bad ? 0xe05040 : 0x8fe08a;
    for (let dy = 0; dy < n; dy++) {
      for (let dx = 0; dx < n; dx++) {
        const { wx, wy } = tileToWorld(hoverX + dx, hoverY + dy);
        hover.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).fill({ color, alpha: 0.18 }).stroke({ color, width: 2 });
      }
    }
  }

  app.ticker.add(() => {
    chunks.flush(); figures.update(); chunks.animate(performance.now());
    if (minimap.node.visible && ++miniTick % 15 === 0) minimap.update(chunks.tiles(), result.view().corners); // ~4 lần/giây
  });

  /** vẽ lại khung đặt khi công cụ đổi (main gọi) */
  const result: RenderApp = {
    app,
    onTileClick: () => {},
    onTileHover: () => {},
    onLine: () => {},
    onLinePreview: () => {},
    onLinePending: () => {},
    confirmLine() {
      if (pending !== 2 || !tapEnd) return;
      const tiles = lineTiles, end = tapEnd, chain = !dragRect;
      if (!chain) { cancelLine(); if (tiles.length) result.onLine(tiles); return; }
      // nối tiếp: ô cuối thành điểm đầu đoạn kế (ô đó vừa xây nên bỏ khỏi đoạn kế); ✕ để thôi
      lineStart = end; pending = 1; tapEnd = null; flip = false; chained = true; lineTiles = [];
      ghost.clear(); drawMarker();
      if (tiles.length) result.onLine(tiles);
      result.onLinePending(pendingInfo(0));
    },
    flipLine() {
      if (pending !== 2 || !tapEnd || dragRect) return;
      flip = !flip;
      result.onLinePending(pendingInfo(updateLine(tapEnd.x, tapEnd.y)));
    },
    cancelLine,
    ghostSize: 1,
    lineTool: true,
    rectTool: false,
    validate: () => null,
    tiles: () => chunks.tiles(),
    applySnapshot(snap) {
      if (snap.full) chunks.setFull(snap.full.terrain, snap.full.elevation, snap.full.bType, snap.full.bLevel);
      if (snap.changed) chunks.applyChanges(snap.changed.offsets, snap.changed.terrain, snap.changed.bType, snap.changed.bLevel);
      figures.setSnapshot(snap.figures);
      chunks.setOverlayData(snap.overlay ?? null);
      chunks.setProblems(snap.problems);
    },
    tileBuilding: (x, y) => chunks.buildingAt(x, y),
    lookAt(x, y) {
      const p = tileToWorld(x, y);
      camera.x = p.wx; camera.y = p.wy;
      applyCamera();
    },
    setMinimap(on) { minimap.node.visible = on; if (on) minimap.update(chunks.tiles(), result.view().corners); },
    setRange(r) {
      const key = r ? `${r.x},${r.y},${r.size},${r.range}` : '';
      if (key === rangeKey) return;
      rangeKey = key;
      rangeG.clear();
      if (!r) return;
      const x0 = Math.max(0, r.x - r.range), y0 = Math.max(0, r.y - r.range), x1 = Math.min(GRID_SIZE - 1, r.x + r.size - 1 + r.range), y1 = Math.min(GRID_SIZE - 1, r.y + r.size - 1 + r.range);
      const a = tileToWorld(x0, y0), b = tileToWorld(x1 + 1, y0), c = tileToWorld(x1 + 1, y1 + 1), d = tileToWorld(x0, y1 + 1);
      rangeG.poly([a.wx, a.wy, b.wx, b.wy, c.wx, c.wy, d.wx, d.wy]).fill({ color: 0x60b8ff, alpha: 0.12 }).stroke({ color: 0x8fd0ff, width: 2, alpha: 0.9 });
    },
    pan(dx, dy) { const z = ZOOM_LEVELS[zoomIdx]; camera.x += dx / z; camera.y += dy / z; applyCamera(); },
    view() {
      const c = worldToTile(camera.x, camera.y);
      const w = app.screen.width, h = app.screen.height;
      const corner = (sx: number, sy: number): [number, number] => { const t = screenToTile(sx, sy); return [t.x, t.y]; };
      return { cx: c.x, cy: c.y, corners: [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)] };
    },
    setOverlay(mode) { chunks.setOverlay(mode === 'flood'); if (!mode || mode === 'flood') chunks.setOverlayData(null); },
    setShowNames(on) { chunks.setShowNames(on); },
    setMarkers(pts) { minimap.setMarkers(pts); },
    placeholderArt: sheets.buildings.placeholder,
    destroy() { app.destroy(); },
  };
  return result;
}
