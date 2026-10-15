// M6b: sinh ba bản đồ màn chơi vào src/data/maps/*.json — chạy bằng `npm run maps` (tsx). Bản đồ là file cố định
// (không sinh lúc chơi): sông, hồ, đồi, cửa ngõ, cửa sông, mép giặc và đất cấp theo phẩm hàm đặt bằng tay ở đây;
// cao độ nền tính theo khoảng cách tới sông + gò đồi + nhiễu tất định (hash, không RNG). Sửa file JSON bằng tay cũng được.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LandGrant, MapDef } from '../src/sim/map/mapfile';

const N = 160;
const OUT = join(import.meta.dirname, '..', 'src', 'data', 'maps');
type P = [number, number];

class Canvas {
  water = new Uint8Array(N * N);
  elev = new Float32Array(N * N);
  tree = new Uint8Array(N * N);
  /** sông chảy theo trục y: tim sông x(y) nội suy cosin qua các điểm (x, y) sắp theo y */
  riverNS(pts: P[], halfW: number, wobble = 0.8): void {
    for (let y = 0; y < N; y++) {
      const cx = interp(pts.map(([x, py]) => [py, x]), y);
      const w = halfW + wobble * Math.sin(y / 5.3) * 0.5;
      for (let x = 0; x < N; x++) if (Math.abs(x - cx) <= w) this.water[y * N + x] = 1;
    }
  }
  /** sông chảy theo trục x giữa x0..x1: tim sông y(x) */
  riverEW(pts: P[], halfW: number, x0: number, x1: number): void {
    for (let x = x0; x <= x1; x++) {
      const cy = interp(pts, x);
      for (let y = 0; y < N; y++) if (Math.abs(y - cy) <= halfW) this.water[y * N + x] = 1;
    }
  }
  lake(cx: number, cy: number, rx: number, ry: number): void {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 + 0.12 * Math.sin(x * 0.9 + y * 0.7)) this.water[y * N + x] = 1;
    }
  }
  /** cao độ nền: 1 trong `plain` ô cạnh nước, 2 xa hơn; rồi cộng gò đồi và nhiễu */
  relief(plain: number, hills: { x: number; y: number; r: number; h: number }[], noiseAmp = 0.45): void {
    const dist = waterDist(this.water);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (this.water[i]) { this.elev[i] = 0; continue; }
      let e = dist[i] <= plain ? 1 : 2;
      for (const h of hills) { const d = Math.hypot(x - h.x, y - h.y) / h.r; if (d < 1) e += h.h * (1 - d * d); }
      e += (noise(x, y) - 0.5) * 2 * noiseAmp;
      this.elev[i] = Math.max(0, Math.min(4, Math.round(e)));
    }
  }
  /** Cây trên đất cao 2–3, mật độ chung pct %, mọc thành cụm (bụi tre): tâm cụm thưa (nhiễu tất định), quanh tâm trong bán kính 2
   * xác suất giảm theo khoảng cách (1 / 0,7 / 0,3 → một cụm ≈ 11 ô), không rải lẻ. */
  trees(pct: number): void {
    const ok = (x: number, y: number): boolean => { if (x < 0 || y < 0 || x >= N || y >= N) return false; const i = y * N + x; return !this.water[i] && (this.elev[i] === 2 || this.elev[i] === 3); };
    const centerPerMille = Math.max(1, Math.round((pct * 10) / 11.4));
    const P = [1000, 700, 300];
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
      if (!ok(cx, cy) || hash(cx, cy) % 1000 >= centerPerMille) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (ok(x, y) && hash(x * 7 + 3, y * 5 + 1) % 1000 < P[d]) this.tree[y * N + x] = 1;
      }
    }
  }
  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < N; y++) {
      let row = '';
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        row += this.water[i] ? '~' : this.tree[i] ? (this.elev[i] === 3 ? 'T' : 't') : String(this.elev[i]);
      }
      out.push(row);
    }
    return out;
  }
  isLand(p: P): boolean { return p[0] >= 0 && p[1] >= 0 && p[0] < N && p[1] < N && !this.water[p[1] * N + p[0]]; }
}

