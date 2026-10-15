// QoL: hộp Lưu / Nạp nhiều khe có tên (như Caesar 3): tự lưu, lưu nhanh, 8 khe đặt tên; cộng Xuất / Nhập file.
import { useState } from 'preact/hooks';
import { bridge, saves, savesOpen, startMenu, ui } from './store';
import { MONTHS } from './format';

const SLOTS = ['auto', 'quick', ...Array.from({ length: 8 }, (_, i) => `slot${i + 1}`)];

export function SavesPanel() {
  const [names, setNames] = useState<Record<string, string>>({});
  if (!savesOpen.value) return null;
  const byKey = new Map(saves.value.map((m) => [m.slot, m]));
  const s = ui.value;
  return (
    <div class="gameover saves">
      <div class="head"><strong>Lưu / Nạp</strong><button onClick={() => (savesOpen.value = false)}>✕</button></div>
      <table class="mini">
        <thead><tr><th>Khe</th><th>Bản lưu</th><th></th></tr></thead>
        <tbody>
          {SLOTS.map((slot) => {
            const m = byKey.get(slot);
            const fixed = slot === 'auto' || slot === 'quick';
            return (
              <tr>
                <td>{fixed ? (slot === 'auto' ? 'Tự lưu' : 'Lưu nhanh') : <input value={names[slot] ?? m?.name ?? ''} placeholder={`Khe ${slot.replace('slot', '')}`} onInput={(e) => setNames({ ...names, [slot]: (e.currentTarget as HTMLInputElement).value })} />}</td>
                <td class="muted">{m ? `${m.scenario} · năm ${m.year + 1} tháng ${MONTHS[m.month]} · ${m.population.toLocaleString('vi-VN')} dân · ${new Date(m.savedAt).toLocaleString('vi-VN')}` : 'trống'}</td>
                <td>
                  {slot !== 'auto' && <button disabled={!s} onClick={() => bridge.save(slot, names[slot] || m?.name)}>Lưu</button>}{' '}
                  <button disabled={!m} onClick={() => { savesOpen.value = false; if (startMenu.value) { startMenu.value = false; bridge.start('load', slot); } else bridge.load(slot); }}>Nạp</button>{' '}
                  {!fixed && m && names[slot] !== undefined && names[slot] !== m.name && <button title="Đổi tên bản lưu" onClick={() => bridge.renameSave(slot, names[slot])}>Đổi tên</button>}{' '}
                  {m && <button title="Xóa bản lưu này" onClick={() => { if (confirm(`Xóa bản lưu "${m.name}"?`)) bridge.deleteSave(slot); }}>Xóa</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div class="actions">
        <button onClick={() => bridge.exportFile()}>Xuất file .dvsav</button>
        <label class="filebtn">Nhập file<input type="file" accept=".dvsav" onChange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) { void bridge.importFile(f); savesOpen.value = false; } (e.currentTarget as HTMLInputElement).value = ''; }} /></label>
        <span class="muted">Tự lưu mỗi tháng game. F5 lưu nhanh, F9 nạp bản lưu nhanh.</span>
      </div>
    </div>
  );
}
