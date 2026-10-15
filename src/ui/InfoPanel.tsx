// Bảng chi tiết công trình đang chọn (công cụ "Xem").
import { BuildingType, FOODS, StorePolicy } from '../sim/state';
import { RESOURCES } from '../sim/buildings/defs';
import { bridge, ui } from './store';
import { loads, resName } from './format';

const POLICY_TEXT = ['Nhận', 'Không nhận', 'Đi lấy'];

export function InfoPanel() {
  const b = ui.value?.selected;
  const close = () => bridge.select(-1, -1);
  const f = ui.value?.selectedFigure;
  if (!b && f) {
    // M6c: bấm vào walker → câu thoại theo trạng thái
    return (
      <div class="panel info">
        <div class="head"><strong>{f.name}</strong><button onClick={close}>✕</button></div>
        <p class="speech">“{f.text}”</p>
        <p class="muted">Ô ({f.x}, {f.y})</p>
      </div>
    );
  }
  if (!b) return null;
  const svc = b.services;
  return (
    <div class="panel info">
      <div class="head">
        <strong>{b.name}{b.flooded ? ' — đang ngập' : ''}</strong>
        <button onClick={close}>✕</button>
      </div>
      {b.problem && !b.flooded && <p class="bad">⚠ {b.problem[0].toUpperCase() + b.problem.slice(1)}</p>}
      {b.dike && (
        <>
          <p>
            Cao {b.dike.height}/{b.dike.target}
            {b.dike.height > 0 && <> · độ bền <span class={b.dike.integrity < 60 ? 'bad' : ''}>{b.dike.integrity}%</span></>}
            {b.dike.height < b.dike.target && <> · {b.dike.working ? 'phu đê đang đắp' : 'chờ phu đê'} {b.dike.workPct}%</>}
          </p>
          <p>
            {b.dike.target < 4 && <button onClick={() => bridge.cmd({ type: 'build', kind: b.type === BuildingType.Sluice ? 'sluice' : 'dike', x: b.x, y: b.y })}>Tôn cao thêm</button>}{' '}
            {b.dike.sluiceOpen !== null && (
              <button class={b.dike.sluiceOpen ? 'active' : ''} onClick={() => bridge.cmd({ type: 'openSluice', buildingId: b.id, open: !b.dike!.sluiceOpen })}>
                {b.dike.sluiceOpen ? 'Cống đang mở — đóng lại' : 'Mở cống cho nước vào'}
              </button>
            )}
          </p>
          {b.dike.height > 0 && b.dike.height < b.dike.target && <div class="progress"><div style={{ width: `${b.dike.workPct}%` }} /></div>}
          <p class="muted">Nước lan khi cao độ ô + cao đê &lt; mực lũ. Thợ cả đi qua đặt lại độ bền 100.</p>
        </>
      )}
      {b.paddy && (
        <p>
          Sản lượng {b.paddy.yieldPct}%
          {b.paddy.silted ? ' · có phù sa' : b.paddy.dryYears >= 5 ? ` · bạc màu (${b.paddy.dryYears} năm không ngập)` : ` · ${b.paddy.dryYears} năm không ngập`}
        </p>
      )}
      {b.pollutedDays > 0 && <p class="bad">Giếng nhiễm bẩn sau lũ, còn {b.pollutedDays} ngày</p>}
      {b.hp !== null && <p>Độ bền: chịu thêm {b.hp} đòn giặc</p>}
      {b.isHouse && (
        <>
          <p>Bậc {b.level} · {b.population}/{b.capacity} người · lòng dân {b.happiness}</p>
          {b.devolving && <p class="bad">Sắp xuống bậc: thiếu {b.devolving}</p>}
          {b.nextLevel && b.population > 0 && (
            <p>{b.missing ? <>Muốn lên <em>{b.nextLevel}</em> cần: <strong>{b.missing}</strong></> : <>Đang lên <em>{b.nextLevel}</em></>}</p>
          )}
          <table class="mini">
            <tbody>
              <tr><td>Nước</td><td>{['không', 'giếng', 'giếng gạch'][svc.water]}</td><td>Đình</td><td>{svc.dinh ? 'có' : '—'}</td></tr>
              <tr><td>Chùa</td><td>{svc.temple ? 'có' : '—'}</td><td>Thầy đồ</td><td>{svc.school ? 'có' : '—'}</td></tr>
              <tr><td>Thầy lang</td><td>{svc.clinic ? 'có' : '—'}</td><td>Hát chèo</td><td>{svc.entertainment ? 'có' : '—'}</td></tr>
              <tr><td>Chợ</td><td>{svc.market ? 'có' : '—'}</td><td>Thuế</td><td>{svc.tax ? 'đang thu' : 'chưa có lại'}</td></tr>
              <tr><td>Trường học</td><td>{svc.academy ? 'có' : '—'}</td><td>Rối nước</td><td>{svc.puppet ? 'có' : '—'}</td></tr>
              <tr><td>Đền</td><td>{svc.shrine ? 'có' : '—'}</td><td>Đàn tế</td><td>{svc.altar ? 'có' : '—'}</td></tr>
            </tbody>
          </table>
        </>
      )}
      {!b.isHouse && b.workersNeeded > 0 && (
        <p class={b.workers < b.workersNeeded ? 'bad' : ''}>
          Nhân công {b.workers}/{b.workersNeeded}
          {!b.roadAccess ? ' · cần đường kề' : !b.laborAccess ? ' · người mộ phu chưa thấy nhà nào' : ''}
        </p>
      )}
      {!b.isHouse && b.workersNeeded === 0 && !b.roadAccess && b.type !== BuildingType.Ruins && !b.dike && <p class="muted">Không cần người làm</p>}
      {b.progressMax > 0 && (
        <div class="progress"><div style={{ width: `${Math.min(100, (b.progress * 100) / b.progressMax)}%` }} /></div>
      )}
      {b.store.length > 0 && (
        <p>{b.store.map((x) => `${x.name} ${b.isHouse ? x.units : loads(x.units)}`).join(' · ')}{!b.isHouse && ' (kiện)'}</p>
      )}
      {b.policy && (
        <table class="mini policy">
          <tbody>
            {(b.type === BuildingType.Granary ? FOODS : RESOURCES.map((_, i) => i).slice(1)).map((r) => (
              <tr>
                <td>{resName(r)}</td>
                <td>
                  {[StorePolicy.Accept, StorePolicy.Refuse, StorePolicy.Get].map((p) => (
                    <button class={b.policy![r] === p ? 'active' : ''} onClick={() => bridge.cmd({ type: 'setStorePolicy', buildingId: b.id, resource: r, policy: p })}>
                      {POLICY_TEXT[p]}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {b.type !== BuildingType.Ruins && !b.dike && (
        <p class="muted">Nguy cơ cháy {Math.min(100, b.fireRisk)}% · sập {Math.min(100, Math.round(b.damageRisk / 2))}%</p>
      )}
    </div>
  );
}
