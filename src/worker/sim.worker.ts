// Vòng lặp mô phỏng trong Web Worker. Nhận Command, gửi Snapshot. Không biết gì về Pixi.
import { applyCommand, applyUndo, buildingIdAt, createSim, figureAt, placementError, takeSnapshot, tick, undoAfter, undoBefore, type Command, type GameState, type OverlayMode, type UndoRecord } from '../sim';
import { TICKS_PER_DAY } from '../sim/state';
import { buildCourtTown, buildStressTown, demoPriorities } from '../sim/scenario/demo';
import { createScenario, SCENARIOS } from '../sim/scenario/loader';
import { deserialize, serialize } from '../sim/save';

export type WorkerIn =
  /** demo: bản đồ phẳng + thị trấn mẫu của test cổng M3/M4/M5; scenario: khóa màn chơi (M5), không có = chơi tự do */
  | { type: 'init'; seed: number; demo?: boolean; scenario?: string; rank?: number; stress?: boolean }
  | { type: 'cmd'; cmd: Command }
  /** nhiều lệnh một lúc (kéo vẽ đoạn đường / đê): một snapshot sau tất cả */
  | { type: 'cmds'; cmds: Command[] }
  /** QoL: bật lớp phủ (sim tính mỗi snapshot), '' = tắt */
  | { type: 'overlay'; mode: OverlayMode }
  /** QoL: hoàn tác lần xây gần nhất (trong ngày) */
  | { type: 'undo' }
  /** chọn công trình tại ô để xem chi tiết; x < 0 = bỏ chọn */
  | { type: 'select'; x: number; y: number }
  /** M6a: lưu game — IndexedDB (khe 'auto' tự lưu mỗi tháng, 'manual' khi bấm Lưu), xuất / nhập file .dvsav */
  /** QoL: nhiều khe lưu có tên ('auto' tự lưu, 'quick' nút Lưu nhanh / F5, 'slot1'…'slot8'); listSaves → danh sách */
  | { type: 'save'; slot?: string; name?: string }
  | { type: 'load'; slot?: string }
  | { type: 'listSaves' }
  | { type: 'export' }
  | { type: 'import'; bytes: Uint8Array };
export type WorkerOut =
  | { type: 'snapshot'; snap: ReturnType<typeof takeSnapshot> }
  | { type: 'file'; bytes: Uint8Array; name: string }
  | { type: 'notice'; text: string }
  | { type: 'saves'; saves: SaveMeta[] };

export interface SaveMeta { slot: string; name: string; savedAt: number; year: number; month: number; scenario: string; population: number; bytes: number }
const INDEX_KEY = 'index';
async function readIndex(): Promise<SaveMeta[]> {
  try { const raw = await dbGet(INDEX_KEY); return raw ? (JSON.parse(new TextDecoder().decode(raw)) as SaveMeta[]) : []; } catch { return []; }
}
async function writeIndex(list: SaveMeta[]): Promise<void> { await dbPut(INDEX_KEY, new TextEncoder().encode(JSON.stringify(list))); }
async function postSaves(): Promise<void> { (self as unknown as Worker).postMessage({ type: 'saves', saves: await readIndex() } satisfies WorkerOut); }

// ---------- M6a: lưu game ----------
const DB = 'dai-viet', STORE = 'saves';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(key: string, bytes: Uint8Array): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(bytes, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}
async function dbGet(key: string): Promise<Uint8Array | undefined> {
  const db = await openDb();
  const v = await new Promise<Uint8Array | undefined>((resolve, reject) => { const req = db.transaction(STORE).objectStore(STORE).get(key); req.onsuccess = () => resolve(req.result as Uint8Array | undefined); req.onerror = () => reject(req.error); });
  db.close();
  return v;
}
const notice = (text: string) => (self as unknown as Worker).postMessage({ type: 'notice', text } satisfies WorkerOut);
let saving = false;
async function saveTo(slot: string, quiet = false, name?: string): Promise<void> {
  if (!state || saving) return;
  saving = true;
  try {
    const bytes = await serialize(state);
    await dbPut(slot, bytes);
    const list = (await readIndex()).filter((m) => m.slot !== slot);
    const old = (await readIndex()).find((m) => m.slot === slot);
    list.push({ slot, name: name ?? old?.name ?? (slot === 'auto' ? 'Tự lưu' : slot === 'quick' ? 'Lưu nhanh' : `Khe ${slot.replace('slot', '')}`), savedAt: Date.now(), year: state.time.year, month: state.time.month, scenario: state.scenario.name, population: state.population, bytes: bytes.length });
    await writeIndex(list);
    if (!quiet) notice(`Đã lưu (${Math.round(bytes.length / 1024)} KB)`);
    await postSaves();
  } catch (e) { notice(`Không lưu được: ${(e as Error).message}`); }
  saving = false;
}
async function loadFrom(slot: string): Promise<void> {
  try {
    const bytes = await dbGet(slot);
    if (!bytes) { notice(slot === 'auto' ? 'Chưa có bản tự lưu' : 'Chưa có bản lưu'); return; }
    await restore(bytes);
    notice('Đã nạp bản lưu');
  } catch (e) { notice(`Không nạp được: ${(e as Error).message}`); }
}
async function restore(bytes: Uint8Array): Promise<void> {
  state = await deserialize(bytes);
  selectedId = 0;
  selectedFigureId = 0;
  lastAutosaveMonth = state.time.year * 12 + state.time.month;
  post(true);
}
let lastAutosaveMonth = -1;

