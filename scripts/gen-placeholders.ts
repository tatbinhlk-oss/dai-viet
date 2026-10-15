// M6-0: sinh hình tạm (khối màu có nhãn tên) vào assets/ — chạy bằng `npm run assets:gen` (tsx, @napi-rs/canvas).
// Khi có hình thật, thả PNG cùng tên vào assets/ và chạy `npm run assets:pack`; file này không cần chạy lại.
// Kích thước và điểm neo theo 5 điểm kỹ thuật chốt từ M1: ô 64×32, công trình N×N rộng N×64, neo (0.5, 1) = góc dưới hình thoi móng.
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BuildingType, FigureType, Resource } from '../src/sim/state';
import { blockColors, COLOR, dikeHeightPx, FIG_COLOR, HOUSE_COLORS, RES_COLOR, typeHeight } from '../src/render/palette';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'assets');
const TILE_W = 64, TILE_H = 32, HALF_W = 32, HALF_H = 16;
GlobalFonts.registerFromPath(join(ASSETS, 'fonts', 'DejaVuSans-Bold.ttf'), 'Placeholder');

const buildings = JSON.parse(readFileSync(join(ROOT, 'src/data/buildings.json'), 'utf8')) as Record<string, { name: string; short?: string; size: number }>;
const houses = JSON.parse(readFileSync(join(ROOT, 'src/data/houses.json'), 'utf8')) as { levels: { name: string }[] };
const resources = JSON.parse(readFileSync(join(ROOT, 'src/data/resources.json'), 'utf8')) as { list: { key: string }[] };

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const generated: string[] = [];
/** Hình thật do scripts/gen-art.ts vẽ: không đè bằng khối màu. */
const art = new Set<string>(existsSync(join(ASSETS, 'art.json')) ? (JSON.parse(readFileSync(join(ASSETS, 'art.json'), 'utf8')) as { files: string[] }).files : []);
function save(rel: string, canvas: ReturnType<typeof createCanvas>): void {
  if (art.has(rel)) return;
  const file = join(ASSETS, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, canvas.toBuffer('image/png'));
  generated.push(rel);
}
const poly = (g: SKRSContext2D, pts: number[], fill: string) => {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
};

