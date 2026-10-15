// QoL: hộp tin nổi cho tin quan trọng (giặc tới, vỡ đê, chiếu chỉ, cách chức, cháy…) với nút tới chỗ; tự biến sau 12 giây.
import { useEffect } from 'preact/hooks';
import { bridge, dismissToast, toasts } from './store';
import { GRID_SIZE } from '../sim/map/grid';

export function Toasts() {
  useEffect(() => {
    const id = setInterval(() => { const now = Date.now(); if (toasts.value.some((t) => now - t.born > 12000)) toasts.value = toasts.value.filter((t) => now - t.born <= 12000); }, 1000);
    return () => clearInterval(id);
  }, []);
  if (!toasts.value.length) return null;
  return (
    <div class="toasts">
      {toasts.value.map((t) => (
        <div class={`toast ${t.level}`}>
          <span>{t.text}</span>
          {t.at >= 0 && <button class="goto" title="Tới chỗ đó" onClick={() => { bridge.lookAt(t.at % GRID_SIZE, Math.floor(t.at / GRID_SIZE)); dismissToast(t.id); }}>→</button>}
          <button class="goto" title="Đóng" onClick={() => dismissToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

/** Tin nào đáng nổi hộp: trả mức, null = không. */
export function toastLevel(text: string): 'bad' | 'warn' | 'info' | null {
  if (/^(Giặc tới|Vỡ đê|Loạn dân|Triều đình cử quan khác|Ân sủng quá thấp|Hết hạn)/.test(text)) return 'bad';
  if (/^(Tin báo|Chiếu chỉ:|Lũ về|Nước ngập|Dịch bệnh|Trễ chiếu chỉ|Bỏ chiếu chỉ|Cháy|Sập|Hà đê sứ)/.test(text)) return 'warn';
  if (/^(Đạt mọi mục tiêu|Hoàn thành chiếu chỉ|Khoa thi|Triều đình cấp thêm|Nộp cống|Triều đình hài lòng)/.test(text)) return 'info';
  return null;
}
/** Tin "nặng" thì tự tạm dừng (nếu bật trong Cài đặt). */
export const pausesGame = (text: string): boolean => /^(Giặc tới|Vỡ đê|Chiếu chỉ:|Triều đình cử quan khác|Ân sủng quá thấp|Loạn dân)/.test(text);
