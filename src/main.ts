// Nối worker ↔ render ↔ UI (Preact). Render nhận mọi snapshot; UI đọc bản mới nhất ~4 lần/giây.
import { render as renderUI, h } from 'preact';
import { createRenderApp } from './render/app';
import type { Snapshot } from './sim';
import { BUILDING_DEFS, HOUSE_LEVELS } from './sim/buildings/defs';
import { BuildingType } from './sim/state';
import type { WorkerIn, WorkerOut } from './worker/sim.worker';
import { App } from './ui/App';
import { toolSize } from './ui/BuildBar';
import { bridge, fps, hoverText, tool, ui } from './ui/store';

const HINT = 'Chuột phải kéo để dời · lăn để zoom · chuột trái để đặt. Công trình cần đường kề; công trình có người làm cần nhà ở gần để người mộ phu tìm được nhân công.';

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const render = await createRenderApp(canvas);

  const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (m: WorkerIn) => worker.postMessage(m);
  bridge.cmd = (c) => send({ type: 'cmd', cmd: c });
  bridge.select = (x, y) => send({ type: 'select', x, y });

  render.onTileClick = (x, y) => {
    const t = tool.value;
    if (t === 'inspect') bridge.select(x, y);
    else if (t === 'raze') bridge.cmd({ type: 'raze', x, y });
    else bridge.cmd({ type: 'build', kind: t, x, y });
  };
  tool.subscribe((t) => { render.ghostSize = toolSize(t); });

  hoverText.value = HINT;
  render.onTileHover = (x, y) => {
    const b = render.tileBuilding(x, y);
    if (!b) { hoverText.value = HINT; return; }
    hoverText.value = b.type === BuildingType.House ? `${HOUSE_LEVELS[b.level].name} (bậc ${b.level})` : BUILDING_DEFS[b.type].name;
  };

  let latest: Snapshot | null = null;
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    if (e.data.type === 'snapshot') {
      latest = e.data.snap;
      render.applySnapshot(latest);
    }
  };
  setInterval(() => { if (latest) ui.value = latest; }, 250);

  let frames = 0, lastFps = performance.now();
  render.app.ticker.add(() => {
    frames++;
    const now = performance.now();
    if (now - lastFps >= 1000) { fps.value = frames; frames = 0; lastFps = now; }
  });

  renderUI(h(App, null), document.getElementById('ui')!);

  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 20261013);
  send({ type: 'init', seed, demo: params.has('demo') });
  if (params.has('demo')) render.lookAt(40, 60);
}

main();
