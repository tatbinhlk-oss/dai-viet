// Pixi Application, camera, hover và chuyển sự kiện chuột thành ô. Chỉ đọc snapshot, không sửa state.
import { Application, Container, Graphics } from 'pixi.js';
import { GRID_SIZE } from '../sim/map/grid';
import type { Snapshot } from '../sim';
import { ChunkLayer } from './chunks';
import { HALF_H, HALF_W, TILE_H, tileToWorld, worldToTile, ZOOM_LEVELS } from './iso';

export interface RenderApp {
  app: Application;
  onTileClick: (x: number, y: number, button: number) => void;
  applySnapshot(snap: Snapshot): void;
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

  const world = new Container();
  app.stage.addChild(world);
  const chunks = new ChunkLayer();
  world.addChild(chunks.container);

  const hover = new Graphics();
  hover.zIndex = 1_000_000;
  world.addChild(hover);
  world.sortableChildren = true;

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

  // Kéo bằng chuột phải / chuột giữa / Space + chuột trái
  let dragging = false;
  let spaceHeld = false;
  let lastX = 0, lastY = 0;
  let downX = 0, downY = 0;
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
    drawHover(t.x, t.y);
    // Kéo chuột trái khi không dời camera = đặt liên tục (vẽ đường)
    if (!dragging && (e.buttons & 1) && !spaceHeld) result.onTileClick(t.x, t.y, 0);
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
    // Zoom quanh con trỏ
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
  function drawHover(x: number, y: number) {
    hover.clear();
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
    const { wx, wy } = tileToWorld(x, y);
    hover.poly([wx, wy, wx + HALF_W, wy + HALF_H, wx, wy + TILE_H, wx - HALF_W, wy + HALF_H]).stroke({ color: 0xfff2a8, width: 2 });
  }

  app.ticker.add(() => chunks.flush());

  const result: RenderApp = {
    app,
    onTileClick: () => {},
    applySnapshot(snap) {
      if (snap.full) chunks.setFull(snap.full.terrain, snap.full.elevation);
      if (snap.changed) chunks.applyChanges(snap.changed.offsets, snap.changed.terrain);
    },
    destroy() { app.destroy(); },
  };
  return result;
}
