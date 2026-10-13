// Bảng chi tiết công trình đang chọn (công cụ "Xem").
import { BuildingType, FOODS, StorePolicy } from '../sim/state';
import { RESOURCES } from '../sim/buildings/defs';
import { bridge, ui } from './store';
import { loads, resName } from './format';

const POLICY_TEXT = ['Nhận', 'Không nhận', 'Đi lấy'];

export function InfoPanel() {
  const b = ui.value?.selected;
  if (!b) return null;
  const close = () => bridge.select(-1, -1);
  const svc = b.services;
  return (
    <div class="panel info">
      <div class="head">
        <strong>{b.name}</strong>
        <button onClick={close}>✕</button>
      </div>
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
      {!b.isHouse && b.workersNeeded === 0 && !b.roadAccess && b.type !== BuildingType.Ruins && <p class="muted">Không cần người làm</p>}
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
      {b.type !== BuildingType.Ruins && (
        <p class="muted">Nguy cơ cháy {Math.min(100, b.fireRisk)}% · sập {Math.min(100, Math.round(b.damageRisk / 2))}%</p>
      )}
    </div>
  );
}
