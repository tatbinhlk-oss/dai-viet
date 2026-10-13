// Nối worker ↔ render ↔ ui. UI vẫn là DOM thuần; bảng cố vấn (Preact) vào ở M3.
import { createRenderApp } from './render/app';
import type { Command, Snapshot } from './sim';
import type { BuildKind } from './sim/commands';
import { BUILDING_DEFS, HOUSE_LEVELS } from './sim/buildings/defs';
import { BuildingType } from './sim/state';
import type { WorkerIn, WorkerOut } from './worker/sim.worker';

const MONTHS = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Một', 'Chạp'];
const TOOL_SIZE: Record<BuildKind | 'raze', number> = { road: 1, house: 1, paddy: 2, granary: 3, market: 2, well: 1, dinh: 2, raze: 1 };

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const render = await createRenderApp(canvas);

  const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (m: WorkerIn) => worker.postMessage(m);
  const cmd = (c: Command) => send({ type: 'cmd', cmd: c });

  let tool: BuildKind | 'raze' = 'road';
  render.onTileClick = (x, y) => {
    if (tool === 'raze') cmd({ type: 'raze', x, y });
    else cmd({ type: 'build', kind: tool, x, y });
  };

  const dateEl = document.getElementById('date')!;
  const popEl = document.getElementById('pop')!;
  const fpsEl = document.getElementById('fps')!;
  const statusEl = document.getElementById('status')!;
  const HINT = 'Chuột phải kéo để dời · lăn để zoom · chuột trái để đặt. Ruộng chỉ đặt trên bãi bồi (màu nhạt ven sông); công trình cần đường kề mới hoạt động.';
  statusEl.textContent = HINT;

  render.onTileHover = (x, y) => {
    const b = render.tileBuilding(x, y);
    if (!b) { statusEl.textContent = HINT; return; }
    const def = BUILDING_DEFS[b.type as BuildingType];
    statusEl.textContent = b.type === BuildingType.House ? `${HOUSE_LEVELS[b.level].name} (bậc ${b.level})` : def.name;
  };

  let latest: Snapshot | null = null;
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    if (e.data.type === 'snapshot') {
      latest = e.data.snap;
      render.applySnapshot(latest);
    }
  };

  document.querySelectorAll<HTMLButtonElement>('#ui button').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.speed !== undefined) {
        cmd({ type: 'setSpeed', speed: Number(b.dataset.speed) as 0 | 1 | 2 | 3 });
        document.querySelectorAll('#ui button[data-speed]').forEach((x) => x.classList.toggle('active', x === b));
      } else if (b.dataset.tool) {
        tool = b.dataset.tool as typeof tool;
        render.ghostSize = TOOL_SIZE[tool];
        document.querySelectorAll('#ui button[data-tool]').forEach((x) => x.classList.toggle('active', x === b));
      }
    });
  });

  let frames = 0, lastFps = performance.now();
  render.app.ticker.add(() => {
    frames++;
    const now = performance.now();
    if (now - lastFps >= 1000) { fpsEl.textContent = `${frames} fps`; frames = 0; lastFps = now; }
    if (latest) {
      const t = latest.time;
      dateEl.textContent = `Ngày ${t.day + 1} tháng ${MONTHS[t.month]} · năm ${t.year + 1} · ${latest.treasury} quan`;
      popEl.textContent = `${latest.population} dân / ${latest.housingCapacity} chỗ`;
    }
  });

  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 20261013);
  send({ type: 'init', seed });
}

main();