/** nội suy cosin qua các điểm [t, v] sắp theo t */
function interp(pts: [number, number][], t: number): number {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      const u = (1 - Math.cos(((t - t0) / (t1 - t0)) * Math.PI)) / 2;
      return v0 + (v1 - v0) * u;
    }
  }
  return pts[pts.length - 1][1];
}
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
/** value noise 2 tầng (ô 7 và 3), 0..1 */
function noise(x: number, y: number): number {
  const layer = (sc: number) => {
    const gx = Math.floor(x / sc), gy = Math.floor(y / sc), fx = x / sc - gx, fy = y / sc - gy;
    const v = (a: number, b: number) => (hash(a, b) % 1000) / 1000;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (v(gx, gy) * (1 - sx) + v(gx + 1, gy) * sx) * (1 - sy) + (v(gx, gy + 1) * (1 - sx) + v(gx + 1, gy + 1) * sx) * sy;
  };
  return 0.65 * layer(7) + 0.35 * layer(3);
}
function waterDist(water: Uint8Array): Uint16Array {
  const d = new Uint16Array(N * N).fill(0xffff);
  const q: number[] = [];
  for (let i = 0; i < N * N; i++) if (water[i]) { d[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % N, y = (i / N) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (d[j] === 0xffff) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

function save(file: string, c: Canvas, def: Omit<MapDef, 'rows' | 'size'> & { _note: string }): void {
  const m: MapDef & { _note: string } = { _note: def._note, name: def.name, size: N, entry: def.entry, riverMouth: def.riverMouth, enemy: def.enemy, land: def.land, rows: c.rows() };
  if (!c.isLand(m.entry)) throw new Error(`${file}: cửa ngõ phải là đất`);
  if (c.isLand(m.riverMouth)) throw new Error(`${file}: cửa sông phải là nước`);
  for (const [k, p] of Object.entries(m.enemy ?? {})) if (p && !c.isLand(p)) throw new Error(`${file}: mép giặc ${k} phải là đất`);
  const head = JSON.stringify({ ...m, rows: undefined }, null, 2).replace(/\n}$/, '');
  const body = ',\n  "rows": [\n' + m.rows.map((r) => `    "${r}"`).join(',\n') + '\n  ]\n}\n';
  writeFileSync(join(OUT, file), head + body);
  let land = 0, plain = 0, water = 0;
  for (let i = 0; i < N * N; i++) { if (c.water[i]) water++; else { land++; if (c.elev[i] <= 1) plain++; } }
  console.log(`${file}: nước ${water} · đất ${land} (bãi thấp ${plain})`);
}

mkdirSync(OUT, { recursive: true });

// ---------- 1. Làng ven sông: một con sông uốn nhẹ phía tây, làng ở bờ đông; đồi cây đông bắc, không có giặc ----------
{
  const c = new Canvas();
  c.riverNS([[38, 0], [34, 40], [40, 80], [33, 120], [30, 159]], 2.6);
  c.relief(15, [{ x: 140, y: 25, r: 38, h: 1.6 }, { x: 150, y: 150, r: 26, h: 1.1 }, { x: 95, y: 150, r: 18, h: 0.7 }]);
  c.trees(7);
  const land: LandGrant[] = [{ rank: 0, rect: [40, 40, 118, 122] }, { rank: 1, rect: [0, 0, 159, 159] }];
  save('lang-ven-song.json', c, {
    _note: 'Màn 1 — làng ven sông: sông phía tây, làng bờ đông; đất cấp lúc đầu là ô vuông 40..118 × 40..122, Tri phủ (rank 1) trở lên được cả bản đồ. Cửa ngõ mép đông, cửa sông mép nam. Sinh bằng scripts/gen-maps.ts.',
    name: 'Làng ven sông', entry: [159, 84], riverMouth: [30, 159], enemy: { north: [90, 0], south: [90, 159] }, land,
  });
}

// ---------- 2. Trấn lị: sông lớn chảy chéo tây bắc → đông nam, nhánh nhỏ từ mép tây nhập vào; trấn ở bờ tây nam ----------
{
  const c = new Canvas();
  c.riverNS([[24, 0], [40, 30], [62, 70], [92, 100], [118, 135], [136, 159]], 3.2);
  c.riverEW([[0, 22], [22, 27], [46, 34]], 1.6, 0, 48);
  c.relief(13, [{ x: 18, y: 148, r: 34, h: 2.2 }, { x: 150, y: 20, r: 40, h: 1.5 }, { x: 30, y: 90, r: 16, h: 0.6 }]);
  c.trees(8);
  const land: LandGrant[] = [{ rank: 0, rect: [8, 44, 84, 132] }, { rank: 2, rect: [0, 0, 159, 159] }];
  save('tran-li.json', c, {
    _note: 'Màn 2 — trấn lị: sông lớn chảy chéo, nhánh nhỏ từ mép tây; trấn ở bờ tây nam; núi tây nam, đồi đông bắc. Giặc Chiêm vào mép nam, quân Bắc mép bắc (bờ tây), cướp biển theo cửa sông đông nam. Thông phán (rank 2) được cả bản đồ.',
    name: 'Trấn lị', entry: [0, 100], riverMouth: [136, 159], enemy: { north: [10, 0], south: [40, 159] }, land,
  });
}

// ---------- 3. Thăng Long: sông Hồng rộng phía đông, Hồ Tây, sông Tô Lịch nhỏ; đất cao ở giữa (thành) ----------
{
  const c = new Canvas();
  c.riverNS([[118, 0], [130, 40], [138, 80], [128, 120], [120, 159]], 3.6);
  c.lake(72, 42, 13, 9);

  for (let y = 50; y <= 135; y++) { const x = Math.round(interp([[50, 66], [80, 58], [110, 46], [135, 40]], y)); c.water[y * N + x] = 1; }
  c.relief(11, [{ x: 85, y: 88, r: 30, h: 1.3 }, { x: 20, y: 20, r: 30, h: 1.6 }, { x: 25, y: 150, r: 22, h: 0.9 }]);
  c.trees(6);
  save('thang-long.json', c, {
    _note: 'Màn 3 — Thăng Long: sông Hồng rộng phía đông, Hồ Tây tây bắc, sông Tô Lịch nhỏ chảy từ hồ xuống tây nam; đất cao ở giữa để xây thành. Cả bản đồ được cấp. Giặc Bắc vào mép bắc, Chiêm mép nam, cướp biển theo cửa sông nam.',
    name: 'Thăng Long', entry: [0, 90], riverMouth: [120, 159], enemy: { north: [60, 0], south: [60, 159] },
  });
}
