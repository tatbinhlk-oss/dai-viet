// M8: bảng Quân sự — các đội quân (trại lính, trại cung thủ, tàu voi) với quân số, máu, chỗ gác, nút → tới / Điều quân / Về trại;
// tin giặc sắp tới (hướng, số, còn mấy tháng, chòi canh có phủ mép vào không) với nút → tới mép giặc; vũ khí trong kho.
import { bridge, panel, squadOrder, tool, ui } from './store';
import type { SquadInfo } from '../sim/info';

const KIND_TEXT: Record<SquadInfo['kind'], string> = { militia: 'lính giáo', archer: 'cung thủ', elephant: 'voi trận' };

/** Bắt đầu điều một đội: ô tiếp theo người chơi bấm / chạm trên bản đồ là chỗ gác. Chuyển sang công cụ Xem để chạm không bị hiểu là vẽ đường. */
export function beginSquadOrder(buildingId: number): void {
  squadOrder.value = buildingId;
  tool.value = 'inspect';
  panel.value = null;
}

export function SquadButtons({ sq }: { sq: SquadInfo }) {
  return (
    <>
      <button class="goto" title="Tới chỗ đội đang đứng" onClick={() => bridge.lookAt(sq.at.x, sq.at.y)}>→</button>{' '}
      <button class={squadOrder.value === sq.buildingId ? 'active' : ''} disabled={sq.count === 0} title="Rồi bấm / chạm một ô đất trống trên bản đồ: cả đội tới đứng gác ở đó" onClick={() => beginSquadOrder(sq.buildingId)}>Điều quân</button>{' '}
      {sq.post && <button title="Bỏ ô gác, đội về đứng ở cửa trại" onClick={() => bridge.cmd({ type: 'squadReturn', buildingId: sq.buildingId })}>Về trại</button>}
    </>
  );
}

export function ArmyPanel() {
  const s = ui.value;
  if (!s) return null;
  const w = s.city.war;
  return (
    <>
      <p><strong>Đội quân</strong> · {w.militia} quân · năm nay hạ {w.killedThisYear} tên{w.enemiesAlive > 0 && <span class="bad"> · {w.enemiesAlive} tên giặc đang trong lộ!</span>}</p>
      {w.squads.length === 0 && <p class="muted">Chưa có trại lính. Trại lính và trại cung thủ nhận vũ khí từ lò rèn (mỗi kiện một quân, tối đa 4); tàu voi cần phẩm hàm cao, tự huấn luyện voi.</p>}
      {w.squads.length > 0 && (
        <table class="mini">
          <thead><tr><th>Đội</th><th>Quân</th><th>Máu</th><th>Gác</th><th></th></tr></thead>
          <tbody>
            {w.squads.map((sq) => (
              <tr class={sq.count === 0 ? 'muted' : ''}>
                <td>{sq.name} <span class="muted">({KIND_TEXT[sq.kind]})</span></td>
                <td>{sq.count}/{sq.max}{sq.kind === 'elephant' ? (sq.count < sq.max ? ` · luyện ${sq.trainPct}%` : '') : sq.weapons ? ` · ${sq.weapons} vũ khí` : ''}</td>
                <td class={sq.count && sq.hpPct < 50 ? 'bad' : ''}>{sq.count ? `${sq.hpPct}%` : '—'}</td>
                <td>{sq.post ? `ô (${sq.post.x}, ${sq.post.y})` : 'cửa trại'}</td>
                <td><SquadButtons sq={sq} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p class="muted">Đội đứng gác tại chỗ được lệnh; giặc vào tầm 30 ô quanh chỗ gác thì đánh rồi quay lại, không đuổi xa. Cung thủ bắn 3 ô, yếu khi bị áp sát. Voi chậm, máu 400, đòn 40.</p>
      <p><strong>Tin giặc</strong></p>
      {w.incoming.length === 0 ? <p class="muted">Chưa có tin giặc. Chòi canh biên gần mép giặc vào báo sớm hơn một tháng.</p> : (
        <ul class="problems">
          {w.incoming.map((i) => (
            <li class={i.months <= 1 ? 'bad' : 'warn'}>
              {i.text} — {i.months <= 0 ? 'đang tới' : `còn ${i.months} tháng`}{i.watched ? ' · chòi canh đang theo dõi' : ''}{' '}
              <button class="goto" title="Tới mép giặc vào" onClick={() => bridge.lookAt(i.x, i.y)}>→</button>
            </li>
          ))}
        </ul>
      )}
      <p>Vũ khí trong kho: {w.weaponsStored} kiện{w.weaponsStored === 0 ? <span class="muted"> — lò rèn cần quặng sắt từ mỏ sắt</span> : ''}</p>
      <p class="muted">Thành đất chịu {w.wallHp.earthWall} đòn, thành đá {w.wallHp.stoneWall}, cổng {w.wallHp.gate}. Giặc nhắm vựa / kho có hàng trước để cướp một kiện, rồi mới đốt nơi khác.</p>
    </>
  );
}