/** Nhãn tên: chữ đậm nhỏ, viền tối 1 px, căn giữa, tối đa 2 dòng; không khung bo góc. */
function label(g: SKRSContext2D, text: string, cx: number, cy: number, maxW: number, px: number): void {
  g.font = `bold ${px}px Placeholder`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let lines = [text];
  if (g.measureText(text).width > maxW && text.includes(' ')) {
    const words = text.split(' ');
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  const lh = px + 2;
  lines.forEach((ln, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lh;
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(20,16,10,0.95)';
    g.strokeText(ln, cx, y);
    g.fillStyle = '#fff6e0';
    g.fillText(ln, cx, y);
  });
}

/** Khối N×N cao h với nhãn. Ảnh rộng N×64, cao N×32 + h; neo (0.5, 1) = đỉnh dưới hình thoi. */
function block(n: number, h: number, col: [number, number, number], text: string): ReturnType<typeof createCanvas> {
  const W = n * TILE_W, H = n * TILE_H + h;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  const L = [0, H - n * HALF_H], R = [W, H - n * HALF_H], B = [W / 2, H], T = [W / 2, H - n * TILE_H];
  poly(g, [L[0], L[1], L[0], L[1] - h, B[0], B[1] - h, B[0], B[1]], hex(col[0]));
  poly(g, [B[0], B[1], B[0], B[1] - h, R[0], R[1] - h, R[0], R[1]], hex(col[1]));
  poly(g, [T[0], T[1] - h, R[0], R[1] - h, B[0], B[1] - h, L[0], L[1] - h], hex(col[2]));
  label(g, text, W / 2, H - h - n * HALF_H, W - 8, n === 1 ? 9 : 10);
  return c;
}

// ---------- công trình ----------
for (const [key, def] of Object.entries(buildings)) {
  if (key.startsWith('_') || key === 'house' || key === 'dike' || key === 'sluice') continue;
  const t = BuildingType[(key[0].toUpperCase() + key.slice(1)) as keyof typeof BuildingType];
  save(`buildings/${key}.png`, block(def.size, typeHeight(t, def.size, 0), blockColors(t, 0), def.short ?? def.name));
}
// đống tro theo kích thước 1–3 (render đọc kích thước từ bLevel)
for (const n of [1, 2, 3]) save(`buildings/ruins_${n}.png`, block(n, typeHeight(BuildingType.Ruins, n, 0), blockColors(BuildingType.Ruins, 0), 'Tro'));
// nhà theo bậc 0..10
houses.levels.forEach((lv, level) => {
  const text = level <= 1 ? `Lều ${level}` : `Nhà ${level}`;
  save(`houses/house_l${level}.png`, block(1, typeHeight(BuildingType.House, 1, level), HOUSE_COLORS[level], text));
  if (level >= 1 && level <= 9) save(`houses/house2_l${level}.png`, block(2, typeHeight(BuildingType.House, 2, level), HOUSE_COLORS[level], `${text} ⊞`)); // 2×2: gộp (1–8) hoặc Tư dinh (9)
  if (level === 10) save(`houses/house3_l${level}.png`, block(3, typeHeight(BuildingType.House, 3, level), HOUSE_COLORS[level], text)); // Phủ đệ 3×3
});

// ---------- đất nền (64×32, neo (0.5, 1) = đỉnh dưới) ----------
function diamond(fill: string, alpha = 1, edge?: string): ReturnType<typeof createCanvas> {
  const c = createCanvas(TILE_W, TILE_H);
  const g = c.getContext('2d');
  g.globalAlpha = alpha;
  poly(g, [HALF_W, 0, TILE_W, HALF_H, HALF_W, TILE_H, 0, HALF_H], fill);
  if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.stroke(); }
  return c;
}
COLOR.grass.forEach((c, i) => save(`ground/grass${i}.png`, diamond(hex(c))));
save('ground/floodplain.png', diamond(hex(COLOR.floodplain)));
save('ground/water.png', diamond(hex(COLOR.water)));
save('ground/road.png', diamond(hex(COLOR.road), 1, hex(COLOR.roadEdge)));
{ // M7: cầu gỗ — nền sông, ván ngang
  const c = diamond(hex(COLOR.water)); const g = c.getContext('2d');
  poly(g, [HALF_W, 3, TILE_W - 6, HALF_H, HALF_W, TILE_H - 3, 6, HALF_H], hex(COLOR.bridge));
  g.strokeStyle = hex(COLOR.bridgeEdge); g.lineWidth = 1;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(HALF_W + k * 4 - 10, HALF_H + k * 2 - 5); g.lineTo(HALF_W + k * 4 + 10, HALF_H + k * 2 + 5); g.stroke(); }
  save('ground/bridge.png', c);
}
save('ground/floor.png', diamond(hex(COLOR.floor)));
save('ground/sunken.png', diamond(hex(COLOR.sunken)));
save('ground/flooded.png', diamond(hex(COLOR.flooded), 0.65));
save('ground/overlay_unprotected.png', diamond(hex(COLOR.overlayUnprotected), 0.35));
save('ground/overlay_protected.png', diamond(hex(COLOR.overlayProtected), 0.35));
save('ground/reserved.png', diamond(hex(COLOR.reserved), 0.45)); // M6b: đất chưa cấp
save('ground/overlay_white.png', diamond('#ffffff')); // QoL: lớp phủ thông tin — render tô màu (tint) và độ mờ theo giá trị
{
  const c = createCanvas(TILE_W, TILE_H); const g = c.getContext('2d');
  g.beginPath(); g.arc(HALF_W, TILE_H - 6, 7, 0, Math.PI * 2); g.fillStyle = hex(COLOR.tree); g.fill();
  save('ground/tree.png', c);
}
/** Đoạn đê cao h (0 = mới vẽ) có/không đường vắt qua; cống có khe đóng/mở. */
function dike(h: number, road: boolean, sluice: 'none' | 'open' | 'closed', text: string): ReturnType<typeof createCanvas> {
  const hp = dikeHeightPx(h), H = TILE_H + hp;
  const c = createCanvas(TILE_W, H); const g = c.getContext('2d');
  const col = h === 0 ? COLOR.dikePlanned : COLOR.dike;
  const L = [0, H - HALF_H], R = [TILE_W, H - HALF_H], B = [HALF_W, H], T = [HALF_W, H - TILE_H];
  poly(g, [L[0], L[1], L[0], L[1] - hp, B[0], B[1] - hp, B[0], B[1]], hex(col[0]));
  poly(g, [B[0], B[1], B[0], B[1] - hp, R[0], R[1] - hp, R[0], R[1]], hex(col[1]));
  poly(g, [T[0], T[1] - hp, R[0], R[1] - hp, B[0], B[1] - hp, L[0], L[1] - hp], road ? hex(COLOR.road) : hex(col[2]));
  if (sluice !== 'none') poly(g, [T[0], T[1] - hp + 6, T[0] + 10, T[1] - hp + 11, T[0], T[1] - hp + 16, T[0] - 10, T[1] - hp + 11], sluice === 'open' ? hex(COLOR.sluiceGate) : '#2a2418');
  if (h === 0) { g.strokeStyle = '#d8c890'; g.lineWidth = 1; g.beginPath(); g.moveTo(T[0], T[1] - hp); g.lineTo(R[0], R[1] - hp); g.lineTo(B[0], B[1] - hp); g.lineTo(L[0], L[1] - hp); g.closePath(); g.stroke(); }
  label(g, text, HALF_W, H - hp - HALF_H, TILE_W - 6, 8);
  return c;
}
for (let h = 0; h <= 4; h++) {
  save(`ground/dike${h}.png`, dike(h, false, 'none', h === 0 ? 'Đê?' : `Đê ${h}`));
  save(`ground/dike${h}_road.png`, dike(h, true, 'none', `Đê ${h}`));
  save(`ground/sluice${h}_closed.png`, dike(h, false, 'closed', 'Cống'));
  save(`ground/sluice${h}_open.png`, dike(h, false, 'open', 'Cống'));
}

