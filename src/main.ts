// Nối worker ↔ render ↔ ui. UI của M1 là DOM thuần; bảng điều khiển đầy đủ (Preact) vào ở M2.
import { createRenderApp } from './render/app';
import type { Command, Snapshot } from './sim';
import type { WorkerIn, WorkerOut } from './worker/sim.worker';

const MONTHS = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Một', 'Chạp'];

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const render = await createRenderApp(canvas);

  const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (m: WorkerIn) => worker.postMessage(m);
  const cmd = (c: Command) => send({ type: 'cmd', cmd: c });

  let tool: 'road' | 'house' | 'raze' = 'road';
  render.onTileClick = (x, y) => {
    if (tool === 'raze') cmd({ type: 'raze', x, y });
    else cmd({ type: 'build', kind: tool, x, y });
  };

  const dateEl = document.getElementById('date')!;
  const fpsEl = document.getElementById('fps')!;
  let latest: Snapshot | null = null;
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    if (e.data.type === 'snapshot') {
      latest = e.data.snap;
      render.applySnapshot(latest);
    }
  };

  // Nút tốc độ và công cụ
  document.querySelectorAll<HTMLButtonElement>('#ui button').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.speed !== undefined) {
        cmd({ type: 'setSpeed', speed: Number(b.dataset.speed) as 0 | 1 | 2 | 3 });
        document.querySelectorAll('#ui button[data-speed]').forEach((x) => x.classList.toggle('active', x === b));
      } else if (b.dataset.tool) {
        tool = b.dataset.tool as typeof tool;
        document.querySelectorAll('#ui button[data-tool]').forEach((x) => x.classList.toggle('active', x === b));
      }
    });
  });

  // Nhãn ngày tháng và FPS
  let frames = 0, lastFps = performance.now();
  render.app.ticker.add(() => {
    frames++;
    const now = performance.now();
    if (now - lastFps >= 1000) {
      fpsEl.textContent = `${frames} fps`;
      frames = 0; lastFps = now;
    }
    if (latest) {
      const t = latest.time;
      dateEl.textContent = `Ngày ${t.day + 1} tháng ${MONTHS[t.month]} · năm ${t.year + 1} · ${latest.treasury} quan`;
    }
  });

  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 20261013);
  send({ type: 'init', seed });
}

main();
