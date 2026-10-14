// Nạp spritesheet từ public/sheets/*.json + .png (đóng gói bởi scripts/pack-sprites.ts).
// Mỗi frame có anchor (0.5, 1) tại góc dưới hình thoi móng và footprint N; scaleMode nearest, không mip-map.
import { Assets, Rectangle, Texture } from 'pixi.js';

export interface FrameInfo { x: number; y: number; w: number; h: number; anchor: [number, number]; footprint: number; placeholder: boolean }
export interface SheetJson { image: string; placeholder: boolean; frames: Record<string, FrameInfo> }

export interface Sheet {
  base: Texture;
  frames: Map<string, { texture: Texture; info: FrameInfo }>;
  /** còn frame tạm (sinh bởi gen-placeholders) */
  placeholder: boolean;
}

export interface Sheets { buildings: Sheet; ground: Sheet; figures: Sheet }

async function loadSheet(name: string): Promise<Sheet> {
  const base = `${import.meta.env.BASE_URL}sheets/`;
  const json = (await (await fetch(`${base}${name}.json`)).json()) as SheetJson;
  const tex = (await Assets.load<Texture>(`${base}${json.image}`)) as Texture;
  tex.source.scaleMode = 'nearest';
  tex.source.autoGenerateMipmaps = false;
  const frames = new Map<string, { texture: Texture; info: FrameInfo }>();
  for (const [key, f] of Object.entries(json.frames)) {
    frames.set(key, { texture: new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }), info: f });
  }
  return { base: tex, frames, placeholder: json.placeholder };
}

/** Nạp cả ba sheet; thiếu sheet nào thì sheet đó rỗng (render vẽ khối màu dự phòng, không crash). */
export async function loadSheets(): Promise<Sheets> {
  const empty = (): Sheet => ({ base: Texture.EMPTY, frames: new Map(), placeholder: true });
  const [buildings, ground, figures] = await Promise.all(['buildings', 'ground', 'figures'].map((n) => loadSheet(n).catch((e) => { console.warn(`Không nạp được sheet ${n}:`, e); return empty(); })));
  return { buildings, ground, figures };
}

export const frameOf = (s: Sheet, key: string): Texture | null => s.frames.get(key)?.texture ?? null;
export const isPlaceholder = (s: Sheet, key: string): boolean => s.frames.get(key)?.info.placeholder ?? true;
