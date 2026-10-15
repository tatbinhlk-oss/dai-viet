// Walker vẽ thật. Người: hàm person() + bảng kiểu STYLE theo FigureType (màu áo, mũ, đồ cầm, đi theo nhóm).
// Phương tiện: xe bò (CartPusher, Convoy), xe cút kít (Warehouseman), ngựa thồ (Caravan), kiệu (Mandarin), thuyền nan (Boat), thuyền buôn (TradeShip).
// Hướng: se = đi +x (xuống phải, vẽ gốc), sw = +y (lật gương se), ne = −y (lên phải, nhìn từ sau), nw = −x (lật gương ne).
// 4 khung bước. Neo (0.5, 1). Kiện hàng của xe / thuyền là sprite riêng render đè ở (0, −10) (thuyền −12).
import { FigureType } from '../../src/sim/state';
import { canvas, darken, hex, lighten, line, poly, type Canvas, type Ctx } from './lib';

const SKIN = 0xd8a878, HAT = 0xd8c080, HAT_DARK = 0xa08a48, PANTS = 0x2a2420;
const OX = 0x7a4a2c, OX_DARK = 0x46281a, OX_LIGHT = 0x9a6a44, HORN = 0xf0e8d0;
const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, WOOD_LIGHT = 0xc09060;
const BASKET = 0xb89a5a, WATER = 0x4a8ac0;

type Hat = 'non' | 'khan' | 'none' | 'helmet' | 'bald';
type Prop = 'none' | 'pole' | 'buckets' | 'bundle' | 'staff' | 'spear' | 'torch' | 'flag' | 'hoe' | 'book' | 'fan' | 'box' | 'drum' | 'raised' | 'whip' | 'puppet' | 'scroll';
export interface Style { shirt: number; pants?: number; hat: Hat; prop?: Prop; group?: number; long?: boolean /** áo dài (che quần) */ }

/** Bảng kiểu người theo loại walker. */
export const STYLE: Partial<Record<FigureType, Style>> = {
  [FigureType.DinhRoamer]: { shirt: 0x3a5a8a, hat: 'khan', prop: 'none', long: true },
  [FigureType.MarketTrader]: { shirt: 0xa06040, hat: 'non', prop: 'pole' },
  [FigureType.MarketBuyer]: { shirt: 0x8a6a3a, hat: 'non', prop: 'pole' },
  [FigureType.Immigrant]: { shirt: 0x7a5a3a, hat: 'non', prop: 'bundle', group: 3 },
  [FigureType.Emigrant]: { shirt: 0x5a4a3a, hat: 'non', prop: 'bundle', group: 2 },
  [FigureType.LaborSeeker]: { shirt: 0x6a7a8a, hat: 'non', prop: 'drum' },
  [FigureType.Monk]: { shirt: 0xc08a30, hat: 'bald', prop: 'none', long: true },
  [FigureType.Teacher]: { shirt: 0x202030, hat: 'khan', prop: 'book', long: true },
  [FigureType.Healer]: { shirt: 0xe8e0d0, hat: 'khan', prop: 'box', long: true },
  [FigureType.WellKeeper]: { shirt: 0x5a7a9a, hat: 'non', prop: 'buckets' },
  [FigureType.Actor]: { shirt: 0xc83030, hat: 'none', prop: 'fan' },
  [FigureType.Watchman]: { shirt: 0x5a3a2a, hat: 'helmet', prop: 'staff' },
  [FigureType.Builder]: { shirt: 0x7a7a6a, hat: 'non', prop: 'hoe' },
  [FigureType.TaxCollector]: { shirt: 0x2a4a7a, hat: 'khan', prop: 'scroll', long: true },
  [FigureType.Protester]: { shirt: 0x8a6a4a, hat: 'none', prop: 'raised' },
  [FigureType.Thief]: { shirt: 0x202020, hat: 'none', prop: 'bundle' },
  [FigureType.Rioter]: { shirt: 0x6a3a2a, hat: 'none', prop: 'torch' },
  [FigureType.LevyWorker]: { shirt: 0x8a6a3a, hat: 'non', prop: 'hoe', group: 3 },
  [FigureType.Messenger]: { shirt: 0xc02020, hat: 'khan', prop: 'flag' },
  [FigureType.Soldiers]: { shirt: 0x6a4a2a, hat: 'helmet', prop: 'spear', group: 3 },
  [FigureType.TempleKeeper]: { shirt: 0xe0d8c0, hat: 'khan', prop: 'none', long: true },
  [FigureType.Academic]: { shirt: 0x2a5a6a, hat: 'khan', prop: 'book', long: true },
  [FigureType.Puppeteer]: { shirt: 0x3a8a5a, hat: 'none', prop: 'puppet' },
  [FigureType.Enemy]: { shirt: 0x301010, hat: 'helmet', prop: 'spear' },
  [FigureType.Militia]: { shirt: 0xa02020, hat: 'helmet', prop: 'spear' },
  [FigureType.CourtTroops]: { shirt: 0xc8a020, hat: 'helmet', prop: 'spear', group: 2 },
};

