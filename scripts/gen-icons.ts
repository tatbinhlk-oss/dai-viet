// M6c: sinh icon PWA (public/icons) — khối đình làng cách điệu trên hình thoi, chữ "ĐV". Thay bằng icon vẽ thật thì bỏ qua script này.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
GlobalFonts.registerFromPath(join(ROOT, 'assets', 'fonts', 'DejaVuSans-Bold.ttf'), 'Placeholder');
const OUT = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

function icon(size: number, maskable: boolean): Buffer {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#141210';
  g.fillRect(0, 0, size, size);
  const pad = maskable ? size * 0.2 : size * 0.08;
  const w = size - pad * 2, cx = size / 2, cy = size / 2;
  // hình thoi đất
  g.fillStyle = '#6a8a3a';
  g.beginPath(); g.moveTo(cx, cy - w * 0.25 + w * 0.12); g.lineTo(cx + w / 2, cy + w * 0.12); g.lineTo(cx, cy + w * 0.25 + w * 0.12); g.lineTo(cx - w / 2, cy + w * 0.12); g.closePath(); g.fill();
  // khối đình: hai mặt + mái
  const h = w * 0.28, bw = w * 0.5, bx = cx, by = cy + w * 0.12 + w * 0.02;
  g.fillStyle = '#8a4a3a'; g.beginPath(); g.moveTo(bx - bw / 2, by - bw / 4); g.lineTo(bx, by); g.lineTo(bx, by - h); g.lineTo(bx - bw / 2, by - bw / 4 - h); g.closePath(); g.fill();
  g.fillStyle = '#6a3428'; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw / 2, by - bw / 4); g.lineTo(bx + bw / 2, by - bw / 4 - h); g.lineTo(bx, by - h); g.closePath(); g.fill();
  g.fillStyle = '#a67c2e'; g.beginPath(); g.moveTo(bx, by - h - bw / 2); g.lineTo(bx + bw / 2, by - bw / 4 - h); g.lineTo(bx, by - h); g.lineTo(bx - bw / 2, by - bw / 4 - h); g.closePath(); g.fill();
  g.fillStyle = '#e8dcc0';
  g.font = `bold ${Math.round(size * 0.16)}px Placeholder`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ĐV', bx, by - h - bw / 4 + 1);
  return c.toBuffer('image/png');
}
writeFileSync(join(OUT, 'icon-192.png'), icon(192, false));
writeFileSync(join(OUT, 'icon-512.png'), icon(512, false));
writeFileSync(join(OUT, 'maskable-512.png'), icon(512, true));
console.log('icons: 192, 512, maskable-512');
