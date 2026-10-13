// RNG có seed (mulberry32). Sim KHÔNG dùng Math.random để chạy lại được y hệt.
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Số thực [0, 1). */
export function nextFloat(r: Rng): number {
  r.state = (r.state + 0x6d2b79f5) >>> 0;
  let t = r.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Số nguyên [0, n). Tương đương random_byte() & mask của Julius. */
export function nextInt(r: Rng, n: number): number {
  return Math.floor(nextFloat(r) * n);
}