const BASE_TICKS_PER_SEC = 20; // 1× = 2,5 giây/ngày như Caesar 3 tốc độ thường
let state: GameState | null = null;
let acc = 0;
let last = 0;
let sentFull = false;
let selectedId = 0;
let selectedFigureId = 0; // M6c: walker đang chọn (ưu tiên công trình nếu ô có công trình)
let overlayMode: OverlayMode = '';
let undo: UndoRecord | null = null; // QoL: lần xây gần nhất, hết hạn sau một ngày game
const undoable = (): boolean => !!undo && !!state && state.time.totalDays - undo.day < 1;
/** chạy một gói lệnh xây và ghi lại để hoàn tác */
function runBuild(cmds: Command[]): void {
  if (!state) return;
  const before = undoBefore(state);
  for (const c of cmds) applyCommand(state, c);
  undo = undoAfter(state, before) ?? undo;
}

function post(full: boolean): void {
  if (!state) return;
  if (selectedId && state.buildings[selectedId]?.type === 0) selectedId = 0;
  if (selectedFigureId && state.figures[selectedFigureId]?.type === 0) selectedFigureId = 0;
  const snap = takeSnapshot(state, full, selectedId, selectedFigureId, overlayMode);
  snap.undoable = undoable();
  const transfer: ArrayBuffer[] = [];
  if (snap.full) transfer.push(snap.full.terrain.buffer as ArrayBuffer, snap.full.elevation.buffer as ArrayBuffer, snap.full.bType.buffer as ArrayBuffer, snap.full.bLevel.buffer as ArrayBuffer);
  if (snap.changed) transfer.push(snap.changed.offsets.buffer as ArrayBuffer, snap.changed.terrain.buffer as ArrayBuffer, snap.changed.bType.buffer as ArrayBuffer, snap.changed.bLevel.buffer as ArrayBuffer);
  transfer.push(snap.figures.buffer as ArrayBuffer, snap.problems.buffer as ArrayBuffer);
  if (snap.overlay) transfer.push(snap.overlay.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ type: 'snapshot', snap } satisfies WorkerOut, transfer);
}

function loop(now: number): void {
  if (!state) return;
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const speedMul = [0, 1, 2, 4][state.speed] ?? 1;
  acc += dt * BASE_TICKS_PER_SEC * speedMul;
  let n = 0;
  while (acc >= 1 && n < TICKS_PER_DAY * 4) {
    tick(state);
    acc -= 1;
    n++;
  }
  post(false);
  // tự lưu mỗi tháng game như Julius
  const month = state.time.year * 12 + state.time.month;
  if (month !== lastAutosaveMonth && state.time.day === 0) { lastAutosaveMonth = month; void saveTo('auto', true); }
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'init') {
    const key = m.scenario && SCENARIOS[m.scenario] ? m.scenario : m.demo ? 'sonNam' : '';
    state = key ? createScenario(key, m.seed, !!m.demo || undefined, m.rank ?? 0) : createSim(m.seed, { flat: !!m.demo });
    if (m.demo) { buildCourtTown(state); demoPriorities(state); }
    if (m.stress) { if (!m.demo) { buildCourtTown(state); demoPriorities(state); } buildStressTown(state); } // M6c: thử tải 1.500+ công trình, ~800 walker
    sentFull = false;
    last = performance.now();
    lastAutosaveMonth = 0;
    post(true);
    sentFull = true;
    setInterval(() => loop(performance.now()), 1000 / 30);
  } else if (m.type === 'select' && state) {
    selectedId = m.x < 0 ? 0 : buildingIdAt(state, m.x, m.y);
    selectedFigureId = m.x < 0 || selectedId ? 0 : (figureAt(state, m.x, m.y)?.id ?? 0);
    if (sentFull) post(false);
  } else if (m.type === 'cmd' && state) {
    if (m.cmd.type === 'build') {
      const why = placementError(state, m.cmd.kind, m.cmd.x, m.cmd.y);
      if (why) notice(`Không đặt được: ${why}`); else runBuild([m.cmd]);
    } else applyCommand(state, m.cmd);
    if (sentFull) post(false);
  } else if (m.type === 'undo' && state) {
    if (undoable() && undo) { const n = applyUndo(state, undo); notice(n ? `Đã hoàn tác ${n} chỗ` : 'Không còn gì để hoàn tác'); }
    undo = null;
    if (sentFull) post(false);
  } else if (m.type === 'overlay') {
    overlayMode = m.mode;
    if (state && sentFull) post(false);
  } else if (m.type === 'cmds' && state) {
    const builds = m.cmds.filter((c): c is Extract<Command, { type: 'build' }> => c.type === 'build');
    for (const c of m.cmds) if (c.type !== 'build') applyCommand(state, c);
    if (builds.length === 1) { const why = placementError(state, builds[0].kind, builds[0].x, builds[0].y); if (why) notice(`Không đặt được: ${why}`); else runBuild(builds); }
    else if (builds.length) runBuild(builds); // kéo đoạn / vùng: ô không đặt được thì bỏ qua lặng lẽ
    if (sentFull) post(false);
  } else if (m.type === 'save') {
    void saveTo(m.slot ?? 'quick', false, m.name);
  } else if (m.type === 'load') {
    void loadFrom(m.slot ?? 'quick');
  } else if (m.type === 'listSaves') {
    void postSaves();
  } else if (m.type === 'export' && state) {
    void serialize(state).then((bytes) => (self as unknown as Worker).postMessage({ type: 'file', bytes, name: `dai-viet-nam${state!.time.year + 1}.dvsav` } satisfies WorkerOut, [bytes.buffer as ArrayBuffer]));
  } else if (m.type === 'import') {
    void restore(m.bytes).then(() => notice('Đã nhập bản lưu')).catch((e: Error) => notice(`Không nhập được: ${e.message}`));
  }
};
