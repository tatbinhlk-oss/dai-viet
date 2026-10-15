// Trạng thái UI (Preact signals). UI chỉ đọc snapshot và gửi lệnh qua `bridge` — không chạm state sim.
import { signal } from '@preact/signals';
import type { Command, OverlayMode, Snapshot } from '../sim';

export type Panel = 'labor' | 'finance' | 'mood' | 'storage' | 'flood' | 'court' | 'worship' | 'ratings' | 'trade' | null;

/** Snapshot mới nhất, cập nhật ~4 lần/giây cho bảng biểu (render vẫn nhận mọi snapshot). */
export const ui = signal<Snapshot | null>(null);
export const fps = signal(0);
/** 'road' | 'raze' | 'inspect' | khóa công trình trong buildings.json */
export const tool = signal<string>('road');
export const openGroup = signal<string | null>(null);
export const panel = signal<Panel>(null);
export const hoverText = signal('');
/** Lớp phủ đang bật (sim/overlay.ts): '' tắt, 'flood' vùng ngập (M4), còn lại QoL */
export const overlay = signal<OverlayMode>('');
/** M6-0: nhãn tên Pixi đè lên công trình (mặc định bật khi còn hình tạm, tắt khi đã có hình thật) */
export const showNames = signal(false);

/** M6b: tiến độ chuỗi màn (localStorage): phẩm hàm mang sang màn kế và các màn đã thắng. */
export interface Campaign { rank: number; won: string[] }
const CAMPAIGN_KEY = 'dai-viet.campaign';
function loadCampaign(): Campaign {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CAMPAIGN_KEY) : null;
    if (raw) { const c = JSON.parse(raw) as Partial<Campaign>; return { rank: Number(c.rank) || 0, won: Array.isArray(c.won) ? c.won.filter((k) => typeof k === 'string') : [] }; }
  } catch { /* localStorage bị chặn: coi như chưa chơi */ }
  return { rank: 0, won: [] };
}
export const campaign = signal<Campaign>(loadCampaign());
/** Ghi thắng màn: phẩm hàm mới (từ snapshot) và khóa màn; gọi nhiều lần cũng chỉ ghi một. */
export function recordWin(key: string, rank: number): void {
  const c = campaign.value;
  if (c.won.includes(key) && c.rank >= rank) return;
  const next = { rank: Math.max(c.rank, rank), won: c.won.includes(key) ? c.won : [...c.won, key] };
  campaign.value = next;
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next)); } catch { /* bỏ qua */ }
}
/** Xóa tiến độ chuỗi màn (nút trong hộp chọn màn). */
export function resetCampaign(): void {
  campaign.value = { rank: 0, won: [] };
  try { localStorage.removeItem(CAMPAIGN_KEY); } catch { /* bỏ qua */ }
}

/** M6c: âm thanh bật / tắt (nút 🔊) */
export const soundOn = signal(true);

export const bridge = {
  cmd: (_c: Command) => {},
  select: (_x: number, _y: number) => {},
  // M6a: lưu game
  save: () => {},
  load: (_slot: 'auto' | 'manual') => {},
  exportFile: () => {},
  importFile: async (_f: File) => {},
};
