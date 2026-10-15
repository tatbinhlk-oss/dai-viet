// Cổng M3: thị trấn 1.000 dân, ngân khố dương sau 10 năm chạy headless.
// Bố cục thị trấn nằm ở src/sim/scenario/demo.ts (cũng dùng cho ?demo=1).
import { describe, expect, it } from 'vitest';
import { createSim, tick } from '../src/sim';
import { buildTown, demoPriorities } from '../src/sim/scenario/demo';
import { BuildingType, DAYS_PER_MONTH, MONTHS_PER_YEAR, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { BUILDING_DEFS, RESOURCES } from '../src/sim/buildings/defs';
import { missingFor } from '../src/sim/buildings/house';

const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;
/** Vốn kịch bản của màn thử (Caesar 3 cho 5.000–20.000 tùy màn); M4 thêm 1.000 cho 8 trạm giữ đê. */
const START_FUNDS = 9000;
const DEBUG = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DEBUG_TOWN;

function count(s: GameState, t: BuildingType): number { return s.buildings.filter((b) => b.type === t).length; }

describe('thị trấn M3 (bản đồ phẳng)', () => {
  it('bố cục đặt được', () => {
    const s = createSim(3, { flat: true });
    s.treasury = 1e9;
    buildTown(s);
    const kinds = new Map<string, number>();
    for (const b of s.buildings) if (b.type) kinds.set(BUILDING_DEFS[b.type].key, (kinds.get(BUILDING_DEFS[b.type].key) ?? 0) + 1);
    let jobs = 0;
    for (const b of s.buildings) jobs += BUILDING_DEFS[b.type].workers;
    console.log(Object.fromEntries(kinds), 'jobs', jobs, 'cost', s.thisYear.construction);
    expect(count(s, BuildingType.House)).toBeGreaterThan(60);
    for (const t of [BuildingType.Kiln, BuildingType.Loom, BuildingType.TeaHouse, BuildingType.SilkWorkshop, BuildingType.Foundry, BuildingType.Smithy,
      BuildingType.CottonField, BuildingType.TeaHill, BuildingType.MulberryField, BuildingType.CopperMine, BuildingType.IronMine, BuildingType.SaltPan, BuildingType.FishWharf])
      expect(count(s, t), BUILDING_DEFS[t].key).toBeGreaterThan(0);
  });

  it('sau 10 năm: ≥1.000 dân, ngân khố dương', () => {
    const s = createSim(3, { flat: true });
    s.treasury = START_FUNDS;
    buildTown(s);
    // người chơi ưu tiên tuần đinh, lương thực, thợ cả — nếu không, lửa và đói đến trước khi đủ người
    demoPriorities(s);
    const t0 = performance.now();
    let treasuryYear2 = 0, maxLevelSeen = 0;
    for (let y = 1; y <= 10; y++) {
      for (let i = 0; i < TICKS_PER_YEAR; i++) { tick(s); if (i % (TICKS_PER_YEAR / 12) === 0) for (const b of s.buildings) if (b.type === BuildingType.House && b.population > 0) maxLevelSeen = Math.max(maxLevelSeen, b.level); }
      if (y === 2) treasuryYear2 = s.treasury;
      const houses = s.buildings.filter((b) => b.type === BuildingType.House && b.population > 0);
      const levels = new Array(11).fill(0);
      const why = new Map<string, number>();
      for (const h of houses) { levels[h.level]++; const m = missingFor(s, h, h.level + 1); if (m) why.set(m, (why.get(m) ?? 0) + 1); }
      const stored: string[] = [];
      for (let r = 1; r < RESOURCES.length; r++) {
        let u = 0;
        for (const b of s.buildings) if (b.type === BuildingType.Warehouse || b.type === BuildingType.Granary) u += b.store[r];
        if (u) stored.push(`${RESOURCES[r].key}:${u / 100}`);
      }
      console.log(`năm ${y}: dân ${s.population}/${s.housingCapacity} · ngân khố ${s.treasury} · thuế ${s.lastYear.taxes} lương ${s.lastYear.wages} xây ${s.lastYear.construction} trộm ${s.lastYear.stolen} · lòng dân ${s.sentiment} (${s.lowMoodCause}) · nhân công ${s.labor.employed}/${s.labor.workforce} thất nghiệp ${s.labor.unemploymentPct}% · bậc ${levels.join(',')}`);
      const noLabor = s.buildings.filter((b) => b.type && BUILDING_DEFS[b.type].workers > 0 && b.housesCovered <= 0).map((b) => BUILDING_DEFS[b.type].key + '@' + b.x + ',' + b.y);
      if (DEBUG) console.log('   không nước:', houses.filter((h) => missingFor(s, h, h.level + 1) === 'nước giếng').map((h) => h.x + ',' + h.y).join(' '));
      if (DEBUG) console.log('   không người làm:', noLabor.join(' '), '· cần', s.labor.needed.join(','), '· cấp', s.labor.allocated.join(','));
      console.log('   thiếu:', JSON.stringify(Object.fromEntries(why)), '· kho:', stored.join(' '), '· sự kiện:', s.events.slice(-3).join(' | '));
    }
    const ms = performance.now() - t0;
    console.log('ms', Math.round(ms));
    expect(s.population).toBeGreaterThanOrEqual(1000);
    expect(s.treasury).toBeGreaterThan(0);
    expect(s.treasury).toBeGreaterThan(treasuryYear2); // thu > chi sau khi xây xong, không chỉ sống bằng vốn
    // nhà bậc 6–8 có thật (xét bậc cao nhất từng đạt: một đám cháy lan ngẫu nhiên vào năm 6 có thể kéo cả xóm tụt bậc ở cuối kỳ)
    expect(maxLevelSeen).toBeGreaterThanOrEqual(6);
    expect(ms).toBeLessThan(60000);
  }, 120000);
});

