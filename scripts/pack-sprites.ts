// M6-0: đóng gói assets/**.png thành public/sheets/<nhóm>.png + .json — chạy bằng `npm run assets:pack`.
// JSON mỗi frame: { x, y, w, h, anchor: [0.5, 1], footprint: N, placeholder: true/false }. Nhóm: buildings (công trình + nhà),
// ground (đất nền, đê, cống), figures (walker + kiện hàng). Xếp theo kệ (shelf) sau khi sắp theo chiều cao giảm dần.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'assets');
const OUT = join(ROOT, 'public', 'sheets');
const MAX_W = 2048;
const buildings = JSON.parse(readFileSync(join(ROOT, 'src/data/buildings.json'), 'utf8')) as Record<string, { size: number }>;
const placeholders = new Set<string>(existsSync(join(ASSETS, 'placeholders.json')) ? (JSON.parse(readFileSync(join(ASSETS, 'placeholders.json'), 'utf8')) as { files: string[] }).files : []);

export interface Frame { x: number; y: number; w: number; h: number; anchor: [number, number]; footprint: number; placeholder: boolean }
export interface Sheet { image: string; placeholder: boolean; frames: Record<string, Frame> }

function footprintOf(group: string, name: string): number {
  if (group === 'houses') return 1;
  if (group === 'buildings') {
    const m = /^ruins_(\d)$/.exec(name);
    if (m) return Number(m[1]);
    return buildings[name]?.size ?? 1;
  }
  return 1;
}

async function pack(groups: string[], outName: string): Promise<void> {
  const items: { name: string; group: string; rel: string; img: Awaited<ReturnType<typeof loadImage>> }[] = [];
  for (const group of groups) {
    const dir = join(ASSETS, group);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.png')).sort()) {
      const name = f.slice(0, -4);
      items.push({ name, group, rel: `${group}/${f}`, img: await loadImage(join(dir, f)) });
    }
  }
  items.sort((a, b) => b.img.height - a.img.height || a.name.localeCompare(b.name));
  // shelf packing
  let x = 0, y = 0, shelfH = 0, sheetW = 0;
  const placed: { it: (typeof items)[number]; x: number; y: number }[] = [];
  for (const it of items) {
    if (x + it.img.width > MAX_W) { x = 0; y += shelfH; shelfH = 0; }
    placed.push({ it, x, y });
    x += it.img.width;
    shelfH = Math.max(shelfH, it.img.height);
    sheetW = Math.max(sheetW, x);
  }
  const sheetH = y + shelfH;
  const c = createCanvas(sheetW, sheetH);
  const g = c.getContext('2d');
  const frames: Record<string, Frame> = {};
  let anyPlaceholder = false;
  for (const { it, x, y } of placed) {
    g.drawImage(it.img, x, y);
    const ph = placeholders.has(it.rel);
    anyPlaceholder ||= ph;
    if (frames[it.name]) throw new Error(`Trùng tên frame "${it.name}" trong ${outName}`);
    frames[it.name] = { x, y, w: it.img.width, h: it.img.height, anchor: [0.5, 1], footprint: footprintOf(it.group, it.name), placeholder: ph };
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${outName}.png`), c.toBuffer('image/png'));
  const sheet: Sheet = { image: `${outName}.png`, placeholder: anyPlaceholder, frames };
  writeFileSync(join(OUT, `${outName}.json`), JSON.stringify(sheet) + '\n');
  console.log(`${outName}: ${items.length} frame, ${sheetW}×${sheetH}`);
}

await pack(['buildings', 'houses'], 'buildings');
await pack(['ground'], 'ground');
await pack(['figures'], 'figures');
