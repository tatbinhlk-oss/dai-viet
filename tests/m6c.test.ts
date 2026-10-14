// M6c: câu thoại walker, mục tiêu hiệu năng (1.500 công trình, 800 walker), tiếng theo sự kiện.
// PWA, cảm ứng và bố cục điện thoại kiểm bằng build + Playwright (không test headless được).
import { describe, expect, it } from 'vitest';
import { applyCommand, figureAt, takeSnapshot, tick } from '../src/sim';
import { createScenario } from '../src/sim/scenario/loader';
import { buildCourtTown, buildStressTown, demoPriorities } from '../src/sim/scenario/demo';
import { BuildingType, DAYS_PER_MONTH, FigureType, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { figureDialogue, FIGURE_NAMES } from '../src/sim/figures/dialogue';
import { soundForEvent } from '../src/render/audio';

const runDays = (s: GameState, days: number) => { for (let i = 0; i < days * TICKS_PER_DAY; i++) tick(s); };
const live = (s: GameState) => s.figures.filter((f) => f.type !== FigureType.None);

describe('câu thoại walker', () => {
  it('mọi loại walker có tên; câu thoại nói đang chở gì, đi đâu, vì sao chờ', () => {
    for (const k of Object.values(FigureType)) if (typeof k === 'number' && k !== FigureType.None) expect(FIGURE_NAMES[k], FigureType[k]).toBeTruthy();
    const s = createScenario('sonNam', 3, true);
    s.treasury = 1e6; buildCourtTown(s); demoPriorities(s); buildStressTown(s); // lều có dân sẵn → xưởng, chợ, dịch vụ chạy ngay
    runDays(s, DAYS_PER_MONTH);
    const kinds = new Set<FigureType>();
    for (let d = 0; d < DAYS_PER_MONTH; d++) {
      runDays(s, 1);
      for (const f of live(s)) {
        kinds.add(f.type);
        const info = figureDialogue(s, f);
        expect(info.name).toBe(FIGURE_NAMES[f.type]);
        expect(info.text.length).toBeGreaterThan(10);
      }
    }
    expect(kinds.size).toBeGreaterThan(5);
    const cart = live(s).find((f) => f.type === FigureType.CartPusher && f.loads > 0 && !f.returning);
    if (cart) expect(figureDialogue(s, cart).text).toMatch(/Tôi chở \d+ kiện .+ tới/);
    const trader = live(s).find((f) => f.type === FigureType.MarketTrader);
    if (trader) expect(figureDialogue(s, trader).text).toContain('chợ');
    // walker đứng chờ ở xưởng
    const f = live(s)[0];
    f.waitTicks = 10; f.type = FigureType.CartPusher; f.loads = 0; f.resource = Resource.None; f.cargo = [];
    expect(figureDialogue(s, f).text).toContain('chờ');
  });
  it('bấm vào ô có walker → snapshot mang câu thoại; walker biến mất thì hết', () => {
    const s = createScenario('sonNam', 3, true);
    s.treasury = 1e6; buildCourtTown(s); demoPriorities(s);
    runDays(s, 20);
    const f = live(s)[0];
    expect(figureAt(s, f.x, f.y)?.id).toBe(f.id);
    const snap = takeSnapshot(s, false, 0, f.id);
    expect(snap.selectedFigure?.name).toBe(FIGURE_NAMES[f.type]);
    expect(snap.selectedFigure?.text).toBeTruthy();
    expect(figureAt(s, 150, 150)).toBeNull();
    f.type = FigureType.None;
    expect(takeSnapshot(s, false, 0, f.id).selectedFigure).toBeNull();
  });
});

describe('hiệu năng mục tiêu (phần 8)', () => {
  it('thị trấn thử tải ≥ 1.500 công trình, ≥ 700 walker; sim chạy dưới 10 ms/tick (ngân sách 50 ms ở 1×, 16 ms ở 3×)', () => {
    const s = createScenario('sonNam', 3, true);
    s.treasury = 1e6; buildCourtTown(s); demoPriorities(s); buildStressTown(s);
    const buildings = s.buildings.filter((b) => b.type !== BuildingType.None).length;
    expect(buildings).toBeGreaterThanOrEqual(1500);
    runDays(s, DAYS_PER_MONTH); // người mộ phu, dịch vụ khởi động
    let peak = 0;
    const t0 = performance.now();
    const ticks = TICKS_PER_DAY * DAYS_PER_MONTH;
    for (let i = 0; i < ticks; i++) { tick(s); if (i % 50 === 0) peak = Math.max(peak, live(s).length); }
    const ms = (performance.now() - t0) / ticks;
    console.log(`thử tải: ${buildings} công trình, walker tối đa ${peak}, ${ms.toFixed(2)} ms/tick, dân ${s.population}`);
    expect(peak).toBeGreaterThanOrEqual(700);
    expect(ms).toBeLessThan(10);
    const snap = takeSnapshot(s, true);
    expect(snap.figures.length / 7).toBeGreaterThan(300);
    applyCommand(s, { type: 'setSpeed', speed: 3 });
  }, 60000);
});

describe('tiếng theo sự kiện', () => {
  it('đoán khóa tiếng từ dòng sự kiện', () => {
    expect(soundForEvent('Lũ về: vừa (mức 2)')).toBe('flood');
    expect(soundForEvent('Cháy: Lều tranh')).toBe('fire');
    expect(soundForEvent('Chiếu chỉ: Nộp 4 kiện gạo trong 18 tháng')).toBe('edict');
    expect(soundForEvent('Đạt mọi mục tiêu của Làng ven sông: được phong Tri phủ!')).toBe('win');
    expect(soundForEvent('Nộp cống 100 quan')).toBeNull();
  });
});
