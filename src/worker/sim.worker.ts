// Vòng lặp mô phỏng trong Web Worker. Nhận Command, gửi Snapshot. Không biết gì về Pixi.
import { applyCommand, buildingIdAt, createSim, takeSnapshot, tick, type Command, type GameState } from '../sim';
import { TICKS_PER_DAY } from '../sim/state';
import { buildTown, demoPriorities } from '../sim/scenario/demo';

export type WorkerIn =
  /** demo: bản đồ phẳng + thị trấn mẫu của test cổng M3 */
  | { type: 'init'; seed: number; demo?: boolean }
  | { type: 'cmd'; cmd: Command }
  /** chọn công trình tại ô để xem chi tiết; x < 0 = bỏ chọn */
  | { type: 'select'; x: number; y: number };
export type WorkerOut = { type: 'snapshot'; snap: ReturnType<typeof takeSnapshot> };

const BASE_TICKS_PER_SEC = 20; // 1× = 2,5 giây/ngày như Caesar 3 tốc độ thường
let state: GameState | null = null;
let acc = 0;
let last = 0;
let sentFull = false;
let selectedId = 0;

function post(full: boolean): void {
  if (!state) return;
  if (selectedId && state.buildings[selectedId]?.type === 0) selectedId = 0;
  const snap = takeSnapshot(state, full, selectedId);
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
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'init') {
    state = createSim(m.seed, { flat: !!m.demo });
    if (m.demo) { state.treasury = 8000; buildTown(state); demoPriorities(state); }
    sentFull = false;
    last = performance.now();
    post(true);
    sentFull = true;
    setInterval(() => loop(performance.now()), 1000 / 30);
  } else if (m.type === 'select' && state) {
    selectedId = m.x < 0 ? 0 : buildingIdAt(state, m.x, m.y);
    if (sentFull) post(false);
  } else if (m.type === 'cmd' && state) {
    applyCommand(state, m.cmd);
    if (sentFull) post(false);
  }
};
