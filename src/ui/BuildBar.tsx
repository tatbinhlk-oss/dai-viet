import { BUILDING_DEFS, BUILDING_KEYS } from '../sim/buildings/defs';
import { BuildingType } from '../sim/state';
import { GROUPS, TERRAIN_HINT } from './format';
import { bridge, hoverText, openGroup, overlay, showNames, tool, ui } from './store';
import { OVERLAY_MODES, type OverlayMode } from '../sim/overlay';
import { RANK_NAMES } from '../sim/city/court';

const byGroup = new Map<string, string[]>();
for (const [key, t] of BUILDING_KEYS) {
  if (t === BuildingType.None || t === BuildingType.Ruins) continue;
  const g = BUILDING_DEFS[t].group;
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g)!.push(key);
}

function pick(t: string) {
  tool.value = t;
  if (t !== 'inspect') bridge.select(-1, -1);
}

function describe(key: string): string {
  const d = BUILDING_DEFS[BUILDING_KEYS.get(key)!];
  const parts = [`${d.name} — ${d.cost} quan`, `${d.size}×${d.size}`];
  if (d.workers) parts.push(`${d.workers} người làm`);
  if (TERRAIN_HINT[d.terrain]) parts.push(TERRAIN_HINT[d.terrain]);
  if (d.terrain === 'land') parts.push('phu đê từ đình làng tới đắp; đặt lại lên đoạn có sẵn để tôn cao');
  if (d.rank > 0) parts.push(`cần phẩm hàm ${RANK_NAMES[d.rank]}`);
  return parts.join(' · ');
}

export function BuildBar() {
  const g = openGroup.value;
  return (
    <div class="bar build">
      <div class="row">
        <button class={tool.value === 'inspect' ? 'active' : ''} onClick={() => { pick('inspect'); openGroup.value = null; }}>Xem</button>
        <button class={tool.value === 'road' ? 'active' : ''} onClick={() => { pick('road'); openGroup.value = null; }}>Đường</button>
        {GROUPS.map(([id, label]) => (
          <button class={g === id ? 'open' : ''} onClick={() => (openGroup.value = g === id ? null : id)}>{label}</button>
        ))}
        <button class={tool.value === 'raze' ? 'active' : ''} onClick={() => { pick('raze'); openGroup.value = null; }}>Phá</button>
        <span class="sp" />
        <label class="overlaypick" title={OVERLAY_MODES.find((m) => m.key === overlay.value)?.hint || 'Lớp phủ thông tin trên bản đồ (như Caesar 3)'}>
          Lớp phủ{' '}
          <select class={overlay.value ? 'active' : ''} value={overlay.value} onChange={(e) => (overlay.value = (e.currentTarget as HTMLSelectElement).value as OverlayMode)}>
            {OVERLAY_MODES.map((m) => <option value={m.key}>{m.name}</option>)}
          </select>
        </label>
        <button class={showNames.value ? 'active' : ''} title="Ghi tên công trình lên hình (hình tạm đã có sẵn tên)" onClick={() => (showNames.value = !showNames.value)}>Hiện tên</button>
      </div>
      {g && (
        <div class="row sub">
          {(byGroup.get(g) ?? []).map((key) => (
            <button
              class={tool.value === key ? 'active' : ''}
              disabled={BUILDING_DEFS[BUILDING_KEYS.get(key)!].rank > (ui.value?.city.court.rank ?? 0)}
              onClick={() => pick(key)}
              onMouseEnter={() => (hoverText.value = describe(key))}
            >
              {BUILDING_DEFS[BUILDING_KEYS.get(key)!].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const toolSize = (t: string): number => {
  if (t === 'road' || t === 'raze' || t === 'inspect') return 1;
  const type = BUILDING_KEYS.get(t);
  return type ? BUILDING_DEFS[type].size : 1;
};