/** Người nhỏ (cao ~13 px) đứng tại chân (x, y); `back` = nhìn từ sau; chân bước theo `frame`. */
export function person(g: Ctx, x: number, y: number, frame: number, back: boolean, st: Style): void {
  const step = [0, 2, 0, -2][frame];
  const shirt = back ? darken(st.shirt, 0.15) : st.shirt;
  // gói đồ vác vai: sau lưng khi nhìn từ trước → vẽ trước thân
  if (st.prop === 'bundle' && !back) { g.fillStyle = hex(0xc8b890); g.beginPath(); g.ellipse(x - 4, y - 13, 3.5, 2.5, 0, 0, Math.PI * 2); g.fill(); }
  // chân
  g.fillStyle = hex(st.pants ?? PANTS);
  g.fillRect(x - 2 + step / 2, y - 5, 2, 5);
  g.fillRect(x - step / 2, y - 5, 2, 5);
  // thân (áo dài phủ xuống gần chân)
  g.fillStyle = hex(shirt);
  if (st.long) { g.fillRect(x - 3, y - 11, 6, 9); g.fillStyle = hex(darken(shirt, 0.25)); g.fillRect(x - 3, y - 4, 6, 1); }
  else g.fillRect(x - 3, y - 11, 6, 6);
  // tay
  g.fillStyle = hex(st.long ? shirt : SKIN);
  const raised = st.prop === 'raised';
  g.fillRect(x + 3, raised ? y - 16 : y - 10 + step / 2, 1, raised ? 7 : 4);
  g.fillRect(x - 4, y - 10 - step / 2, 1, 4);
  // đầu
  g.fillStyle = hex(SKIN);
  g.fillRect(x - 2, y - 14, 4, 3);
  if (!back) { g.fillStyle = hex(darken(SKIN, 0.4)); g.fillRect(x + 1, y - 13, 1, 1); }
  switch (st.hat) {
    case 'non': poly(g, [[x - 5, y - 13], [x + 5, y - 13], [x, y - 17]], hex(HAT)); line(g, [x - 5, y - 13], [x + 5, y - 13], hex(HAT_DARK), 1); break;
    case 'khan': g.fillStyle = hex(0x1a1a28); g.fillRect(x - 3, y - 16, 6, 2); g.fillStyle = hex(0x2a2a40); g.fillRect(x - 2, y - 17, 4, 1); break;
    case 'helmet': g.fillStyle = hex(0x3a3028); g.beginPath(); g.ellipse(x, y - 14, 3.5, 2.5, 0, Math.PI, 0); g.fill(); g.fillStyle = hex(0x8a7a50); g.fillRect(x - 1, y - 17, 2, 1); break;
    case 'none': g.fillStyle = hex(0x201810); g.fillRect(x - 2, y - 15, 4, 1); g.fillRect(x - 3, y - 14, 1, 2); break;
    case 'bald': break;
  }
  // đồ cầm
  switch (st.prop) {
    case 'pole': case 'buckets': {
      line(g, [x - 9, y - 11], [x + 9, y - 11], hex(WOOD_DARK), 1);
      for (const dx of [-8, 8]) {
        line(g, [x + dx, y - 11], [x + dx, y - 7], hex(WOOD_DARK), 1);
        g.fillStyle = hex(st.prop === 'buckets' ? WATER : BASKET);
        if (st.prop === 'buckets') g.fillRect(x + dx - 2, y - 7, 4, 4);
        else { g.beginPath(); g.ellipse(x + dx, y - 5, 3, 2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(darken(BASKET, 0.3)); g.fillRect(x + dx - 3, y - 5, 6, 1); }
      }
      break;
    }
    case 'staff': line(g, [x + 4, y], [x + 4, y - 14], hex(WOOD_DARK), 1); break;
    case 'spear': line(g, [x + 4, y - 1], [x + 4, y - 19], hex(WOOD_DARK), 1); g.fillStyle = hex(0xd0d0d8); g.fillRect(x + 3, y - 21, 2, 3); break;
    case 'torch': line(g, [x + 4, y - 4], [x + 4, y - 15], hex(WOOD_DARK), 1); g.fillStyle = hex(0xf0a020); g.fillRect(x + 3, y - 18, 3, 3); g.fillStyle = hex(0xf8e040); g.fillRect(x + 4, y - 19, 1, 2); break;
    case 'flag': line(g, [x + 4, y - 2], [x + 4, y - 20], hex(WOOD_DARK), 1); poly(g, [[x + 5, y - 20], [x + 11, y - 18], [x + 5, y - 15]], hex(0xd02020)); break;
    case 'hoe': line(g, [x + 3, y - 6], [x + 7, y - 17], hex(WOOD_DARK), 1); g.fillStyle = hex(0x6a6a70); g.fillRect(x + 6, y - 19, 4, 2); break;
    case 'book': g.fillStyle = hex(0xe8dcc0); g.fillRect(x + 3, y - 9, 3, 4); g.fillStyle = hex(0x8a2a2a); g.fillRect(x + 3, y - 9, 3, 1); break;
    case 'scroll': g.fillStyle = hex(0xf0e8d0); g.fillRect(x + 3, y - 10, 2, 5); break;
    case 'fan': poly(g, [[x + 4, y - 9], [x + 9, y - 13], [x + 10, y - 9]], hex(0xf0e0a0)); break;
    case 'box': g.fillStyle = hex(0x6a3a2a); g.fillRect(x + 3, y - 9, 5, 4); g.fillStyle = hex(0xc0a060); g.fillRect(x + 3, y - 8, 5, 1); break;
    case 'drum': g.fillStyle = hex(0x8a3a2a); g.fillRect(x + 3, y - 9, 5, 4); g.fillStyle = hex(0xe8d8b0); g.fillRect(x + 3, y - 9, 5, 1); line(g, [x + 8, y - 12], [x + 7, y - 8], hex(WOOD_DARK), 1); break;
    case 'puppet': line(g, [x + 4, y - 9], [x + 4, y - 15], hex(WOOD_DARK), 1); g.fillStyle = hex(0xe03030); g.fillRect(x + 3, y - 19, 3, 4); g.fillStyle = hex(SKIN); g.fillRect(x + 3, y - 21, 3, 2); break;
    case 'whip': line(g, [x + 3, y - 8], [x + 9, y - 14], hex(HAT_DARK), 1); break;
    default: break;
  }
  if (st.prop === 'bundle' && back) { g.fillStyle = hex(0xc8b890); g.beginPath(); g.ellipse(x - 4, y - 13, 3.5, 2.5, 0, 0, Math.PI * 2); g.fill(); }
}

function base(W: number, H: number, dir: string): { c: Canvas; g: Ctx; back: boolean } {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const flip = dir === 'sw' || dir === 'nw';
  const back = dir === 'ne' || dir === 'nw';
  g.translate(W / 2, H);
  if (flip) g.scale(-1, 1);
  return { c, g, back };
}
function shadow(g: Ctx, x: number, rx: number): void {
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, -1, rx, 2.5, 0, 0, Math.PI * 2); g.fill();
}

