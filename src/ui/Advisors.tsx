// Bảng cố vấn: lao động, tài chính, dân tình, kho hàng.
import { LABOR_NAMES } from '../sim/city/labor';
import { MOOD_CAUSE_TEXT } from '../sim/city/sentiment';
import { HOUSE_LEVELS, RESOURCES } from '../sim/buildings/defs';
import { bridge, panel, ui } from './store';
import { loads, num } from './format';
import { YamenPanel } from './YamenPanel';

const FEST_NAMES = ['Lễ nhỏ', 'Lễ vừa', 'Lễ lớn'];

const neg = (n: number) => (n ? `−${num(n)}` : '0');

export function Advisors() {
  const p = panel.value;
  const s = ui.value;
  if (!p || !s) return null;
  const c = s.city;
  return (
    <div class="panel advisor">
      <div class="head">
        <strong>{{ labor: 'Lao động', finance: 'Tài chính', mood: 'Dân tình', storage: 'Kho hàng', flood: 'Thủy lợi', court: 'Nha môn — triều đình', worship: 'Tín ngưỡng', ratings: 'Bốn chỉ số' }[p]}</strong>
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
      {p === 'flood' && (
        <>
          <p>
            {c.flood.inSeason
              ? <>Lũ <strong>{c.flood.peakName}</strong> (đỉnh mức {c.flood.peak}) · nước mức {c.flood.level} · ngày {c.flood.dayInSeason + 1}/{c.flood.seasonDays}{c.flood.floodedTiles > 0 && <span class="bad"> · ngập {num(c.flood.floodedTiles)} ô</span>}</>
              : c.flood.forecast
                ? <>Nha môn dự báo lũ <strong>{c.flood.forecastName}</strong> (mức {c.flood.forecast}), đúng 7 phần 10</>
                : <>Ngoài mùa lũ. Lũ về ngày 1 tháng Sáu, rút hết tháng Chín; nha môn báo trước từ tháng Tư.</>}
          </p>
          <p>
            Đê: {c.flood.dikesBuilt} đoạn đã đắp{c.flood.dikesPlanned > 0 && <>, {c.flood.dikesPlanned} đoạn chờ phu đê đắp hoặc tôn cao</>}
            {c.flood.dikesBuilt > 0 && <> · an toàn <span class={c.flood.safety < 60 ? 'bad' : ''}>{c.flood.safety}%</span></>}
            {c.flood.breachesThisYear > 0 && <span class="bad"> · vỡ {c.flood.breachesThisYear} đoạn năm nay</span>}
          </p>
          <p class="muted">Mực lũ 1 nhỏ (45%), 2 vừa (35%), 3 lớn (15%), 4 đại hồng thủy (5%). Ô ngập khi cao độ + cao đê &lt; mực nước. Đê cao 1 trên bãi bồi chắn lũ vừa, cao 2 chắn lũ lớn, cao 3 chắn đại hồng thủy. Nước chạm đê làm mòn độ bền; thợ cả đi qua sửa lại.</p>
          <p>Ruộng có phù sa: {c.flood.siltedPaddies}. Ruộng trong đê 5 năm không ngập thì bạc màu −10%; mở cống cho nước vào để lấy phù sa.</p>
          {c.flood.sluices.length > 0 && (
            <table class="mini">
              <thead><tr><th>Cống</th><th>Cao</th><th></th></tr></thead>
              <tbody>
                {c.flood.sluices.map((sl) => (
                  <tr>
                    <td>({sl.x}, {sl.y})</td><td>{sl.height}</td>
                    <td><button class={sl.open ? 'active' : ''} onClick={() => bridge.cmd({ type: 'openSluice', buildingId: sl.id, open: !sl.open })}>{sl.open ? 'Đang mở' : 'Đóng'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {c.events.length > 0 && <ul class="events">{[...c.events].reverse().map((e) => <li>{e}</li>)}</ul>}
        </>
      )}
      {p === 'court' && <YamenPanel />}
      {p === 'worship' && (
        <>
          <table class="mini">
            <thead><tr><th>Thờ</th><th>Đền</th><th>Tâm trạng</th><th>Sét</th><th>Lễ</th></tr></thead>
            <tbody>
              {c.worship.gods.map((g) => (
                <tr class={g.mood < 35 ? 'bad' : ''}>
                  <td>{g.name}</td><td>{g.temples} ({g.coverage}%)</td><td>{g.mood} → {g.target}</td><td>{g.bolts}</td>
                  <td>{g.monthsSinceFestival >= 12 ? '—' : `${g.monthsSinceFestival} tháng trước`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Mở lễ hội làng:{' '}
            {c.worship.gods.map((g) => (
              <span>
                <em>{g.name.split(' ')[0]}</em>{' '}
                {FEST_NAMES.map((n, i) => <button onClick={() => bridge.cmd({ type: 'holdFestival', deity: g.deity, size: i })} title={`${n} thờ ${g.name}: ${num(c.worship.festivalCosts[i])} quan`}>{['n', 'v', 'l'][i]}</button>)}{' '}
              </span>
            ))}
          </p>
          <p class="muted">Giá lễ nhỏ / vừa / lớn: {c.worship.festivalCosts.map(num).join(' / ')} quan. Tâm trạng tiến ±1/ngày về: bao phủ đền + (12 − tháng từ lễ) + nhiều đền nhất +50 / ít nhất −25. Dưới 50 tích sét: 20 quở nhỏ, 50 quở lớn; đủ 100 phù hộ.</p>
          {c.worship.healersOffDays > 0 && <p class="bad">Thầy lang nghỉ còn {c.worship.healersOffDays} ngày</p>}
          {c.worship.paddyFreezeDays > 0 && <p class="bad">Ruộng lúa lép còn {c.worship.paddyFreezeDays} ngày</p>}
          {c.worship.healthBonusMonths > 0 && <p>Phật phù hộ sức khỏe còn {c.worship.healthBonusMonths} tháng</p>}
        </>
      )}
      {p === 'ratings' && (
        <>
          <p>Màn: <em>{c.scenario.name}</em>{c.scenario.timeLimitYears > 0 && <> · hạn {c.scenario.timeLimitYears} năm</>}</p>
          <table class="mini">
            <thead><tr><th>Chỉ số</th><th>Hiện có</th><th>Mục tiêu</th></tr></thead>
            <tbody>
              {([['Dân số', c.scenario.current.population, c.scenario.goals.population], ['Văn hiến', c.ratings.culture, c.scenario.goals.culture], ['Thịnh vượng', c.ratings.prosperity, c.scenario.goals.prosperity], ['Trị an', c.ratings.peace, c.scenario.goals.peace], ['Ân sủng', c.court.favor, c.scenario.goals.favor]] as [string, number, number][]).map(([n, v, g]) => (
                <tr class={g > 0 && v < g ? 'bad' : ''}><td>{n}</td><td>{num(v)}</td><td>{g > 0 ? num(g) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
          <p>Sức khỏe {c.ratings.health}/100 · trần Thịnh vượng {c.ratings.prosperityCap} (theo bậc nhà) · {c.ratings.yearsCalm} năm yên</p>
          <table class="mini">
            <thead><tr><th>Văn hiến</th><th>Bao phủ</th><th>Điểm</th></tr></thead>
            <tbody>
              {c.ratings.cultureBreakdown.map((g) => <tr><td>{g.name}</td><td>{g.coverage}%</td><td>{g.points}/{g.max}</td></tr>)}
            </tbody>
          </table>
          <p class="muted">Văn hiến theo tháng; Thịnh vượng và Trị an cộng dồn đầu năm (lãi +5, thất nghiệp, lương thực, lều, lũ; yên ổn +2/+5, trộm, loạn, vỡ đê).</p>
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
