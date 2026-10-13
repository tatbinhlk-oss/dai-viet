// Bảng cố vấn: lao động, tài chính, dân tình, kho hàng.
import { LABOR_NAMES } from '../sim/city/labor';
import { MOOD_CAUSE_TEXT } from '../sim/city/sentiment';
import { HOUSE_LEVELS, RESOURCES } from '../sim/buildings/defs';
import { bridge, panel, ui } from './store';
import { loads, num } from './format';

const neg = (n: number) => (n ? `−${num(n)}` : '0');

export function Advisors() {
  const p = panel.value;
  const s = ui.value;
  if (!p || !s) return null;
  const c = s.city;
  return (
    <div class="panel advisor">
      <div class="head">
        <strong>{{ labor: 'Lao động', finance: 'Tài chính', mood: 'Dân tình', storage: 'Kho hàng' }[p]}</strong>
        <button onClick={() => (panel.value = null)}>✕</button>
      </div>
      {p === 'labor' && (
        <>
          <p>Nhân công {num(c.employed)} / {num(c.workforce)} · thất nghiệp {c.unemploymentPct}%</p>
          <table class="mini">
            <thead><tr><th>Ngành</th><th>Cần</th><th>Có</th><th>Ưu tiên</th></tr></thead>
            <tbody>
              {LABOR_NAMES.map((name, i) => (
                <tr class={c.laborAllocated[i] < c.laborNeeded[i] ? 'bad' : ''}>
                  <td>{name}</td><td>{c.laborNeeded[i]}</td><td>{c.laborAllocated[i]}</td>
                  <td>
                    <button onClick={() => bridge.cmd({ type: 'setLaborPriority', category: i, priority: (c.laborPriority[i] + 1) % 10 })}>
                      {c.laborPriority[i] || '—'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="muted">Bấm ô ưu tiên để đổi 1 → 9 (1 lấp trước). Ngành không ưu tiên chia phần còn lại theo tỉ lệ.</p>
        </>
      )}
      {p === 'finance' && (
        <>
          <p>
            Thuế suất{' '}
            <button onClick={() => bridge.cmd({ type: 'setTax', rate: c.taxRate - 1 })}>−</button>
            <strong> {c.taxRate}% </strong>
            <button onClick={() => bridge.cmd({ type: 'setTax', rate: c.taxRate + 1 })}>+</button>
          </p>
          <p>Tháng tới: thu ~{num(c.estTaxes)} · lương ~{num(c.estWages)}{c.estUncollected > 0 && <span class="bad"> · bỏ sót ~{num(c.estUncollected)} (nhà chưa có lại thu thuế)</span>}</p>
          <table class="mini">
            <thead><tr><th></th><th>Năm nay</th><th>Năm trước</th></tr></thead>
            <tbody>
              <tr><td>Thuế</td><td>{num(c.thisYear.taxes)}</td><td>{num(c.lastYear.taxes)}</td></tr>
              <tr><td>Lương</td><td>{neg(c.thisYear.wages)}</td><td>{neg(c.lastYear.wages)}</td></tr>
              <tr><td>Xây dựng</td><td>{neg(c.thisYear.construction)}</td><td>{neg(c.lastYear.construction)}</td></tr>
              <tr><td>Mất trộm</td><td>{neg(c.thisYear.stolen)}</td><td>{neg(c.lastYear.stolen)}</td></tr>
            </tbody>
          </table>
        </>
      )}
      {p === 'mood' && (
        <>
          <p>Lòng dân {c.sentiment}/100{c.lowMoodCause !== 'none' && <> · bất mãn nhất vì <strong>{MOOD_CAUSE_TEXT[c.lowMoodCause]}</strong></>}</p>
          <p class="muted">Trên 70 dân kéo đến nhanh, 40–50 đứng yên, dưới 20 bỏ đi. Nhà dưới 50 sinh dân kêu oan, dưới 30 trộm, từ 10 trở xuống loạn dân.</p>
          <table class="mini">
            <tbody>
              {c.houseLevels.map((n, lvl) => (n > 0 ? <tr><td>{HOUSE_LEVELS[lvl].name}</td><td>{n}</td></tr> : null))}
            </tbody>
          </table>
          {c.events.length > 0 && <ul class="events">{[...c.events].reverse().map((e) => <li>{e}</li>)}</ul>}
        </>
      )}
      {p === 'storage' && (
        <table class="mini">
          <thead><tr><th>Hàng</th><th>Kiện</th><th>Tích trữ</th></tr></thead>
          <tbody>
            {RESOURCES.map((r, i) => (i === 0 ? null : (
              <tr>
                <td>{r.name}</td><td>{loads(c.stored[i])}</td>
                <td><button class={c.stockpile[i] ? 'active' : ''} onClick={() => bridge.cmd({ type: 'setStockpile', resource: i, on: !c.stockpile[i] })}>{c.stockpile[i] ? 'Đang giữ' : 'Không'}</button></td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
    </div>
  );
}
