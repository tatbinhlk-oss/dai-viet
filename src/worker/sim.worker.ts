// Vòng lặp mô phỏng trong Web Worker. Nhận Command, gửi Snapshot. Không biết gì về Pixi.
import { applyCommand, buildingIdAt, createSim, figureAt, takeSnapshot, tick, type Command, type GameState } from '../sim';
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
  /** chọn công trình tại ô để xem chi tiết; x < 0 = bỏ chọn */
  | { type: 'select'; x: number; y: number }
  /** M6a: lưu game — IndexedDB (khe 'auto' tự lưu mỗi tháng, 'manual' khi bấm Lưu), xuất / nhập file .dvsav */
  | { type: 'save' }
  | { type: 'load'; slot?: 'auto' | 'manual' }
  | { type: 'export' }
  | { type: 'import'; bytes: Uint8Array };
export type WorkerOut =
  | { type: 'snapshot'; snap: ReturnType<typeof takeSnapshot> }
  | { type: 'file'; bytes: Uint8Array; name: string }
  | { type: 'notice'; text: string };

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
async function saveTo(slot: string, quiet = false): Promise<void> {
  if (!state || saving) return;
  saving = true;
  try {
    const bytes = await serialize(state);
    await dbPut(slot, bytes);
    if (!quiet) notice(`Đã lưu (${Math.round(bytes.length / 1024)} KB)`);
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

function post(full: boolean): void {
  if (!state) return;
  if (selectedId && state.buildings[selectedId]?.type === 0) selectedId = 0;
  if (selectedFigureId && state.figures[selectedFigureId]?.type === 0) selectedFigureId = 0;
  const snap = takeSnapshot(state, full, selectedId, selectedFigureId);
  const transfer: ArrayBuffer[] = [];
  if (snap.full) transfer.push(snap.full.terrain.buffer as ArrayBuffer, snap.full.elevation.buffer as ArrayBuffer, snap.full.bType.buffer as ArrayBuffer, snap.full.bLevel.buffer as ArrayBuffer);
  if (snap.changed) transfer.push(snap.changed.offsets.buffer as ArrayBuffer, snap.changed.terrain.buffer as ArrayBuffer, snap.changed.bType.buffer as ArrayBuffer, snap.changed.bLevel.buffer as ArrayBuffer);
  transfer.push(snap.figures.buffer as ArrayBuffer);
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
    applyCommand(state, m.cmd);
    if (sentFull) post(false);
  } else if (m.type === 'cmds' && state) {
    for (const c of m.cmds) applyCommand(state, c);
    if (sentFull) post(false);
  } else if (m.type === 'save') {
    void saveTo('manual');
  } else if (m.type === 'load') {
    void loadFrom(m.slot ?? 'manual');
  } else if (m.type === 'export' && state) {
    void serialize(state).then((bytes) => (self as unknown as Worker).postMessage({ type: 'file', bytes, name: `dai-viet-nam${state!.time.year + 1}.dvsav` } satisfies WorkerOut, [bytes.buffer as ArrayBuffer]));
  } else if (m.type === 'import') {
    void restore(m.bytes).then(() => notice('Đã nhập bản lưu')).catch((e: Error) => notice(`Không nhập được: ${e.message}`));
  }
};
