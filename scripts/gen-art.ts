// Sinh hình thật (vẽ bằng canvas, scripts/art/*) vào assets/ và ghi danh sách vào assets/art.json —
// gen-placeholders.ts bỏ qua các file này nên không đè lại bằng khối màu. Chạy: `npm run assets:art` (nằm trong `npm run assets`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { houseFrames } from './art/house';
import { figureFrames } from './art/figures';
import { roadFrames } from './art/road';
import { buildingFrames } from './art/buildings';
import { houseLevelFrames } from './art/houses';
import { productionFrames } from './art/production';
import { RES_COLOR } from '../src/render/palette';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'assets');

const resources = JSON.parse(readFileSync(join(ROOT, 'src/data/resources.json'), 'utf8')) as { list: { key: string }[] };
const frames = { ...houseFrames(), ...houseLevelFrames(), ...buildingFrames(), ...productionFrames(), ...roadFrames(), ...figureFrames(resources.list.map((r, i) => ({ key: r.key, color: RES_COLOR[i] ?? 0xffffff })).filter((_, i) => i > 0)) };
const files: string[] = [];
for (const [rel, canvas] of Object.entries(frames)) {
  const file = join(ASSETS, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, canvas.toBuffer('image/png'));
  files.push(rel);
}
writeFileSync(join(ASSETS, 'art.json'), JSON.stringify({ _note: 'PNG vẽ bằng scripts/gen-art.ts (hình thật, không phải hình tạm). gen-placeholders.ts bỏ qua các file này.', files: files.sort() }, null, 2) + '\n');
console.log(`art: ${files.length} file`);
