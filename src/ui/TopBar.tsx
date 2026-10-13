import { bridge, fps, panel, ui, type Panel } from './store';
import { MONTHS, num } from './format';
import { MOOD_CAUSE_TEXT } from '../sim/city/sentiment';
import type { FloodStats } from '../sim';

const PANELS: [Exclude<Panel, null>, string][] = [['labor', 'Lao động'], ['finance', 'Tài chính'], ['mood', 'Dân tình'], ['storage', 'Kho hàng'], ['flood', 'Thủy lợi']];

/** Dòng lũ trên thanh trên: chỉ hiện từ tháng 4 đến tháng 9. */
function floodText(f: FloodStats): string {
  if (f.inSeason) return `Lũ ${f.peakName} · nước mức ${f.level}` + (f.floodedTiles ? ` · ngập ${f.floodedTiles} ô` : '');
  if (f.forecast) return `Dự báo lũ ${f.forecastName}`;
  return 'Mùa lũ sắp tới';
}

export function TopBar() {
  const s = ui.value;
  const t = s?.time;
  return (
    <div class="bar top">
      <strong class="title">Đại Việt</strong>
      <span>{t ? `Ngày ${t.day + 1} tháng ${MONTHS[t.month]} · năm ${t.year + 1}` : '—'}</span>
      <span class="sep" />
      <span title="Ngân khố">{s ? `${num(s.treasury)} quan` : '—'}</span>
      <span title="Dân / chỗ ở">{s ? `${num(s.population)} dân / ${num(s.housingCapacity)}` : ''}</span>
      <span title="Lòng dân" class={s && s.city.sentiment < 40 ? 'bad' : ''}>
        {s ? `Lòng dân ${s.city.sentiment}${s.city.lowMoodCause !== 'none' ? ` (${MOOD_CAUSE_TEXT[s.city.lowMoodCause]})` : ''}` : ''}
      </span>
      <span title="Thất nghiệp">{s ? `Thất nghiệp ${s.city.unemploymentPct}%` : ''}</span>
      {s?.city.flood.watch && (
        <span title="Lũ" class={s.city.flood.inSeason && s.city.flood.floodedTiles > 0 ? 'bad' : ''}>{floodText(s.city.flood)}</span>
      )}
      {s?.city.flood.watch && s.city.flood.dikesBuilt > 0 && (
        <span title="An toàn đê = độ bền trung bình các đoạn đê" class={s.city.flood.safety < 60 ? 'bad' : ''}>Đê {s.city.flood.safety}%</span>
      )}
      <span class="sep" />
      {[0, 1, 2, 3].map((sp) => (
        <button class={s?.speed === sp ? 'active' : ''} onClick={() => bridge.cmd({ type: 'setSpeed', speed: sp as 0 | 1 | 2 | 3 })}>
          {['⏸', '▶', '▶▶', '▶▶▶'][sp]}
        </button>
      ))}
      <span class="sp" />
      {PANELS.map(([k, label]) => (
        <button class={panel.value === k ? 'active' : ''} onClick={() => (panel.value = panel.value === k ? null : k)}>{label}</button>
      ))}
      <span class="fps">{fps.value} fps</span>
    </div>
  );
}
