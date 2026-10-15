// M6c+: vẽ công trình kéo dài (đường, đê, cống, thành) theo kiểu Caesar 3 — bấm điểm đầu, kéo tới điểm cuối,
// đoạn đi thẳng theo trục dài hơn trước rồi gấp khúc đúng một lần theo trục kia. Thuần toán, không Pixi (test được).
export const LINE_TOOLS = new Set(['road', 'dike', 'sluice', 'earthWall', 'stoneWall']);
/** công cụ kéo theo vùng chữ nhật: lều, vườn, ao sen, phá */
export const RECT_TOOLS = new Set(['house', 'garden', 'lotusPond', 'raze']);

/** Mọi ô trong hình chữ nhật hai góc (x0, y0)–(x1, y1), theo hàng. */
export function rectPath(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) out.push([x, y]);
  return out;
}

/** Các ô từ (x0, y0) tới (x1, y1): thẳng theo trục có độ lệch lớn hơn, rồi rẽ một lần. Ô đầu đứng trước. */
export function linePath(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = x1 - x0, dy = y1 - y0;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  let x = x0, y = y0;
  out.push([x, y]);
  if (Math.abs(dx) >= Math.abs(dy)) {
    while (x !== x1) { x += sx; out.push([x, y]); }
    while (y !== y1) { y += sy; out.push([x, y]); }
  } else {
    while (y !== y1) { y += sy; out.push([x, y]); }
    while (x !== x1) { x += sx; out.push([x, y]); }
  }
  return out;
}