// ---------- walker: 4 hướng × 4 khung, neo (0.5, 1) = chân ----------
const DIRS = ['ne', 'se', 'sw', 'nw'] as const;
const CARRIERS = new Set([FigureType.CartPusher, FigureType.Warehouseman, FigureType.Convoy, FigureType.Boat, FigureType.Caravan, FigureType.TradeShip]);
function figure(type: FigureType, dir: string, frame: number, full: boolean): ReturnType<typeof createCanvas> {
  const color = hex(FIG_COLOR[type] ?? 0xffffff);
  const W = 32, H = 32;
  const c = createCanvas(W, H); const g = c.getContext('2d');
  const flip = dir === 'sw' || dir === 'nw';
  const back = dir === 'ne' || dir === 'nw';
  g.translate(W / 2, H);
  if (flip) g.scale(-1, 1);
  const step = [0, 2, 0, -2][frame]; // chân đung đưa
  if (type === FigureType.Boat || type === FigureType.TradeShip) {
    poly(g, [-14, -4, -8, -8, 8, -8, 14, -4, 8, 0, -8, 0], color);
    if (full) poly(g, [-4, -12, 4, -12, 4, -7, -4, -7], '#c8b090');
    g.fillStyle = '#d0b090'; g.fillRect(-2 + step, -14, 3, 6);
  } else if (CARRIERS.has(type)) {
    poly(g, [-7, -10, 7, -10, 7, -2, -7, -2], color); // thùng xe
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(-4, -2, 2, 0, Math.PI * 2); g.arc(4, -2, 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d0b090'; g.fillRect(9, -12, 3, 3); g.fillStyle = '#3a2a1a'; g.fillRect(9 + step / 2, -9, 3, 8); // người đẩy
    if (full) poly(g, [-5, -15, 5, -15, 5, -10, -5, -10], '#e8dcc0');
  } else if (type === FigureType.Enemy || type === FigureType.Militia || type === FigureType.CourtTroops) {
    g.fillStyle = color; g.beginPath(); g.arc(0, -11, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = type === FigureType.Enemy ? '#402020' : type === FigureType.CourtTroops ? '#a07020' : '#802020'; g.fillRect(-3, -8, 6, 7); // áo giáp
    g.fillStyle = '#d0d0d0'; g.fillRect(5, -16, 2, 12); // giáo
    g.fillStyle = '#3a2a1a'; g.fillRect(-3, -1, 2, 1 + Math.abs(step) / 2); g.fillRect(1, -1 - Math.abs(step) / 2, 2, 1 + Math.abs(step) / 2);
  } else if (type === FigureType.LevyWorker || type === FigureType.Soldiers) {
    for (const dx of [-8, 0, 8]) { g.fillStyle = color; g.beginPath(); g.arc(dx, -9, 3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(dx - 2 + (dx === 0 ? step : -step) / 2, -6, 4, 6); }
  } else if (type === FigureType.Mandarin) {
    g.fillStyle = color; g.fillRect(-9, -15, 18, 6); g.fillStyle = '#8a2a2a'; g.fillRect(-6, -9, 12, 6);
    g.fillStyle = '#d0b090'; g.beginPath(); g.arc(-11, -5, 3, 0, Math.PI * 2); g.arc(11, -5, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2a1a'; g.fillRect(-12 + step / 2, -3, 3, 3); g.fillRect(10 - step / 2, -3, 3, 3);
  } else {
    g.fillStyle = color; g.beginPath(); g.arc(0, -11, 4, 0, Math.PI * 2); g.fill(); // đầu màu áo (như placeholder cũ)
    g.fillStyle = back ? '#1e1e1e' : '#2a2a2a'; g.fillRect(-2, -8, 4, 6); // thân
    g.fillStyle = '#3a2a1a'; g.fillRect(-3, -2, 2, 2 + Math.abs(step) / 2); g.fillRect(1, -2 - Math.abs(step) / 2, 2, 2 + Math.abs(step) / 2); // chân
    if (!back) { g.fillStyle = '#f0d8b0'; g.fillRect(1, -12, 2, 2); } // mặt quay về phía người xem
    if (type === FigureType.MarketBuyer) { g.fillStyle = '#d8c080'; g.fillRect(-9, -13, 3, 3); g.fillRect(6, -13, 3, 3); }
  }
  return c;
}
for (const name of Object.keys(FigureType)) {
  const type = FigureType[name as keyof typeof FigureType];
  if (typeof type !== 'number' || type === FigureType.None) continue;
  const key = name[0].toLowerCase() + name.slice(1);
  for (const dir of DIRS) for (let f = 0; f < 4; f++) {
    save(`figures/${key}_${dir}_${f}.png`, figure(type, dir, f, false));
    if (CARRIERS.has(type)) save(`figures/${key}_full_${dir}_${f}.png`, figure(type, dir, f, true));
  }
}
// kiện hàng theo loại, đè lên xe / thuyền đầy
resources.list.forEach((r, i) => {
  if (i === 0) return;
  const c = createCanvas(10, 5); const g = c.getContext('2d');
  g.fillStyle = hex(RES_COLOR[i] ?? 0xffffff); g.fillRect(0, 0, 10, 5);
  save(`figures/cargo_${r.key}.png`, c);
});
void Resource;

writeFileSync(join(ASSETS, 'placeholders.json'), JSON.stringify({ _note: 'Danh sách PNG do scripts/gen-placeholders.ts sinh (hình tạm). Thay hình thật thì xóa khỏi danh sách hoặc chạy lại pack.', files: generated.sort() }, null, 2) + '\n');
console.log(`đã sinh ${generated.length} hình tạm vào assets/`);
