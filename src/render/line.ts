// M6c+: vẽ công trình kéo dài (đường, đê, cống, thành) theo kiểu Caesar 3 — bấm điểm đầu, kéo tới điểm cuối,
// đoạn đi thẳng theo trục dài hơn trước rồi gấp khúc đúng một lần theo trục kia. Thuần toán, không Pixi (test được).
export const LINE_TOOLS = new Set(['road', 'bridge', 'dike', 'sluice', 'earthWall', 'stoneWall']);
/** công cụ kéo theo vùng chữ nhật: lều, vườn, ao sen, phá */
export const RECT_TOOLS = new Set(['house', 'garden', 'lotusPond', 'raze']);

/** Mọi ô trong hình chữ nhật hai góc (x0, y0)–(x1, y1), theo hàng. */
export function rectPath(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) out.push([x, y]);
  return out;
}

/** Các ô từ (x0, y0) tới (x1, y1): thẳng theo trục có độ lệch lớn hơn, rồi rẽ một lần. Ô đầu đứng trước.
 *  `flip` (nút ↔ trên điện thoại): đi theo trục kia trước — chỗ gấp khúc đổi sang góc đối diện. */
export function linePath(x0: number, y0: number, x1: number, y1: number, flip = false): [number, number][] {
  const out: [number, number][] = [];
  const dx = x1 - x0, dy = y1 - y0;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  let x = x0, y = y0;
  out.push([x, y]);
  if ((Math.abs(dx) >= Math.abs(dy)) !== flip) {
    while (x !== x1) { x += sx; out.push([x, y]); }
    while (y !== y1) { y += sy; out.push([x, y]); }
  } else {
    while (y !== y1) { y += sy; out.push([x, y]); }
    while (x !== x1) { x += sx; out.push([x, y]); }
  }
  return out;
}

/** Điện thoại: đoạn đang chờ xác nhận sau khi chạm hai điểm (thanh ✓ Xây · ↔ · ✕ Bỏ). */
export interface LinePending {
  /** 'start': mới chọn điểm đầu, chờ chạm điểm cuối; 'end': đã có đoạn mờ, chờ ✓ */
  stage: 'start' | 'end';
  /** số ô đặt được trong đoạn mờ */
  ok: number;
  /** tổng số ô của đoạn */
  count: number;
  /** công cụ vùng (lều, vườn, phá) — không có nút ↔ */
  rect: boolean;
  /** điểm đầu là ô cuối của đoạn vừa xây (nối tiếp) */
  chained: boolean;
}

const T_ROAD_FLAG = 1 << 1; // = T_ROAD (sim/map/grid.ts); chép hằng để file này không kéo theo sim
/** Bắt dính điểm đầu khi vẽ đường trên điện thoại: chạm cạnh một đầu đường cụt thì điểm đầu nhảy tới ô nối tiếp đầu đường
 *  đó (ô kế đầu cụt theo hướng đường). Chỉ khi ô chạm không phải đường và cách ô nối tiếp ≤ 1 ô (kể cả chéo); không thì giữ nguyên. */
export function snapRoadStart(terrain: Uint16Array, n: number, x: number, y: number): [number, number] {
  const road = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < n && ty < n && (terrain[ty * n + tx] & T_ROAD_FLAG) !== 0;
  if (road(x, y)) return [x, y];
  let best: [number, number] | null = null, bestD = 9;
  for (let ey = y - 2; ey <= y + 2; ey++) for (let ex = x - 2; ex <= x + 2; ex++) {
    if (!road(ex, ey)) continue;
    // đầu cụt: đúng một ô đường kề (4 hướng)
    const nb: [number, number][] = [];
    for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) if (road(ex + ddx, ey + ddy)) nb.push([ex + ddx, ey + ddy]);
    if (nb.length !== 1) continue;
    const cx = ex + (ex - nb[0][0]), cy = ey + (ey - nb[0][1]); // ô nối tiếp theo hướng đường
    if (cx < 0 || cy < 0 || cx >= n || cy >= n || road(cx, cy)) continue;
    const d = Math.max(Math.abs(cx - x), Math.abs(cy - y));
    if (d <= 1 && d < bestD) { best = [cx, cy]; bestD = d; }
  }
  return best ?? [x, y];
}