/** Người đi bộ (một hoặc nhóm 2–3 người so le). */
export function walkerFrame(st: Style, dir: string, frame: number): Canvas {
  const n = st.group ?? 1;
  const W = n > 1 ? 48 : 30, H = 30;
  const { c, g, back } = base(W, H, dir);
  const slots: [number, number][] = n === 1 ? [[0, 0]] : n === 2 ? [[-7, -3], [7, 0]] : [[-11, -2], [0, -5], [11, 0]];
  for (const [dx] of slots) shadow(g, dx, 6);
  for (const [dx, dy] of [...slots].sort((a, b) => a[1] - b[1])) person(g, dx, dy, (frame + (dx > 0 ? 2 : 0)) % 4, back, st); // người ở xa vẽ trước
  return c;
}

// ---------- phương tiện ----------
export function ox(g: Ctx, x: number, y: number, frame: number, back: boolean): void {
  const step = [2, 0, -2, 0][frame];
  g.fillStyle = hex(OX_DARK);
  g.fillRect(x - 6 + step / 2, y - 5, 2, 5); g.fillRect(x - 3 - step / 2, y - 5, 2, 5);
  g.fillRect(x + 3 + step / 2, y - 5, 2, 5); g.fillRect(x + 6 - step / 2, y - 5, 2, 5);
  g.fillStyle = hex(OX); g.beginPath(); g.ellipse(x, y - 8, 8.5, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(OX_LIGHT); g.beginPath(); g.ellipse(x - 1, y - 10, 5, 2, 0, 0, Math.PI * 2); g.fill();
  line(g, [x - 8, y - 9], [x - 10, y - 4 + step / 2], hex(OX_DARK), 1);
  if (back) {
    g.fillStyle = hex(OX_DARK); g.fillRect(x + 6, y - 13, 5, 5);
    line(g, [x + 5, y - 13], [x + 4, y - 16], hex(HORN), 1); line(g, [x + 11, y - 13], [x + 12, y - 16], hex(HORN), 1);
  } else {
    g.fillStyle = hex(OX); g.fillRect(x + 7, y - 12, 6, 6);
    g.fillStyle = hex(lighten(OX, 0.25)); g.fillRect(x + 10, y - 9, 3, 3);
    g.fillStyle = hex(darken(OX, 0.5)); g.fillRect(x + 10, y - 11, 1, 1);
    line(g, [x + 8, y - 12], [x + 6, y - 16], hex(HORN), 1.6); line(g, [x + 12, y - 12], [x + 14, y - 16], hex(HORN), 1.6);
    g.fillStyle = hex(OX_DARK); g.fillRect(x + 7, y - 13, 6, 1);
  }
}
function wheel(g: Ctx, cx: number, cy: number, r: number, frame: number): void {
  g.strokeStyle = hex(WOOD_DARK); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1; g.strokeStyle = hex(WOOD_LIGHT);
  for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3 + (frame * Math.PI) / 8; g.beginPath(); g.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
  g.fillStyle = hex(WOOD_DARK); g.fillRect(cx - 1, cy - 1, 2, 2);
}
export function cart(g: Ctx, x: number, y: number, frame: number, back: boolean, shaft = true): void {
  wheel(g, x + (back ? 2 : -2), y - 4, 3.5, frame);
  poly(g, [[x - 8, y - 6], [x + 8, y - 6], [x + 8, y - 11], [x - 8, y - 11]], hex(WOOD));
  line(g, [x - 8, y - 8.5], [x + 8, y - 8.5], hex(WOOD_DARK), 1);
  line(g, [x - 8, y - 11], [x + 8, y - 11], hex(WOOD_LIGHT), 1);
  g.fillStyle = hex(WOOD_DARK); g.fillRect(x - 8, y - 11, 1, 5); g.fillRect(x + 7, y - 11, 1, 5);
  if (shaft) line(g, [x + 8, y - 8], [x + 16, y - 7], hex(WOOD_DARK), 1.5);
  wheel(g, x + (back ? -2 : 2), y - 3, 4, frame);
}
/** Xe bò + người dắt (áo theo `shirt`). 44×26. */
export function oxCartFrame(dir: string, frame: number, shirt = 0x7a5030): Canvas {
  const { c, g, back } = base(44, 26, dir);
  const st: Style = { shirt, hat: 'non', prop: 'whip' };
  shadow(g, 2, 17);
  if (back) { g.save(); g.translate(13, -4); g.scale(0.85, 0.85); ox(g, 0, 0, frame, true); g.restore(); cart(g, 0, 0, frame, true); person(g, -13, 0, frame, true, st); }
  else { person(g, -13, -1, frame, false, st); cart(g, 0, 0, frame, false); ox(g, 14, 0, frame, false); }
  return c;
}
/** Xe cút kít hai bánh do phu kho đẩy. 36×26. */
export function handcartFrame(dir: string, frame: number): Canvas {
  const { c, g, back } = base(36, 26, dir);
  const st: Style = { shirt: 0x8a6a4a, hat: 'non' };
  shadow(g, 0, 13);
  if (back) { cart(g, 0, 0, frame, true, false); line(g, [-8, -8], [-13, -9], hex(WOOD_DARK), 1.5); person(g, -12, 0, frame, true, st); }
  else { person(g, -12, -1, frame, false, st); line(g, [-8, -8], [-13, -9], hex(WOOD_DARK), 1.5); cart(g, 0, 0, frame, false, false); }
  return c;
}
/** Ngựa thồ có bao hàng + người dắt. 40×28. */
export function horseFrame(dir: string, frame: number): Canvas {
  const { c, g, back } = base(40, 28, dir);
  const H = 0x6a4a3a, HD = 0x3e2a20, HL = 0x8a6a58;
  const step = [2, 0, -2, 0][frame];
  const st: Style = { shirt: 0x5a6a7a, hat: 'non' };
  shadow(g, 2, 14);
  const horse = (x: number, y: number) => {
    g.fillStyle = hex(HD);
    g.fillRect(x - 5 + step / 2, y - 6, 2, 6); g.fillRect(x - 2 - step / 2, y - 6, 2, 6); g.fillRect(x + 3 + step / 2, y - 6, 2, 6); g.fillRect(x + 6 - step / 2, y - 6, 2, 6);
    g.fillStyle = hex(H); g.beginPath(); g.ellipse(x, y - 9, 7.5, 3.5, 0, 0, Math.PI * 2); g.fill();
    line(g, [x - 7, y - 10], [x - 10, y - 5], hex(HD), 1);
    poly(g, [[x + 5, y - 11], [x + 9, y - 11], [x + 12, y - 18], [x + 9, y - 19]], hex(H)); // cổ
    g.fillStyle = hex(HL); g.fillRect(x + 10, y - 20, 4, 3); g.fillStyle = hex(HD); g.fillRect(x + 10, y - 21, 1, 2); // đầu, tai
    g.fillStyle = hex(0xa89060); g.fillRect(x - 5, y - 13, 9, 4); g.fillStyle = hex(0x8a7048); g.fillRect(x - 5, y - 10, 9, 1); // bao hàng
  };
  if (back) { g.save(); g.translate(6, -3); g.scale(0.9, 0.9); horse(0, 0); g.restore(); person(g, -11, 0, frame, true, st); }
  else { person(g, -12, -1, frame, false, st); horse(5, 0); }
  return c;
}
/** Kiệu quan hai phu khiêng. 44×30. */
export function palanquinFrame(dir: string, frame: number): Canvas {
  const { c, g, back } = base(44, 30, dir);
  const st: Style = { shirt: 0x8a6a4a, hat: 'non' };
  shadow(g, 0, 17);
  for (const x of [-13, 13]) person(g, x, 0, (frame + (x > 0 ? 2 : 0)) % 4, back, st);
  line(g, [-16, -12], [16, -12], hex(WOOD_DARK), 1.5); // đòn khiêng
  g.fillStyle = hex(0x8a2a2a); g.fillRect(-7, -20, 14, 9); // thùng kiệu
  g.fillStyle = hex(0xd0a040); g.fillRect(-7, -16, 14, 1);
  poly(g, [[-9, -20], [9, -20], [7, -24], [-7, -24]], hex(0x3a2a20)); // mái
  line(g, [-9, -20], [9, -20], hex(0xd0a040), 1);
  if (!back) { g.fillStyle = hex(0x1a1a28); g.fillRect(-3, -19, 6, 5); g.fillStyle = hex(SKIN); g.fillRect(-1, -18, 3, 2); } // quan ngồi trong
  return c;
}
/** Thuyền nan có người chèo (36×22) hoặc thuyền buôn có buồm (48×36); kiện hàng đè ở (0, −12). */
export function boatFrame(dir: string, frame: number, big = false): Canvas {
  const W = big ? 48 : 36, H = big ? 36 : 22;
  const { c, g, back } = base(W, H, dir);
  const L = big ? 22 : 16;
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, -1, L, 2, 0, 0, Math.PI * 2); g.fill();
  poly(g, [[-L, -6], [-L + 5, -9], [L - 5, -9], [L, -6], [L - 3, -1], [-L + 3, -1]], hex(big ? 0x6a4a30 : 0x8a6a40)); // thân cong hai đầu
  line(g, [-L + 5, -9], [L - 5, -9], hex(WOOD_LIGHT), 1);
  line(g, [-L + 2, -5], [L - 2, -5], hex(WOOD_DARK), 1);
  if (big) {
    line(g, [-4, -9], [-4, -32], hex(WOOD_DARK), 1.5); // cột buồm
    poly(g, [[-3, -30], [12, -24], [12, -12], [-3, -10]], hex(0xb08a60)); // buồm
    line(g, [-3, -30], [-3, -10], hex(WOOD_DARK), 1);
    g.fillStyle = hex(0x3a2a20); g.fillRect(-14, -14, 9, 5); // khoang
  }
  const dip = [0, 1, 0, -1][frame];
  const st: Style = { shirt: big ? 0x4a5a6a : 0x7a5030, hat: 'non' };
  person(g, back ? L - 8 : -L + 8, -6, frame, back, st); // người chèo ở đuôi
  line(g, [back ? L - 10 : -L + 10, -14], [back ? L - 2 : -L + 2, -2 + dip], hex(WOOD_DARK), 1); // mái chèo
  return c;
}

