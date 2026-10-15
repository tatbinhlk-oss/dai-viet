// Nối worker ↔ render ↔ UI (Preact). Render nhận mọi snapshot; UI đọc bản mới nhất ~4 lần/giây.
import { render as renderUI, h } from 'preact';
import { createRenderApp } from './render/app';
import type { Command, Snapshot } from './sim';
import { BUILDING_DEFS, BUILDING_KEYS, HOUSE_LEVELS } from './sim/buildings/defs';
import { BuildingType, isDike } from './sim/state';
import type { WorkerIn, WorkerOut } from './worker/sim.worker';
import { App } from './ui/App';
import { toolSize } from './ui/BuildBar';
import { bridge, briefing, campaign, fps, hoverText, overlay, recordWin, showNames, soundOn, tool, ui } from './ui/store';
import { Audio, soundForEvent } from './render/audio';
import { LINE_TOOLS, RECT_TOOLS } from './render/line';
import { placementCheck } from './sim';
import { GRID_SIZE, T_BUILDING, T_ROAD } from './sim/map/grid';
import { registerSW } from 'virtual:pwa-register';

const HINT = 'Chuột phải kéo để dời · lăn để zoom · chuột trái để đặt; đường / đê / thành: bấm giữ rồi kéo, thả để xây. Công trình cần đường kề; công trình có người làm cần nhà ở gần để người mộ phu tìm được nhân công. Lũ về tháng Sáu: vẽ đê (Đê điều) để đình làng cử phu đi đắp.';

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const render = await createRenderApp(canvas);

  const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (m: WorkerIn) => worker.postMessage(m);
  // M6c: service worker (PWA, chơi offline) và âm thanh
  registerSW({ immediate: true });
  const audio = new Audio(import.meta.env.BASE_URL);
  soundOn.value = !audio.muted;
  soundOn.subscribe((on) => audio.setMuted(!on));
  let seenEvents = 0;

  bridge.cmd = (c) => { send({ type: 'cmd', cmd: c }); if (c.type === 'build') audio.play('click'); else if (c.type === 'raze') audio.play('raze'); };
  bridge.select = (x, y) => send({ type: 'select', x, y });
  bridge.undo = () => send({ type: 'undo' });
  bridge.lookAt = (x, y) => render.lookAt(x, y);
  window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); bridge.undo(); } });
  bridge.save = () => send({ type: 'save' });
  bridge.load = (slot) => send({ type: 'load', slot });
  bridge.exportFile = () => send({ type: 'export' });
  bridge.importFile = async (file) => send({ type: 'import', bytes: new Uint8Array(await file.arrayBuffer()) });

  // QoL: phá công trình đắt tiền thì hỏi lại; gửi một gói lệnh phá
  const razeTiles = (tiles: [number, number][]) => {
    let costly = 0;
    for (const [x, y] of tiles) { const b = render.tileBuilding(x, y); if (b && b.type !== BuildingType.House && (BUILDING_DEFS[b.type].cost ?? 0) >= 150) costly++; }
    if (costly && !confirm(`Phá ${costly} công trình đắt tiền (≥ 150 quan)? Không hoàn lại tiền.`)) return;
    send({ type: 'cmds', cmds: tiles.map(([x, y]) => ({ type: 'raze', x, y }) as Command) });
    audio.play('raze');
  };
  render.onTileClick = (x, y) => {
    const t = tool.value;
    if (t === 'inspect') bridge.select(x, y);
    else if (t === 'raze') razeTiles([[x, y]]);
    else bridge.cmd({ type: 'build', kind: t, x, y });
  };
  // kéo vẽ đoạn (đường, đê, cống, thành) hoặc vùng (lều, vườn, phá): thả chuột mới làm, gửi một gói lệnh
  render.onLine = (tiles) => {
    const kind = tool.value;
    if (kind === 'raze') { razeTiles(tiles); return; }
    if (!LINE_TOOLS.has(kind) && !RECT_TOOLS.has(kind)) return;
    send({ type: 'cmds', cmds: tiles.map(([x, y]) => ({ type: 'build', kind, x, y }) as Command) });
    audio.play('click');
  };
  const toolCost = (kind: string): number => { const ty = BUILDING_KEYS.get(kind); return ty ? BUILDING_DEFS[ty].cost : 0; };
  render.onLinePreview = (n) => {
    if (n > 0) { const c = toolCost(tool.value) * n; hoverText.value = `${n} ô${c ? ` · ${c} quan` : ''}${latest && c > latest.treasury ? ' — không đủ tiền' : ''} — thả chuột để ${tool.value === 'raze' ? 'phá' : 'xây'}, Esc để bỏ`; }
    else if (hoverText.value.endsWith('Esc để bỏ')) hoverText.value = HINT;
  };
  // QoL: khung đặt xanh / đỏ và lý do — kiểm ngay trên lưới render, không hỏi worker
  render.validate = (x, y) => {
    const kind = tool.value;
    if (kind === 'inspect') return null;
    const v = render.tiles();
    if (kind === 'raze') return v.terrain[y * GRID_SIZE + x] & (T_ROAD | T_BUILDING) ? null : 'không có gì để phá';
    const ty = kind === 'road' ? undefined : BUILDING_KEYS.get(kind);
    if (kind !== 'road' && ty === undefined) return 'không đặt được';
    if (ty !== undefined && latest) {
      const def = BUILDING_DEFS[ty];
      if (def.rank > latest.city.court.rank) return `cần phẩm hàm ${latest.city.court.salaryNames[def.rank]}`;
      if (def.cost > 0 && latest.treasury < def.cost) return `không đủ tiền (cần ${def.cost} quan)`;
    }
    return placementCheck(v, kind, ty, x, y);
  };
  tool.subscribe((t) => { render.ghostSize = toolSize(t); render.lineTool = LINE_TOOLS.has(t); render.rectTool = RECT_TOOLS.has(t); });
  overlay.subscribe((mode) => { render.setOverlay(mode); send({ type: 'overlay', mode }); });
  showNames.value = render.placeholderArt; // còn hình tạm thì bật (nhãn Pixi chỉ vẽ lên frame có hình thật)
  showNames.subscribe((on) => render.setShowNames(on));

  hoverText.value = HINT;
  render.onTileHover = (x, y) => {
    const b = render.tileBuilding(x, y);
    const under = !b ? '' : b.type === BuildingType.House ? `${HOUSE_LEVELS[b.level].name} (bậc ${b.level})`
      : isDike(b.type) ? `${BUILDING_DEFS[b.type].name} cao ${b.level & 15}${b.level & 16 ? ' (đang mở)' : ''}` : BUILDING_DEFS[b.type].name;
    const kind = tool.value;
    if (kind === 'inspect' || kind === 'raze') { hoverText.value = under || HINT; return; }
    // đang cầm công cụ xây: tên, giá, lý do không đặt được
    const ty = BUILDING_KEYS.get(kind);
    const name = kind === 'road' ? 'Đường' : ty ? BUILDING_DEFS[ty].name : kind;
    const cost = toolCost(kind);
    const why = render.validate(x, y);
    hoverText.value = `${name}${cost ? ` · ${cost} quan` : ''}${why ? ` — ${why}` : ''}${under ? ` (ô: ${under})` : ''}`;
  };

  let latest: Snapshot | null = null;
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    if (e.data.type === 'snapshot') {
      latest = e.data.snap;
      if (latest.city.scenario.gameOver === 'won') recordWin(latest.city.scenario.key, latest.city.court.rank);
      // sự kiện mới → tiếng (danh sách sự kiện bị cắt bớt theo tháng nên chỉ nhìn phần đuôi)
      const ev = latest.city.events;
      if (ev.length < seenEvents) seenEvents = ev.length; // vừa cắt bớt: bỏ qua, không phát lại
      for (let i = seenEvents; i < ev.length; i++) { const k = soundForEvent(ev[i]); if (k) audio.play(k, 2000); }
      seenEvents = ev.length;
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
  // ?stress=1: thị trấn mẫu + dải phố thử tải (M6c, ~1.650 công trình, ~800 walker) trên bản đồ phẳng
  const stress = params.has('stress');
  send({ type: 'init', seed, demo: params.has('demo') || stress, scenario, rank, stress });
  if (scenario && !params.has('demo') && !stress) { send({ type: 'cmd', cmd: { type: 'setSpeed', speed: 0 } }); briefing.value = true; } // QoL: màn giới thiệu nhiệm vụ, bấm Bắt đầu mới chạy
  if (stress) render.lookAt(100, 90);
  else if (params.has('demo')) render.lookAt(40, 60);
  else if (scenario && !params.has('look')) {
    // bản đồ thật: đưa camera tới giữa vùng đất cấp (hoặc cửa ngõ) khi có snapshot đầu
    const once = (e: MessageEvent<WorkerOut>) => { if (e.data.type === 'snapshot') { const [x, y] = e.data.snap.city.scenario.start; render.lookAt(x, y); worker.removeEventListener('message', once); } };
    worker.addEventListener('message', once);
  }
  const look = params.get('look')?.split(',').map(Number); // ?look=7,70 đưa camera tới ô (x, y)
  if (look && look.length === 2 && look.every((v) => Number.isFinite(v))) render.lookAt(look[0], look[1]);
}

main();
