// Nối worker ↔ render ↔ UI (Preact). Render nhận mọi snapshot; UI đọc bản mới nhất ~4 lần/giây.
import { render as renderUI, h } from 'preact';
import { createRenderApp } from './render/app';
import type { Command, Snapshot } from './sim';
import { BUILDING_DEFS, BUILDING_KEYS, economy, HOUSE_LEVELS } from './sim/buildings/defs';
import { BuildingType, isDike } from './sim/state';
import type { WorkerIn, WorkerOut } from './worker/sim.worker';
import { App } from './ui/App';
import { toolSize } from './ui/BuildBar';
import { bridge, briefing, campaign, fps, hoverText, overlay, panel, pushToast, recordWin, saves, savesOpen, settings, showNames, soundOn, startMenu, tool, ui, updateSettings } from './ui/store';
import { pausesGame, toastLevel } from './ui/Toasts';
import { hotkeyAction, panVector } from './ui/hotkeys';
import { OVERLAY_MODES } from './sim/overlay';
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
  bridge.tiles = () => render.tiles();
  bridge.view = () => render.view();
  // QoL: cài đặt — âm lượng, cỡ chữ
  settings.subscribe((st) => { audio.setVolume(st.volume); document.documentElement.style.setProperty('--ui-scale', String(st.uiScale)); render.setMinimap(st.minimap && !startMenu.value); });
  startMenu.subscribe((open) => render.setMinimap(settings.value.minimap && !open));
  // QoL: phím tắt (không bắt khi đang gõ vào ô nhập)
  const held = new Set<string>();
  const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); };
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || ['a', 'd', 'w', 's'].includes(e.key.toLowerCase())) { held.add(e.key.length === 1 ? e.key.toLowerCase() : e.key); e.preventDefault(); return; }
    if (e.key === 'Escape') { panel.value = null; return; }
    const a = hotkeyAction(e.key, e.ctrlKey || e.metaKey);
    if (!a) return;
    e.preventDefault();
    const s = latest;
    switch (a.kind) {
      case 'pause': if (s) bridge.cmd({ type: 'setSpeed', speed: s.speed === 0 ? 1 : 0 }); break;
      case 'speed': if (s) bridge.cmd({ type: 'setSpeed', speed: Math.max(0, Math.min(3, s.speed + a.delta)) as 0 | 1 | 2 | 3 }); break;
      case 'overlay': overlay.value = overlay.value === OVERLAY_MODES[a.index].key ? '' : OVERLAY_MODES[a.index].key; break;
      case 'overlayOff': overlay.value = ''; break;
      case 'minimap': updateSettings({ minimap: !settings.value.minimap }); break;
      case 'names': showNames.value = !showNames.value; break;
      case 'tool': tool.value = a.tool; break;
      case 'panel': panel.value = panel.value === a.panel ? null : (a.panel as typeof panel.value); break;
      case 'help': panel.value = panel.value === 'settings' ? null : 'settings'; break;
      case 'undo': bridge.undo(); break;
      case 'quickSave': bridge.save('quick'); break;
      case 'quickLoad': bridge.load('quick'); break;
      case 'saves': savesOpen.value = !savesOpen.value; break;
    }
  });
  window.addEventListener('keyup', (e) => { held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
  window.addEventListener('blur', () => held.clear());
  render.app.ticker.add(() => { if (held.size) { const [dx, dy] = panVector(held); if (dx || dy) render.pan(dx, dy); } });
  bridge.save = (slot, name) => send({ type: 'save', slot, name });
  bridge.load = (slot) => send({ type: 'load', slot });
  bridge.listSaves = () => send({ type: 'listSaves' });
  bridge.deleteSave = (slot) => send({ type: 'deleteSave', slot });
  bridge.renameSave = (slot, name) => send({ type: 'renameSave', slot, name });
  send({ type: 'listSaves' });
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
  const toolCost = (kind: string): number => { if (kind === 'bridge') return economy.bridgeCost; const ty = BUILDING_KEYS.get(kind); return ty ? BUILDING_DEFS[ty].cost : 0; };
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
    const flat = kind === 'road' || kind === 'bridge';
    const ty = flat ? undefined : BUILDING_KEYS.get(kind);
    if (!flat && ty === undefined) return 'không đặt được';
    if (kind === 'bridge' && latest && latest.treasury < economy.bridgeCost) return `không đủ tiền (cần ${economy.bridgeCost} quan)`;
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
    const name = kind === 'road' ? 'Đường' : kind === 'bridge' ? 'Cầu gỗ' : ty ? BUILDING_DEFS[ty].name : kind;
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
      for (let i = seenEvents; i < ev.length; i++) {
        const k = soundForEvent(ev[i]); if (k) audio.play(k, 2000);
        const lv = toastLevel(ev[i]); // QoL: hộp tin nổi + tự dừng khi tin lớn
        if (lv) { pushToast(ev[i], latest.city.eventAt[i] ?? -1, lv); if (settings.value.pauseOnEvent && pausesGame(ev[i]) && latest.speed > 0) bridge.cmd({ type: 'setSpeed', speed: 0 }); }
      }
      seenEvents = ev.length;
      render.applySnapshot(latest);
      const sel = latest.selected;
      render.setRange(sel && sel.range > 0 ? { x: sel.x, y: sel.y, size: (BUILDING_DEFS[sel.type]?.size ?? 1), range: sel.range } : null);
    } else if (e.data.type === 'file') {
      const url = URL.createObjectURL(new Blob([e.data.bytes as BlobPart], { type: 'application/gzip' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: e.data.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (e.data.type === 'notice') {
      hoverText.value = e.data.text;
    } else if (e.data.type === 'saves') {
      saves.value = e.data.saves;
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
  // QoL: không có tham số nào → menu bắt đầu (Chơi tiếp / Chuỗi màn / Chơi tự do / Nạp); ?sandbox hay ?seed vào thẳng chơi tự do
  const direct = !!scenario || params.has('demo') || stress || params.has('sandbox') || params.has('seed');
  bridge.start = (mode, slot) => { send({ type: 'init', seed, demo: false, rank }); if (mode === 'load' && slot) send({ type: 'load', slot }); };
  if (!direct) { startMenu.value = true; send({ type: 'listSaves' }); }
  else send({ type: 'init', seed, demo: params.has('demo') || stress, scenario, rank, stress });
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
