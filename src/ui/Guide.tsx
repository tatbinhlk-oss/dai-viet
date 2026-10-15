// Sổ tay: tra cứu mọi công trình theo nhóm (hình, công dụng, yêu cầu), bậc nhà và hạ tầng (đường, cầu, phá).
// Số liệu lấy từ buildings.json / houses.json; lời giải thích trong src/data/guide.json. Hình cắt từ sheet buildings (public/sheets).
import { useEffect, useRef, useState } from 'preact/hooks';
import { BUILDING_DEFS, BUILDING_KEYS, economy, HOUSE_LEVELS, RESOURCES } from '../sim/buildings/defs';
import { BuildingType } from '../sim/state';
import { LABOR_NAMES } from '../sim/city/labor';
import { RANK_NAMES } from '../sim/city/court';
import { FIGURE_NAMES } from '../sim/figures/dialogue';
import { GROUPS, TERRAIN_HINT } from './format';
import { bridge, openGroup, panel, tool, ui } from './store';
import guideJson from '../data/guide.json';
import type { SheetJson } from '../render/sheets';

const GUIDE = guideJson as unknown as Record<string, { use: string; tip?: string }>;
const SHEET_URL = `${import.meta.env.BASE_URL}sheets/`;

/** Sheet buildings nạp một lần cho mọi hình nhỏ. */
let sheetPromise: Promise<{ json: SheetJson; img: HTMLImageElement } | null> | null = null;
function loadSheet(): Promise<{ json: SheetJson; img: HTMLImageElement } | null> {
  sheetPromise ??= (async () => {
    try {
      const json = (await (await fetch(`${SHEET_URL}buildings.json`)).json()) as SheetJson;
      const img = new Image();
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('sheet')); img.src = `${SHEET_URL}${json.image}`; });
      return { json, img };
    } catch { return null; }
  })();
  return sheetPromise;
}

/** Hình công trình cắt từ sheet, thu vừa khung 96×80. */
function Thumb({ frame }: { frame: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    loadSheet().then((s) => {
      const c = ref.current;
      if (!alive || !s || !c) return;
      const f = s.json.frames[frame];
      if (!f) return;
      const sc = s.json.scale ?? 1, w = f.w / sc, h = f.h / sc, fit = Math.min(1, 96 / w, 80 / h);
      c.width = Math.round(w * fit * 2); c.height = Math.round(h * fit * 2);
      c.style.width = `${Math.round(w * fit)}px`; c.style.height = `${Math.round(h * fit)}px`;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = true;
      g.drawImage(s.img, f.x, f.y, f.w, f.h, 0, 0, c.width, c.height);
    });
    return () => { alive = false; };
  }, [frame]);
  return <canvas ref={ref} class="thumb" />;
}

const resName = (r: number): string => RESOURCES[r]?.name ?? '';

/** Dòng yêu cầu / thông số tự tính từ định nghĩa. */
function specs(key: string): string[] {
  const t = BUILDING_KEYS.get(key)!;
  const d = BUILDING_DEFS[t];
  const out: string[] = [];
  out.push(d.cost ? `${d.cost} quan` : 'miễn phí', `${d.size}×${d.size} ô`);
  if (d.workers) out.push(`${d.workers} người làm (${d.labor >= 0 ? LABOR_NAMES[d.labor] : ''})`); else out.push('không cần người làm');
  if (TERRAIN_HINT[d.terrain]) out.push(TERRAIN_HINT[d.terrain]);
  if (d.rank > 0) out.push(`cần phẩm hàm ${RANK_NAMES[d.rank]}`);
  if (d.input) out.push(`nguyên liệu: ${resName(d.input)}`);
  if (d.produces) out.push(`sản phẩm: ${resName(d.produces)}`);
  if (d.walker) out.push(`walker: ${FIGURE_NAMES[d.walker.figure] ?? ''} (đi dạo ${d.walker.roam} ô)`);
  if (d.waterLevel) out.push(`cấp nước mức ${d.waterLevel}, tầm ${d.waterRange} ô`);
  if (d.desirability) out.push(`độ hấp dẫn ${d.desirability.value > 0 ? '+' : ''}${d.desirability.value} (tầm ${d.desirability.range})`);
  if (d.fire || d.damage) out.push(`${d.fire ? 'dễ cháy' : ''}${d.fire && d.damage ? ', ' : ''}${d.damage ? 'dễ sập' : ''}`);
  const needsRoad = !(t === BuildingType.Garden || t === BuildingType.LotusPond || t === BuildingType.Well || t === BuildingType.Dike || t === BuildingType.Sluice || t === BuildingType.EarthWall || t === BuildingType.StoneWall || t === BuildingType.Gate || t === BuildingType.Paddy || t === BuildingType.SaltPan);
  if (needsRoad) out.push('cần đường kề');
  return out;
}

