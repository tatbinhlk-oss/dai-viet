// Walker vẽ thật — mẫu đầu: xe bò chở hàng (CartPusher) gồm bò kéo xe hai bánh và người đi sau cầm roi.
// Hướng: se = đi +x (xuống phải, thấy mặt bên trước), sw = +y (xuống trái: lật gương se), nw = −x (lên trái: lật gương ne),
// ne = −y (lên phải, thấy từ sau: xe gần người xem, bò xa hơn). 4 khung bước: chân bò / chân người / nan bánh xe đổi theo khung.
// Neo (0.5, 1) = chân giữa hình; kiện hàng render đè ở (0, −10) nên thùng xe đặt quanh x = 0, mặt thùng ở y ≈ −10.
import { createCanvas } from '@napi-rs/canvas';
import { darken, hex, lighten, line, poly, type Canvas, type Ctx } from './lib';

const SKIN = 0xd8a878, HAT = 0xd8c080, HAT_DARK = 0xa08a48, SHIRT = 0x7a5030, PANTS = 0x2a2420;
const OX = 0x7a4a2c, OX_DARK = 0x46281a, OX_LIGHT = 0x9a6a44, HORN = 0xf0e8d0; // bò nâu sẫm (nổi trên nền đường vàng)
const WOOD = 0x9a7040, WOOD_DARK = 0x5e4020, WOOD_LIGHT = 0xc09060;

/** Người nông dân nhỏ (cao ~13 px) đứng tại chân (x, y); `back` = nhìn từ sau; chân bước theo `frame`. */
export function person(g: Ctx, x: number, y: number, frame: number, back: boolean, shirt = SHIRT): void {
  const step = [0, 2, 0, -2][frame];
  // chân (quần đen) — hai ống lệch nhau
  g.fillStyle = hex(PANTS);
  g.fillRect(x - 2 + step / 2, y - 5, 2, 5);
  g.fillRect(x - step / 2, y - 5, 2, 5);
  // thân áo
  g.fillStyle = hex(back ? darken(shirt, 0.15) : shirt);
  g.fillRect(x - 3, y - 11, 6, 6);
  // tay (một tay vung theo bước)
  g.fillStyle = hex(SKIN);
  g.fillRect(x + 3, y - 10 + step / 2, 1, 4);
  g.fillRect(x - 4, y - 10 - step / 2, 1, 4);
  // roi tre trong tay phải
  line(g, [x + 3, y - 8], [x + 9, y - 14], hex(HAT_DARK), 1);
  // đầu + nón lá
  g.fillStyle = hex(SKIN);
  g.fillRect(x - 2, y - 14, 4, 3);
  poly(g, [[x - 5, y - 13], [x + 5, y - 13], [x, y - 17]], hex(HAT));
  line(g, [x - 5, y - 13], [x + 5, y - 13], hex(HAT_DARK), 1);
  if (!back) { g.fillStyle = hex(darken(SKIN, 0.4)); g.fillRect(x + 1, y - 13, 1, 1); } // mắt
}

/** Con bò kéo, thân nằm ngang, đầu quay sang phải (+x); `back` = thấy từ phía sau (đầu ở xa, nhỏ hơn). */
export function ox(g: Ctx, x: number, y: number, frame: number, back: boolean): void {
  const step = [2, 0, -2, 0][frame];
  // chân: 4 chân, cặp trước và sau lệch pha
  g.fillStyle = hex(OX_DARK);
  g.fillRect(x - 6 + step / 2, y - 5, 2, 5);
  g.fillRect(x - 3 - step / 2, y - 5, 2, 5);
  g.fillRect(x + 3 + step / 2, y - 5, 2, 5);
  g.fillRect(x + 6 - step / 2, y - 5, 2, 5);
  // thân
  g.fillStyle = hex(OX);
  g.beginPath(); g.ellipse(x, y - 8, 8.5, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(OX_LIGHT);
  g.beginPath(); g.ellipse(x - 1, y - 10, 5, 2, 0, 0, Math.PI * 2); g.fill(); // lưng sáng
  // đuôi
  line(g, [x - 8, y - 9], [x - 10, y - 4 + step / 2], hex(OX_DARK), 1);
  // đầu + sừng
  if (back) {
    g.fillStyle = hex(OX_DARK); g.fillRect(x + 6, y - 13, 5, 5);
    line(g, [x + 5, y - 13], [x + 4, y - 16], hex(HORN), 1); line(g, [x + 11, y - 13], [x + 12, y - 16], hex(HORN), 1);
  } else {
    g.fillStyle = hex(OX); g.fillRect(x + 7, y - 12, 6, 6);
    g.fillStyle = hex(lighten(OX, 0.25)); g.fillRect(x + 10, y - 9, 3, 3); // mõm
    g.fillStyle = hex(darken(OX, 0.5)); g.fillRect(x + 10, y - 11, 1, 1); // mắt
    line(g, [x + 8, y - 12], [x + 6, y - 16], hex(HORN), 1.6); line(g, [x + 12, y - 12], [x + 14, y - 16], hex(HORN), 1.6);
    g.fillStyle = hex(OX_DARK); g.fillRect(x + 7, y - 13, 6, 1); // trán sẫm
  }
}

/** Bánh xe gỗ có nan quay theo khung. */
function wheel(g: Ctx, cx: number, cy: number, r: number, frame: number): void {
  g.strokeStyle = hex(WOOD_DARK); g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1; g.strokeStyle = hex(WOOD_LIGHT);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3 + (frame * Math.PI) / 8;
    g.beginPath(); g.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
  }
  g.fillStyle = hex(WOOD_DARK); g.fillRect(cx - 1, cy - 1, 2, 2);
}

