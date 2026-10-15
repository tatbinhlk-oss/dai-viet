// M6c: khung âm thanh. Chưa có file âm thanh (sẽ thêm sau): thả file vào public/sounds/<khóa>.ogg (hoặc .mp3) là phát,
// thiếu file thì im lặng, không lỗi. Khóa: click (đặt công trình), raze, flood (lũ về), fire (cháy), invasion (giặc), win, lose,
// edict (chiếu chỉ tới), festival, ambient (nền lặp). Bật / tắt bằng nút 🔊 (ghi localStorage). Âm thanh chỉ chạy sau cử chỉ đầu tiên của người chơi.
export type SoundKey = 'click' | 'raze' | 'flood' | 'fire' | 'invasion' | 'win' | 'lose' | 'edict' | 'festival' | 'ambient';
const EXTS = ['ogg', 'mp3'];
const MUTE_KEY = 'dai-viet.muted';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 1;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private ambient: AudioBufferSourceNode | null = null;
  private lastPlay = new Map<string, number>();
  muted = false;

  constructor(private readonly base: string) {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* bỏ qua */ }
    // trình duyệt chỉ cho phát sau cử chỉ người dùng
    const unlock = () => { this.ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** âm lượng chung 0..1 */
  setVolume(v: number): void { this.volume = Math.max(0, Math.min(1, v)); if (this.master) this.master.gain.value = this.volume; }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* bỏ qua */ }
    if (m) this.stopAmbient(); else void this.startAmbient();
  }

  private ensure(): AudioContext | null {
    if (!this.ctx && typeof AudioContext !== 'undefined') { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination); void this.startAmbient(); }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Nạp file lần đầu (thử .ogg rồi .mp3); không có → null và nhớ để không thử lại. */
  private load(key: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(key);
    if (p) return p;
    p = (async () => {
      const ctx = this.ctx;
      if (!ctx) return null;
      for (const ext of EXTS) {
        try {
          const res = await fetch(`${this.base}sounds/${key}.${ext}`);
          if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('audio')) continue;
          return await ctx.decodeAudioData(await res.arrayBuffer());
        } catch { /* thử đuôi khác */ }
      }
      return null;
    })();
    this.buffers.set(key, p);
    return p;
  }

  /** Phát một tiếng; cùng khóa không lặp nhanh hơn `minGapMs`. */
  play(key: SoundKey, minGapMs = 150): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - (this.lastPlay.get(key) ?? -1e9) < minGapMs) return;
    this.lastPlay.set(key, now);
    void this.load(key).then((buf) => {
      if (!buf || this.muted) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master ?? ctx.destination);
      src.start();
    });
  }

  private async startAmbient(): Promise<void> {
    if (this.muted || this.ambient || !this.ctx) return;
    const buf = await this.load('ambient');
    if (!buf || this.muted || this.ambient) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const gain = this.ctx.createGain(); gain.gain.value = 0.5;
    src.connect(gain).connect(this.master ?? this.ctx.destination);
    src.start();
    this.ambient = src;
  }
  private stopAmbient(): void { this.ambient?.stop(); this.ambient = null; }
}

/** Đoán tiếng từ dòng sự kiện của sim (sự kiện là chữ, không có mã). */
export function soundForEvent(text: string): SoundKey | null {
  if (text.startsWith('Lũ về')) return 'flood';
  if (text.startsWith('Cháy')) return 'fire';
  if (text.startsWith('Giặc') || text.includes('giặc') && text.includes('vào')) return 'invasion';
  if (text.startsWith('Đạt mọi mục tiêu')) return 'win';
  if (text.startsWith('Hết hạn') || text.startsWith('Triều đình cử quan khác')) return 'lose';
  if (text.startsWith('Chiếu chỉ')) return 'edict';
  if (text.startsWith('Lễ hội') || text.startsWith('Tết')) return 'festival';
  return null;
}