/** Yêu cầu của một bậc nhà (defs.ts đã cộng dồn; 0 / −100 là không yêu cầu), diễn thành lời. */
function houseNeeds(level: number): string {
  const n = HOUSE_LEVELS[level].needs as unknown as Record<string, unknown>;
  const parts: string[] = [];
  if (n.water === 1) parts.push('nước giếng'); if (n.water === 2) parts.push('nước giếng gạch');
  if (typeof n.foodTypes === 'number' && n.foodTypes > 0) parts.push(`${n.foodTypes} loại lương thực`);
  if (n.dinh) parts.push('lý trưởng (đình)'); if (n.temple) parts.push('sư (chùa)'); if (n.school) parts.push('thầy đồ'); if (n.clinic) parts.push('thầy lang');
  if (n.entertainment) parts.push('phường chèo'); if (n.market) parts.push('chợ ghé'); if (n.academy) parts.push('thầy giáo (trường học)'); if (n.puppet) parts.push('rối nước'); if (n.shrine) parts.push('miếu Hà Bá');
  if (Array.isArray(n.goods) && n.goods.length) parts.push(`hàng: ${(n.goods as (string | number)[]).map((k) => (typeof k === 'number' ? RESOURCES[k]?.name : RESOURCES.find((r) => r.key === k)?.name) ?? String(k)).join(', ')}`);
  if (typeof n.desirability === 'number' && n.desirability > -100) parts.push(`độ hấp dẫn ≥ ${n.desirability}`);
  return parts.length ? parts.join(', ') : 'không yêu cầu';
}

const byGroup = new Map<string, string[]>();
for (const [key, t] of BUILDING_KEYS) {
  if (t === BuildingType.None || t === BuildingType.Ruins) continue;
  const g = BUILDING_DEFS[t].group;
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g)!.push(key);
}
const SECTIONS: [string, string][] = [...GROUPS, ['houses', 'Bậc nhà'], ['infra', 'Đường, cầu, phá']];
const INFRA: [string, string, string[]][] = [
  ['road', 'Đường', ['miễn phí', 'kéo để vẽ đoạn, gấp khúc một lần']],
  ['bridge', 'Cầu gỗ', [`${economy.bridgeCost} quan mỗi ô`, 'chỉ trên ô sông']],
  ['raze', 'Phá', ['kéo vùng để phá nhiều', 'Ctrl+Z hoàn tác lần xây gần nhất']],
];

/** Chọn công cụ xây từ sổ tay rồi mở nhóm tương ứng trên thanh xây. */
function pickTool(key: string): void {
  const t = BUILDING_KEYS.get(key);
  const rank = ui.value?.city.court.rank ?? 0;
  if (t !== undefined && BUILDING_DEFS[t].rank > rank) return;
  tool.value = key;
  openGroup.value = t !== undefined ? BUILDING_DEFS[t].group : null;
  bridge.select(-1, -1);
  panel.value = null;
}

export function Guide() {
  const [sec, setSec] = useState<string>('home');
  const rank = ui.value?.city.court.rank ?? 0;
  return (
    <div class="guide">
      <p class="tabs">{SECTIONS.map(([id, label]) => <button class={sec === id ? 'active' : ''} onClick={() => setSec(id)}>{label}</button>)}</p>
      {sec === 'houses' && (
        <>
          <p class="muted">Yêu cầu đã cộng dồn (bậc trên gồm cả yêu cầu bậc dưới). Thiếu một thứ thì nhà không lên, mất thì tụt bậc.</p>
          <table class="mini">
            <thead><tr><th>Bậc</th><th>Tên</th><th>Dân</th><th>Cần</th></tr></thead>
            <tbody>{HOUSE_LEVELS.map((lv, i) => <tr><td>{i}</td><td>{lv.name}</td><td>{lv.capacity}</td><td>{houseNeeds(i)}</td></tr>)}</tbody>
          </table>
          <p class="muted">Bậc 9–10 là nhà quan lại: chỉ có khi người đỗ khoa cử về ở hoặc nhà bậc 8 đủ điều kiện gộp 2×2.</p>
        </>
      )}
      {sec === 'infra' && INFRA.map(([key, name, sp]) => (
        <div class="entry">
          <div class="body">
            <p><strong>{name}</strong> <button class="small" onClick={() => pickTool(key)}>Chọn</button></p>
            <p class="muted">{sp.join(' · ')}</p>
            <p>{GUIDE[key]?.use}</p>
            {GUIDE[key]?.tip && <p class="tip">Mẹo: {GUIDE[key].tip}</p>}
          </div>
        </div>
      ))}
      {sec !== 'houses' && sec !== 'infra' && (byGroup.get(sec) ?? []).map((key) => {
        const t = BUILDING_KEYS.get(key)!, d = BUILDING_DEFS[t];
        const frame = t === BuildingType.House ? 'house_l1' : key;
        const locked = d.rank > rank;
        return (
          <div class="entry">
            <Thumb frame={frame} />
            <div class="body">
              <p><strong>{d.name}</strong> {locked ? <span class="muted">(cần phẩm hàm {RANK_NAMES[d.rank]})</span> : <button class="small" onClick={() => pickTool(key)}>Chọn</button>}</p>
              <p class="muted">{specs(key).join(' · ')}</p>
              <p>{GUIDE[key]?.use ?? ''}</p>
              {GUIDE[key]?.tip && <p class="tip">Mẹo: {GUIDE[key].tip}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
