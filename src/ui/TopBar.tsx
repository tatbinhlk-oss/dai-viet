import { bridge, briefing, campaign, fps, panel, resetCampaign, soundOn, ui, type Panel } from './store';
import { SCENARIO_LIST } from '../sim/scenario/list';
import { openScenario } from './App';
import { MONTHS, num } from './format';
import { MOOD_CAUSE_TEXT } from '../sim/city/sentiment';
import type { FloodStats } from '../sim';

const PANELS: [Exclude<Panel, null>, string][] = [['overview', 'Tổng quan'], ['labor', 'Lao động'], ['finance', 'Tài chính'], ['mood', 'Dân tình'], ['storage', 'Kho hàng'], ['flood', 'Thủy lợi'], ['court', 'Nha môn'], ['worship', 'Tín ngưỡng'], ['ratings', 'Chỉ số'], ['trade', 'Thương mại'], ['settings', 'Cài đặt']];

/** Dòng lũ trên thanh trên: chỉ hiện từ tháng 4 đến tháng 9. */
function floodText(f: FloodStats): string {
  if (f.inSeason) return `Lũ ${f.peakName} · nước mức ${f.level}` + (f.floodedTiles ? ` · ngập ${f.floodedTiles} ô` : '');
  if (f.forecast) return `Dự báo lũ ${f.forecastName}`;
  return 'Mùa lũ sắp tới';
}

/** M6b: hộp chọn màn — chuỗi màn mở dần (màn kế mở khi thắng màn trước), màn lẻ và chơi tự do luôn mở. */
function ScenarioPicker() {
  const s = ui.value;
  const won = campaign.value.won;
  const unlocked = (d: (typeof SCENARIO_LIST)[number]) => d.order === undefined || d.order <= 1 || SCENARIO_LIST.some((p) => p.order === d.order! - 1 && won.includes(p.key));
  const cur = s?.city.scenario.key ?? '';
  return (
    <span class="scenario" title="Chọn màn chơi (nạp lại trang). Phẩm hàm mang theo chuỗi màn ghi trong trình duyệt.">
      <select value={cur === 'sandbox' ? '' : cur} onChange={(e) => { const k = (e.currentTarget as HTMLSelectElement).value; if (k !== (cur === 'sandbox' ? '' : cur)) openScenario(k); }}>
        <option value="">Chơi tự do</option>
        {SCENARIO_LIST.map((d) => (
          <option value={d.key} disabled={!unlocked(d)}>{d.order ? `${d.order}. ` : ''}{d.name}{won.includes(d.key) ? ' ✓' : unlocked(d) ? '' : ' (khóa)'}</option>
        ))}
      </select>
      {won.length > 0 && <button title="Xóa tiến độ chuỗi màn" onClick={() => { if (confirm('Xóa tiến độ chuỗi màn (phẩm hàm, màn đã thắng)?')) resetCampaign(); }}>⟲</button>}
    </span>
  );
}

export function TopBar() {
  const s = ui.value;
  const t = s?.time;
  return (
    <div class="bar top">
      <div class="row">
      <strong class="title">Đại Việt</strong>
      <ScenarioPicker />
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
      {s && <span title="Ân sủng" class={s.city.court.favor <= 20 ? 'bad' : ''}>Ân sủng {s.city.court.favor}</span>}
      {s?.city.flood.watch && s.city.flood.dikesBuilt > 0 && (
        <span title="An toàn đê = độ bền trung bình các đoạn đê" class={s.city.flood.safety < 60 ? 'bad' : ''}>Đê {s.city.flood.safety}%</span>
      )}
      <button class={soundOn.value ? '' : 'active'} title={soundOn.value ? 'Tắt tiếng' : 'Bật tiếng'} onClick={() => (soundOn.value = !soundOn.value)}>{soundOn.value ? '🔊' : '🔇'}</button>
      <span class="fps">{fps.value} fps</span>
      </div>
      <div class="row">
      {[0, 1, 2, 3].map((sp) => (
        <button class={s?.speed === sp ? 'active' : ''} onClick={() => bridge.cmd({ type: 'setSpeed', speed: sp as 0 | 1 | 2 | 3 })}>
          {['⏸', '▶', '▶▶', '▶▶▶'][sp]}
        </button>
      ))}
      <span class="sep" />
      {PANELS.map(([k, label]) => (
        <button class={panel.value === k ? 'active' : ''} onClick={() => (panel.value = panel.value === k ? null : k)}>{label}</button>
      ))}
      {s && s.city.scenario.key !== 'sandbox' && <button title="Xem lại nhiệm vụ của màn" onClick={() => (briefing.value = true)}>Nhiệm vụ</button>}
      <span class="sep" />
      <button title="Lưu vào trình duyệt (tự lưu mỗi tháng ở khe riêng)" onClick={() => bridge.save()}>Lưu</button>
      <button title="Nạp bản đã bấm Lưu" onClick={() => bridge.load('manual')}>Nạp</button>
      <button title="Nạp bản tự lưu tháng gần nhất" onClick={() => bridge.load('auto')}>Nạp tự lưu</button>
      <button title="Xuất file .dvsav để chia sẻ" onClick={() => bridge.exportFile()}>Xuất</button>
      <label class="filebtn" title="Nhập file .dvsav">Nhập<input type="file" accept=".dvsav" onChange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) void bridge.importFile(f); (e.currentTarget as HTMLInputElement).value = ''; }} /></label>
      </div>
    </div>
  );
}
