// Trạng thái UI (Preact signals). UI chỉ đọc snapshot và gửi lệnh qua `bridge` — không chạm state sim.
import { signal } from '@preact/signals';
import type { Command, Snapshot } from '../sim';

export type Panel = 'labor' | 'finance' | 'mood' | 'storage' | 'flood' | null;

/** Snapshot mới nhất, cập nhật ~4 lần/giây cho bảng biểu (render vẫn nhận mọi snapshot). */
export const ui = signal<Snapshot | null>(null);
export const fps = signal(0);
/** 'road' | 'raze' | 'inspect' | khóa công trình trong buildings.json */
export const tool = signal<string>('road');
export const openGroup = signal<string | null>(null);
export const panel = signal<Panel>(null);
export const hoverText = signal('');
/** M4: lớp phủ vùng ngập (bãi bồi chưa có đê che tô xanh, có đê che tô lục) */
export const overlay = signal(false);

export const bridge = {
  cmd: (_c: Command) => {},
  select: (_x: number, _y: number) => {},
};