/** Kiện hàng: bao tải tròn buộc miệng, màu theo loại. 10×6. */
export function cargoSack(color: number): Canvas {
  const c = canvas(10, 6);
  const g = c.getContext('2d');
  g.fillStyle = hex(darken(color, 0.25)); g.beginPath(); g.ellipse(5, 3.5, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(color); g.beginPath(); g.ellipse(4, 2.5, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(lighten(color, 0.35)); g.fillRect(2, 1, 2, 1);
  g.fillStyle = hex(WOOD_DARK); g.fillRect(7, 0, 1, 2);
  return c;
}

export function figureFrames(resources: { key: string; color: number }[]): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  const key = (t: FigureType) => { const n = FigureType[t]; return n[0].toLowerCase() + n.slice(1); };
  const put = (t: FigureType, draw: (dir: string, f: number) => Canvas, full: boolean) => {
    for (const dir of ['ne', 'se', 'sw', 'nw']) for (let f = 0; f < 4; f++) {
      out[`figures/${key(t)}_${dir}_${f}.png`] = draw(dir, f);
      if (full) out[`figures/${key(t)}_full_${dir}_${f}.png`] = draw(dir, f);
    }
  };
  for (const [k, st] of Object.entries(STYLE)) put(Number(k) as FigureType, (d, f) => walkerFrame(st, d, f), false);
  put(FigureType.CartPusher, (d, f) => oxCartFrame(d, f), true);
  put(FigureType.Convoy, (d, f) => oxCartFrame(d, f, 0x3a4a6a), true);
  put(FigureType.Warehouseman, handcartFrame, true);
  put(FigureType.Caravan, horseFrame, true);
  put(FigureType.Mandarin, palanquinFrame, false);
  put(FigureType.Boat, (d, f) => boatFrame(d, f), true);
  put(FigureType.TradeShip, (d, f) => boatFrame(d, f, true), true);
  for (const r of resources) out[`figures/cargo_${r.key}.png`] = cargoSack(r.color);
  return out;
}
