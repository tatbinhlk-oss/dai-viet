// Trạng thái UI (Preact signals). UI chỉ đọc snapshot và gửi lệnh qua `bridge` — không chạm state sim.
import { signal } from '@preact/signals';
import type { Command, OverlayMode, Snapshot } from '../sim';
import type { SaveMeta } from '../worker/sim.worker';

export type Panel = 'settings' | 'overview' | 'labor' | 'finance' | 'mood' | 'storage' | 'flood' | 'court' | 'worship' | 'ratings' | 'trade' | null;

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

/** QoL: cài đặt (localStorage): âm lượng, cỡ chữ, bản đồ thu nhỏ */
export interface Settings { volume: number; uiScale: number; minimap: boolean; /** tự tạm dừng khi có tin quan trọng (giặc, vỡ đê, chiếu chỉ, cách chức) */ pauseOnEvent: boolean }
const SETTINGS_KEY = 'dai-viet.settings';
function loadSettings(): Settings {
  const d: Settings = { volume: 0.8, uiScale: 1, minimap: true, pauseOnEvent: true };
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) Object.assign(d, JSON.parse(raw) as Partial<Settings>); } catch { /* bỏ qua */ }
  return d;
}
export const settings = signal<Settings>(loadSettings());
export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value)); } catch { /* bỏ qua */ }
}
/** QoL: danh sách khe lưu (worker gửi) và hộp Lưu / Nạp */
export const saves = signal<SaveMeta[]>([]);
export const savesOpen = signal(false);
/** QoL: hộp tin nổi (giặc tới, vỡ đê, chiếu chỉ, cách chức…) */
export interface Toast { id: number; text: string; at: number; level: 'bad' | 'warn' | 'info'; born: number }
export const toasts = signal<Toast[]>([]);
let toastSeq = 0;
export function pushToast(text: string, at: number, level: Toast['level']): void {
  toasts.value = [...toasts.value.slice(-4), { id: ++toastSeq, text, at, level, born: Date.now() }];
}
export function dismissToast(id: number): void { toasts.value = toasts.value.filter((t) => t.id !== id); }
/** QoL: menu bắt đầu đang mở (chưa vào bản đồ) */
export const startMenu = signal(false);
/** QoL: màn giới thiệu nhiệm vụ đang mở */
export const briefing = signal(false);
/** M6c: âm thanh bật / tắt (nút 🔊) */
export const soundOn = signal(true);

export const bridge = {
  cmd: (_c: Command) => {},
  select: (_x: number, _y: number) => {},
  /** QoL: hoàn tác lần xây gần nhất */
  undo: () => {},
  /** QoL: đưa camera tới ô; lưới render cho bản đồ thu nhỏ; vùng đang nhìn */
  lookAt: (_x: number, _y: number) => {},
  tiles: (): { terrain: Uint16Array; elevation: Uint8Array; bType: Uint8Array } | null => null,
  view: (): { cx: number; cy: number; corners: [number, number][] } | null => null,
  // M6a: lưu game
  save: (_slot?: string, _name?: string) => {},
  load: (_slot?: string) => {},
  listSaves: () => {},
  deleteSave: (_slot: string) => {},
  renameSave: (_slot: string, _name: string) => {},
  /** menu bắt đầu: vào chơi tự do (seed cố định), hoặc vào rồi nạp khe */
  start: (_mode: 'sandbox' | 'load', _slot?: string) => {},
  exportFile: () => {},
  importFile: async (_f: File) => {},
};