/** Xe hai bánh: thùng ván quanh x (tâm), càng xe chìa sang phải nối bò. Thùng ở y −10…−6 để kiện hàng đè khớp. */
export function cart(g: Ctx, x: number, y: number, frame: number, back: boolean): void {
  // bánh sau (xa) vẽ trước
  wheel(g, x + (back ? 2 : -2), y - 4, 3.5, frame);
  // thùng
  poly(g, [[x - 8, y - 6], [x + 8, y - 6], [x + 8, y - 11], [x - 8, y - 11]], hex(WOOD));
  line(g, [x - 8, y - 8.5], [x + 8, y - 8.5], hex(WOOD_DARK), 1);
  line(g, [x - 8, y - 11], [x + 8, y - 11], hex(WOOD_LIGHT), 1);
  g.fillStyle = hex(WOOD_DARK); g.fillRect(x - 8, y - 11, 1, 5); g.fillRect(x + 7, y - 11, 1, 5);
  // càng xe tới bò
  line(g, [x + 8, y - 8], [x + 16, y - 7], hex(WOOD_DARK), 1.5);
  // bánh trước (gần)
  wheel(g, x + (back ? -2 : 2), y - 3, 4, frame);
}

/** Một khung xe bò theo hướng. Ảnh 44×26, neo đáy giữa. */
export function cartPusherFrame(dir: 'ne' | 'se' | 'sw' | 'nw', frame: number): Canvas {
  const W = 44, H = 26;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  const flip = dir === 'sw' || dir === 'nw';
  const back = dir === 'ne' || dir === 'nw';
  g.translate(W / 2, H);
  if (flip) g.scale(-1, 1);
  // bóng
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(2, -1, 17, 3, 0, 0, Math.PI * 2); g.fill();
  if (back) {
    // thấy từ sau: bò ở xa (cao hơn, nhỏ hơn một chút), xe gần, người đi sau xe (gần nhất)
    g.save(); g.translate(13, -4); g.scale(0.85, 0.85); ox(g, 0, 0, frame, true); g.restore();
    cart(g, 0, 0, frame, true);
    person(g, -13, 0, frame, true);
  } else {
    person(g, -13, -1, frame, false);
    cart(g, 0, 0, frame, false);
    ox(g, 14, 0, frame, false);
  }
  return c;
}

/** Kiện hàng: bao tải tròn buộc miệng, màu theo loại. 10×6, đè lên thùng xe ở (0, −10). */
export function cargoSack(color: number): Canvas {
  const c = createCanvas(10, 6);
  const g = c.getContext('2d');
  g.fillStyle = hex(darken(color, 0.25));
  g.beginPath(); g.ellipse(5, 3.5, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(color);
  g.beginPath(); g.ellipse(4, 2.5, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(lighten(color, 0.35)); g.fillRect(2, 1, 2, 1);
  g.fillStyle = hex(WOOD_DARK); g.fillRect(7, 0, 1, 2); // nút buộc
  return c;
}

export function figureFrames(resources: { key: string; color: number }[]): Record<string, Canvas> {
  const out: Record<string, Canvas> = {};
  for (const dir of ['ne', 'se', 'sw', 'nw'] as const) for (let f = 0; f < 4; f++) {
    out[`figures/cartPusher_${dir}_${f}.png`] = cartPusherFrame(dir, f);
    out[`figures/cartPusher_full_${dir}_${f}.png`] = cartPusherFrame(dir, f); // kiện hàng là sprite riêng đè lên
  }
  for (const r of resources) out[`figures/cargo_${r.key}.png`] = cargoSack(r.color);
  return out;
}
