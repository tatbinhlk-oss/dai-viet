// Bảng nha môn (M5): Ân sủng, phẩm hàm, bổng lộc, tiến cống, cống nạp, chiếu chỉ đang treo — gộp senate và forum của Caesar 3.
import { bridge, ui } from './store';
import { num } from './format';
import { Spark } from './Spark';

const GIFT_NAMES = ['Quà mọn', 'Quà hậu', 'Quà trọng'];

export function YamenPanel() {
  const s = ui.value;
  if (!s) return null;
  const c = s.city.court;
  const sc = s.city.scenario;
  return (
    <>
      <p>
        Ân sủng <strong class={c.favor <= 20 ? 'bad' : ''}>{c.favor}</strong>/100
        {sc.goals.favor > 0 && <> · mục tiêu {sc.goals.favor}</>}
        {c.dismissalDays >= 0 && <span class="bad"> · bị thay sau {c.dismissalDays} ngày!</span>}
      </p>
      <p>Phẩm hàm: <em>{c.rankName}</em> · bổng lộc tích lũy {num(c.personalFunds)} quan</p>
      {sc.king && <p>{sc.kingText}</p>}
      <Spark values={s.city.history.favor} color="#e0a060" />
      <p>
        Bổng lộc tự đặt:{' '}
        <button onClick={() => bridge.cmd({ type: 'setSalary', level: c.salaryLevel - 1 })}>−</button>
        <strong> {c.salaryNames[c.salaryLevel]} ({c.salaryTable[c.salaryLevel]} quan/tháng) </strong>
        <button onClick={() => bridge.cmd({ type: 'setSalary', level: c.salaryLevel + 1 })}>+</button>
        {c.salaryLevel > c.rank && <span class="bad"> cao hơn phẩm hàm: Ân sủng −{c.salaryLevel - c.rank}/năm</span>}
        {c.salaryLevel < c.rank && <span class="muted"> thấp hơn phẩm hàm: Ân sủng +1/năm</span>}
      </p>
      <p>
        Tiến cống (lấy từ bổng lộc, lần thứ {c.giftsInWindow + 1} trong 12 tháng{c.giftsInWindow >= 3 ? ', triều đình đã chán' : ''}):{' '}
        {GIFT_NAMES.map((n, i) => (
          <button disabled={c.personalFunds < c.giftCosts[i]} onClick={() => bridge.cmd({ type: 'sendGift', size: i })} title={`Ân sủng +${c.giftFavor[i]} lần đầu`}>
            {n} {num(c.giftCosts[i])}
          </button>
        ))}
      </p>
      <p>
        Cống nạp năm nay: {num(c.tributeDue)} quan {c.tributePaid ? '(đã nộp)' : <span class="bad">(chưa nộp được, {c.tributeMissedYears} năm liền)</span>}
        {c.graduates > 0 && <> · {c.graduates} người đỗ khoa cử</>}
        {c.corveeWorkers > 0 && <> · {c.corveeWorkers} dân đang lao dịch</>}
      </p>
      <strong>Chiếu chỉ</strong>
      {c.edicts.length === 0 && <p class="muted">Chưa có chiếu chỉ nào. Sứ giả đem chiếu tới nha môn vào các tháng 2–9.</p>}
      <table class="mini">
        <tbody>
          {c.edicts.map((e) => (
            <tr class={e.state === 'failed' ? 'bad' : ''}>
              <td>
                <strong>{e.typeText}</strong>: {e.title}
                {e.state === 'coming' && <span class="muted"> · sứ giả đang tới</span>}
                {e.state === 'active' && <> · còn {e.daysLeft} ngày{e.extended ? ' (đã gia hạn)' : ''}</>}
                {e.state === 'done' && <span class="muted"> · xong</span>}
                {e.state === 'failed' && <> · bỏ</>}
                {e.type === 'corvee' && e.state === 'active' && <> · {e.progress}/{e.amount} ngày-người{e.corveePct ? ` (${e.corveePct}% nhân công)` : ''}</>}
                {(e.type === 'goods' || e.type === 'money' || e.type === 'troops') && e.state === 'active' && <> · có {e.type === 'money' ? num(e.have) : e.have}/{e.need}</>}
              </td>
              <td>
                {e.state === 'active' && (e.type === 'goods' || e.type === 'money' || e.type === 'troops') && (
                  <button disabled={!e.ready} onClick={() => bridge.cmd({ type: 'dispatchEdict', id: e.id })}>Thi hành (+{e.reward})</button>
                )}
                {e.state === 'active' && e.type === 'corvee' && e.corveePct === 0 && c.corveePctOptions.map((p, i) => (
                  <button onClick={() => bridge.cmd({ type: 'dispatchEdict', id: e.id, option: i })}>{p}%</button>
                ))}
                {e.state === 'active' && (e.type === 'ritual' || e.type === 'dike') && <span class="muted">tự xong khi đủ</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="muted">Ân sủng −2 mỗi năm; chiếu chỉ trễ lần đầu bị phạt và gia hạn 24 tháng, trễ lần hai bị bỏ. Ân sủng ≤ 10 là triều đình cử người thay sau 192 ngày.</p>
    </>
  );
}
