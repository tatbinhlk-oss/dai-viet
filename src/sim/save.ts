// Lưu game (M6a, thiết kế phần 8): state → JSON (TypedArray mã hóa base64) → gzip (CompressionStream) → IndexedDB / file .dvsav.
// RNG có seed nằm trong state nên nạp lại chạy tiếp y hệt. Set `dirty` không lưu: nạp xong gửi trọn lưới.
import type { GameState } from './state';

export const SAVE_VERSION = 2; // 2 (M6b): cửa sông, mép giặc, màn kế / vua / lũ riêng / đất cấp trong scenario
const TYPED: Record<string, new (b: ArrayBuffer) => ArrayBufferView> = { Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array };

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** JSON thuần (không nén) — dùng cho test và xuất file. */
export function toJson(s: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, state: s }, (key, v: unknown) => {
    if (key === 'dirty') return undefined;
    if (ArrayBuffer.isView(v)) {
      const view = v as ArrayBufferView;
      return { __ta: view.constructor.name, b64: b64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) };
    }
    return v;
  });
}

export function fromJson(json: string): GameState {
  const parsed = JSON.parse(json, (_k, v: unknown) => {
    if (v && typeof v === 'object' && '__ta' in (v as object)) {
      const { __ta, b64: data } = v as { __ta: string; b64: string };
      const bytes = unb64(data);
      const ctor = TYPED[__ta];
      if (!ctor) throw new Error(`Bản lưu có kiểu mảng lạ ${__ta}`);
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return new ctor(buf);
    }
    return v;
  }) as { version: number; state: GameState };
  if (parsed.version > SAVE_VERSION || parsed.version < 1) throw new Error(`Bản lưu phiên bản ${parsed.version}, cần ${SAVE_VERSION}`);
  const s = parsed.state;
  if (parsed.version < 2) {
    s.riverMouthOffset = -1;
    s.enemyEntry = { sea: -1, south: -1, north: -1 };
    Object.assign(s.scenario, { king: '', peakChances: null, promoteTo: 0, next: '', map: '', land: [] });
  }
  if (!s.history) s.history = { pop: [], treasury: [], favor: [] };
  for (const b of s.buildings) if (b.mothballed === undefined) b.mothballed = false;
  if (!Array.isArray(s.eventAt) || s.eventAt.length !== s.events.length) s.eventAt = s.events.map(() => -1); // QoL: bản lưu cũ
  s.dirty = new Set();
  return s;
}

async function pipe(bytes: Uint8Array, mode: 'gzip', dir: 'compress' | 'decompress'): Promise<Uint8Array> {
  const ts = dir === 'compress' ? new CompressionStream(mode) : new DecompressionStream(mode);
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ts);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Gói .dvsav: gzip của JSON. */
export async function serialize(s: GameState): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(toJson(s)), 'gzip', 'compress');
}
export async function deserialize(bytes: Uint8Array): Promise<GameState> {
  return fromJson(new TextDecoder().decode(await pipe(bytes, 'gzip', 'decompress')));
}
