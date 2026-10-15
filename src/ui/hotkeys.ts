// QoL: phím tắt (như Caesar 3 / Augustus). Thuần: ánh xạ phím → hành động, main.ts thi hành. Space vẫn là giữ để kéo bản đồ.
import { OVERLAY_MODES } from '../sim/overlay';

export type HotkeyAction =
  | { kind: 'pause' } | { kind: 'speed'; delta: number } | { kind: 'overlay'; index: number } | { kind: 'overlayOff' }
  | { kind: 'minimap' } | { kind: 'names' } | { kind: 'panel'; panel: string } | { kind: 'tool'; tool: string } | { kind: 'undo' } | { kind: 'help' };

export const HOTKEYS: { keys: string; text: string }[] = [
  { keys: '← ↑ → ↓ / W A S D', text: 'dời bản đồ' },
  { keys: 'Lăn chuột', text: 'zoom 0,5× / 1× / 2×' },
  { keys: 'P', text: 'tạm dừng / chạy' },
  { keys: '+ / −', text: 'tăng / giảm tốc độ' },
  { keys: '1 … 9, 0', text: 'lớp phủ (có vấn đề, vùng ngập, nước, lương thực, cháy, sập, tội phạm, độ hấp dẫn, thuế; 0 tắt)' },
  { keys: 'M', text: 'ẩn / hiện bản đồ thu nhỏ' },
  { keys: 'N', text: 'hiện tên công trình' },
  { keys: 'R / H / X / Q', text: 'công cụ đường / lều / phá / xem' },
  { keys: 'T', text: 'bảng Tổng quan' },
  { keys: 'Ctrl+Z', text: 'hoàn tác lần xây gần nhất' },
  { keys: 'Esc', text: 'bỏ đoạn đang kéo, đóng bảng' },
  { keys: 'F1', text: 'bảng Cài đặt và phím tắt' },
];

/** Ánh xạ một phím (KeyboardEvent.key) không kèm Ctrl / Meta → hành động; null = không phải phím tắt. */
export function hotkeyAction(key: string, ctrl: boolean): HotkeyAction | null {
  if (ctrl) return key.toLowerCase() === 'z' ? { kind: 'undo' } : null;
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === 'p') return { kind: 'pause' };
  if (k === '+' || k === '=') return { kind: 'speed', delta: 1 };
  if (k === '-' || k === '_') return { kind: 'speed', delta: -1 };
  if (k >= '1' && k <= '9') { const i = Number(k); return i < OVERLAY_MODES.length ? { kind: 'overlay', index: i } : null; }
  if (k === '0') return { kind: 'overlayOff' };
  if (k === 'm') return { kind: 'minimap' };
  if (k === 'n') return { kind: 'names' };
  if (k === 'r') return { kind: 'tool', tool: 'road' };
  if (k === 'h') return { kind: 'tool', tool: 'house' };
  if (k === 'x') return { kind: 'tool', tool: 'raze' };
  if (k === 'q') return { kind: 'tool', tool: 'inspect' };
  if (k === 't') return { kind: 'panel', panel: 'overview' };
  if (k === 'F1') return { kind: 'help' };
  return null;
}

/** Hướng dời bản đồ theo phím đang giữ (pixel mỗi khung hình). */
export function panVector(held: Set<string>, speed = 12): [number, number] {
  let dx = 0, dy = 0;
  if (held.has('ArrowLeft') || held.has('a')) dx -= speed;
  if (held.has('ArrowRight') || held.has('d')) dx += speed;
  if (held.has('ArrowUp') || held.has('w')) dy -= speed;
  if (held.has('ArrowDown') || held.has('s')) dy += speed;
  return [dx, dy];
}
