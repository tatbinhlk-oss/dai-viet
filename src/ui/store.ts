// Trạng thái UI (Preact signals). UI chỉ đọc snapshot và gửi lệnh qua `bridge` — không chạm state sim.
import { signal } from '@preact/signals';
import type { Command, Snapshot } from '../sim';

export type Panel = 'labor' | 'finance' | 'mood' | 'storage' | 'flood' | 'court' | 'worship' | 'ratings' | 'trade' | null;

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
/** M6-0: nhãn tên Pixi đè lên công trình (mặc định bật khi còn hình tạm, tắt khi đã có hình thật) */
export const showNames = signal(false);

export const bridge = {
  cmd: (_c: Command) => {},
  select: (_x: number, _y: number) => {},
  // M6a: lưu game
  save: () => {},
  load: (_slot: 'auto' | 'manual') => {},
  exportFile: () => {},
  importFile: async (_f: File) => {},
};
