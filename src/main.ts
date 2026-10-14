// Nối worker ↔ render ↔ UI (Preact). Render nhận mọi snapshot; UI đọc bản mới nhất ~4 lần/giây.
import { render as renderUI, h } from 'preact';
import { createRenderApp } from './render/app';
import type { Snapshot } from './sim';
import { BUILDING_DEFS, HOUSE_LEVELS } from './sim/buildings/defs';
import { BuildingType, isDike } from './sim/state';
import type { WorkerIn, WorkerOut } from './worker/sim.worker';
import { App } from './ui/App';
import { toolSize } from './ui/BuildBar';
import { bridge, campaign, fps, hoverText, overlay, recordWin, showNames, tool, ui } from './ui/store';

const HINT = 'Chuột phải kéo để dời · lăn để zoom · chuột trái để đặt. Công trình cần đường kề; công trình có người làm cần nhà ở gần để người mộ phu tìm được nhân công. Lũ về tháng Sáu: vẽ đê (Đê điều) để đình làng cử phu đi đắp.';

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const render = await createRenderApp(canvas);

  const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (m: WorkerIn) => worker.postMessage(m);
  bridge.cmd = (c) => send({ type: 'cmd', cmd: c });
  bridge.select = (x, y) => send({ type: 'select', x, y });
  bridge.save = () => send({ type: 'save' });
  bridge.load = (slot) => send({ type: 'load', slot });
  bridge.exportFile = () => send({ type: 'export' });
  bridge.importFile = async (file) => send({ type: 'import', bytes: new Uint8Array(await file.arrayBuffer()) });

  render.onTileClick = (x, y) => {
    const t = tool.value;
    if (t === 'inspect') bridge.select(x, y);
    else if (t === 'raze') bridge.cmd({ type: 'raze', x, y });
    else bridge.cmd({ type: 'build', kind: t, x, y });
  };
  tool.subscribe((t) => { render.ghostSize = toolSize(t); });
  overlay.subscribe((on) => render.setOverlay(on));
  showNames.value = render.placeholderArt; // còn hình tạm thì bật (nhãn Pixi chỉ vẽ lên frame có hình thật)
  showNames.subscribe((on) => render.setShowNames(on));

  hoverText.value = HINT;
  render.onTileHover = (x, y) => {
    const b = render.tileBuilding(x, y);
    if (!b) { hoverText.value = HINT; return; }
    hoverText.value = b.type === BuildingType.House ? `${HOUSE_LEVELS[b.level].name} (bậc ${b.level})`
      : isDike(b.type) ? `${BUILDING_DEFS[b.type].name} cao ${b.level & 15}${b.level & 16 ? ' (đang mở)' : ''}` : BUILDING_DEFS[b.type].name;
  };

  let latest: Snapshot | null = null;
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    if (e.data.type === 'snapshot') {
      latest = e.data.snap;
      if (latest.city.scenario.gameOver === 'won') recordWin(latest.city.scenario.key, latest.city.court.rank);
      render.applySnapshot(latest);
    } else if (e.data.type === 'file') {
      const url = URL.createObjectURL(new Blob([e.data.bytes as BlobPart], { type: 'application/gzip' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: e.data.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (e.data.type === 'notice') {
      hoverText.value = e.data.text;
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
  // ?scenario=<khóa> chơi màn đó (M6b: langVenSong, tranLi, sonNam, thangLong); ?demo=1 là màn Sơn Nam với thị trấn mẫu; không có = chơi tự do.
  // Phẩm hàm mang theo chuỗi màn lấy từ localStorage (thắng màn thì ghi), ?rank=n ghi đè để thử.
  const scenario = params.get('scenario') ?? undefined;
  const rank = params.has('rank') ? Number(params.get('rank')) : campaign.value.rank;
  send({ type: 'init', seed, demo: params.has('demo'), scenario, rank });
  if (params.has('demo')) render.lookAt(40, 60);
  else if (scenario && !params.has('look')) {
    // bản đồ thật: đưa camera tới giữa vùng đất cấp (hoặc cửa ngõ) khi có snapshot đầu
    const once = (e: MessageEvent<WorkerOut>) => { if (e.data.type === 'snapshot') { const [x, y] = e.data.snap.city.scenario.start; render.lookAt(x, y); worker.removeEventListener('message', once); } };
    worker.addEventListener('message', once);
  }
  const look = params.get('look')?.split(',').map(Number); // ?look=7,70 đưa camera tới ô (x, y)
  if (look && look.length === 2 && look.every((v) => Number.isFinite(v))) render.lookAt(look[0], look[1]);
}

main();
