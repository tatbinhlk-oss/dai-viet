import { bridge, fps, panel, ui, type Panel } from './store';
import { MONTHS, num } from './format';
import { MOOD_CAUSE_TEXT } from '../sim/city/sentiment';

const PANELS: [Exclude<Panel, null>, string][] = [['labor', 'Lao động'], ['finance', 'Tài chính'], ['mood', 'Dân tình'], ['storage', 'Kho hàng']];

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
