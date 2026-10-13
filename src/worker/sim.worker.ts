// Vòng lặp mô phỏng trong Web Worker. Nhận Command, gửi Snapshot. Không biết gì về Pixi.
import { applyCommand, createSim, takeSnapshot, tick, type Command, type GameState } from '../sim';
import { TICKS_PER_DAY } from '../sim/state';

export type WorkerIn = { type: 'init'; seed: number } | { type: 'cmd'; cmd: Command };
export type WorkerOut = { type: 'snapshot'; snap: ReturnType<typeof takeSnapshot> };

const BASE_TICKS_PER_SEC = 20; // 1× = 2,5 giây/ngày như Caesar 3 tốc độ thường
let state: GameState | null = null;
let acc = 0;
let last = 0;
let sentFull = false;

function post(full: boolean): void {
  if (!state) return;
  const snap = takeSnapshot(state, full);
  const transfer: ArrayBuffer[] = [];
  if (snap.full) transfer.push(snap.full.terrain.buffer as ArrayBuffer, snap.full.elevation.buffer as ArrayBuffer);
  if (snap.changed) transfer.push(snap.changed.offsets.buffer as ArrayBuffer, snap.changed.terrain.buffer as ArrayBuffer);
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
    state = createSim(m.seed);
    sentFull = false;
    last = performance.now();
    post(true);
    sentFull = true;
    setInterval(() => loop(performance.now()), 1000 / 30);
  } else if (m.type === 'cmd' && state) {
    applyCommand(state, m.cmd);
    if (sentFull) post(false);
  }
};
