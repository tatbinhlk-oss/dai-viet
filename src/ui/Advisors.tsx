// Bảng cố vấn: lao động, tài chính, dân tình, kho hàng.
import { LABOR_NAMES } from '../sim/city/labor';
import { MOOD_CAUSE_TEXT } from '../sim/city/sentiment';
import { HOUSE_LEVELS, RESOURCES } from '../sim/buildings/defs';
import { bridge, panel, settings, showNames, soundOn, ui, updateSettings } from './store';
import { HOTKEYS } from './hotkeys';
import { Spark } from './Spark';
import { GRID_SIZE } from '../sim/map/grid';

/** QoL: nút tới chỗ xảy ra sự kiện / vấn đề */
const GoTo = ({ at }: { at: number }) => (at >= 0 ? <button class="goto" title="Tới chỗ đó" onClick={() => bridge.lookAt(at % GRID_SIZE, Math.floor(at / GRID_SIZE))}>→</button> : null);
/** danh sách sự kiện mới nhất trước, có nút tới chỗ */
const EventList = ({ events, at }: { events: string[]; at: number[] }) => (events.length ? <ul class="events">{events.map((e, i) => <li>{e} <GoTo at={at[i] ?? -1} /></li>).reverse()}</ul> : null);
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
        <strong>{{ settings: 'Cài đặt và phím tắt', overview: 'Tổng quan — cố vấn', labor: 'Lao động', finance: 'Tài chính', mood: 'Dân tình', storage: 'Kho hàng', flood: 'Thủy lợi', court: 'Nha môn — triều đình', worship: 'Tín ngưỡng', ratings: 'Bốn chỉ số', trade: 'Thương mại' }[p]}</strong>
        <button onClick={() => (panel.value = null)}>✕</button>
      </div>
      {p === 'settings' && (
        <>
          <p>
            <label>Âm lượng {Math.round(settings.value.volume * 100)}% <input type="range" min={0} max={100} value={Math.round(settings.value.volume * 100)} onInput={(e) => updateSettings({ volume: Number((e.currentTarget as HTMLInputElement).value) / 100 })} /></label>{' '}
            <button class={soundOn.value ? '' : 'active'} onClick={() => (soundOn.value = !soundOn.value)}>{soundOn.value ? 'Tắt tiếng' : 'Bật tiếng'}</button>
          </p>
          <p>
            Cỡ chữ:{' '}
            {([['Nhỏ', 0.9], ['Vừa', 1], ['Lớn', 1.15], ['Rất lớn', 1.3]] as [string, number][]).map(([n, v]) => (
              <button class={Math.abs(settings.value.uiScale - v) < 0.01 ? 'active' : ''} onClick={() => updateSettings({ uiScale: v })}>{n}</button>
            ))}
          </p>
          <p>
            <button class={settings.value.minimap ? 'active' : ''} onClick={() => updateSettings({ minimap: !settings.value.minimap })}>Bản đồ thu nhỏ</button>{' '}
            <button class={settings.value.pauseOnEvent ? 'active' : ''} title="Giặc tới, vỡ đê, chiếu chỉ, cách chức thì tự tạm dừng" onClick={() => updateSettings({ pauseOnEvent: !settings.value.pauseOnEvent })}>Tự dừng khi có tin lớn</button>{' '}
            <button class={showNames.value ? 'active' : ''} onClick={() => (showNames.value = !showNames.value)}>Hiện tên công trình</button>
          </p>
          <p class="muted">Âm thanh thật chưa có; thả file vào public/sounds/ là phát (xem README). Cài đặt ghi trong trình duyệt.</p>
          <p><strong>Phím tắt</strong></p>
          <table class="mini"><tbody>{HOTKEYS.map((h) => <tr><td><em>{h.keys}</em></td><td>{h.text}</td></tr>)}</tbody></table>
        </>
      )}
      {p === 'overview' && (
        <>
          {c.scenario.goals.population > 0 && (
            <table class="mini">
              <thead><tr><th>Mục tiêu {c.scenario.name}</th><th>Hiện</th><th>Cần</th></tr></thead>
              <tbody>
                {([['Dân', 'population'], ['Văn hiến', 'culture'], ['Thịnh vượng', 'prosperity'], ['Trị an', 'peace'], ['Ân sủng', 'favor']] as [string, keyof typeof c.scenario.goals][]).map(([n, k]) => (
                  <tr class={c.scenario.current[k] >= c.scenario.goals[k] ? 'ok' : ''}><td>{n}</td><td>{num(c.scenario.current[k])}</td><td>{num(c.scenario.goals[k])}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {c.scenario.timeLimitYears > 0 && <p class="muted">Hạn: {c.scenario.timeLimitYears} năm · đang năm {s.time.year + 1}</p>}
          {c.tutorial.length > 0 && (
            <>
              <p><strong>Các bước cho người mới</strong> ({c.tutorial.filter((t) => t.done).length}/{c.tutorial.length})</p>
              <ul class="tutorial">{c.tutorial.map((st) => <li class={st.done ? 'done' : ''}>{st.done ? '☑' : '☐'} {st.text}</li>)}</ul>
            </>
          )}
          <p><strong>Vấn đề</strong></p>
          {c.problems.length === 0 ? <p class="muted">Không có gì đáng lo. {c.scenario.goals.population > 0 ? 'Xem mục tiêu phía trên.' : ''}</p> : (
            <ul class="problems">{c.problems.map((pr) => <li class={pr.level}>{pr.text} <GoTo at={pr.at} /></li>)}</ul>
          )}
          <p><strong>Tin mới</strong></p>
          <EventList events={c.events.slice(-12)} at={c.eventAt.slice(-12)} />
        </>
      )}
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
          <p><strong>Ngân khố theo tháng</strong></p>
          <Spark values={c.history.treasury} color="#f0d890" zero />
          <p>Tháng tới: thu ~{num(c.estTaxes)} · lương ~{num(c.estWages)}{c.estUncollected > 0 && <span class="bad"> · bỏ sót ~{num(c.estUncollected)} (nhà chưa có lại thu thuế)</span>}</p>
          <table class="mini">
            <thead><tr><th></th><th>Năm nay</th><th>Năm trước</th></tr></thead>
            <tbody>
              <tr><td>Thuế</td><td>{num(c.thisYear.taxes)}</td><td>{num(c.lastYear.taxes)}</td></tr>
              <tr><td>Lương</td><td>{neg(c.thisYear.wages)}</td><td>{neg(c.lastYear.wages)}</td></tr>
              <tr><td>Xây dựng</td><td>{neg(c.thisYear.construction)}</td><td>{neg(c.lastYear.construction)}</td></tr>
              <tr><td>Mất trộm</td><td>{neg(c.thisYear.stolen)}</td><td>{neg(c.lastYear.stolen)}</td></tr>
              <tr><td>Cống nạp</td><td>{neg(c.thisYear.tribute)}</td><td>{neg(c.lastYear.tribute)}</td></tr>
              <tr><td>Bổng lộc</td><td>{neg(c.thisYear.salary)}</td><td>{neg(c.lastYear.salary)}</td></tr>
              <tr><td>Lễ hội, Tết</td><td>{neg(c.thisYear.festivals)}</td><td>{neg(c.lastYear.festivals)}</td></tr>
              <tr><td>Bán cho lái buôn</td><td>{num(c.thisYear.exports)}</td><td>{num(c.lastYear.exports)}</td></tr>
              <tr><td>Mua của lái buôn</td><td>{neg(c.thisYear.imports)}</td><td>{neg(c.lastYear.imports)}</td></tr>
            </tbody>
          </table>
        </>
      )}
      {p === 'mood' && (
        <>
          <p>Lòng dân {c.sentiment}/100{c.lowMoodCause !== 'none' && <> · bất mãn nhất vì <strong>{MOOD_CAUSE_TEXT[c.lowMoodCause]}</strong></>}</p>
          <p class="muted">Trên 70 dân kéo đến nhanh, 40–50 đứng yên, dưới 20 bỏ đi. Nhà dưới 50 sinh dân kêu oan, dưới 30 trộm, từ 10 trở xuống loạn dân.</p>
          <p><strong>Dân số theo tháng</strong></p>
          <Spark values={c.history.pop} color="#9fd98a" />
          <table class="mini">
            <tbody>
              {c.houseLevels.map((n, lvl) => (n > 0 ? <tr><td>{HOUSE_LEVELS[lvl].name}</td><td>{n}</td></tr> : null))}
            </tbody>
          </table>
          <EventList events={c.events} at={c.eventAt} />
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
          <EventList events={c.events} at={c.eventAt} />
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
      {p === 'trade' && (
        <>
          {c.trade.routes.map((r) => (
            <div>
              <p>
                <strong>{r.name}</strong> ({r.kind === 'sea' ? 'thuyền buôn, cần bến cảng' : 'đoàn buôn ngựa thồ, tới kho'}, {r.loadsPerTrip} kiện/chuyến)
                {!r.available && <span class="muted"> · màn này không có</span>}
                {r.available && !r.open && <> <button onClick={() => bridge.cmd({ type: 'openRoute', route: r.index })}>Mở tuyến ({num(r.openCost)} quan)</button></>}
                {r.open && <span class="muted"> · {r.traderOut ? 'lái buôn đang tới' : `chuyến sau ${r.nextTripDays} ngày`}</span>}
              </p>
              <table class="mini">
                <thead><tr><th>Hàng</th><th>Lái buôn</th><th>Giá</th><th>Năm nay / hạn ngạch</th><th>Lệnh</th></tr></thead>
                <tbody>
                  {r.goods.map((g) => (
                    <tr>
                      <td>{g.name}</td><td>{g.citySells ? 'mua của ta' : 'bán cho ta'}</td><td>{g.price}</td><td>{g.traded}/{g.quota}</td>
                      <td>
                        {[0, 1, 2].filter((o) => o === 0 || (o === 2) === g.citySells).map((o) => (
                          <button class={c.trade.orders[g.resource] === o ? 'active' : ''} onClick={() => bridge.cmd({ type: 'setTradeOrder', resource: g.resource, order: o as 0 | 1 | 2 })}>{['Không', 'Mua', 'Bán'][o]}</button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p>Năm nay: {c.trade.shipsThisYear} thuyền cập bến (≥ 4 thì Thịnh vượng +1), {c.trade.caravansThisYear} đoàn buôn · bán {num(c.thisYear.exports)} · mua {num(c.thisYear.imports)} quan</p>
          <p class="muted">Hạn ngạch mỗi mặt hàng 15 → 25 → 40 kiện/năm: năm trước mua bán đủ 80% thì lên mức. Lái buôn chỉ mua hàng đang có lệnh Bán trong kho, chỉ bán hàng có lệnh Mua (kho còn chỗ, ngân khố đủ).</p>
          <p>
            Giặc giã: {c.war.warning ? <span class="bad">{c.war.warning}</span> : 'chưa có tin'}
            {c.war.enemiesAlive > 0 && <span class="bad"> · {c.war.enemiesAlive} tên giặc đang trong lộ!</span>}
            {' '}· {c.war.militia} lính · năm nay hạ {c.war.killedThisYear} tên
          </p>
          <p class="muted">Trại lính nhận vũ khí từ lò rèn (xe bò chở tới), mỗi kiện một lính, tối đa 4 lính mỗi trại. Thành đất chịu {c.war.wallHp.earthWall} đòn, thành đá {c.war.wallHp.stoneWall} đòn; giặc không qua được thành, phải phá.</p>
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
