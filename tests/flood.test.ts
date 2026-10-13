// Cổng M4: thị trấn 1.000 dân sống 10 năm với mực lũ ngẫu nhiên mà không mất quá 20% dân.
// Dùng thị trấn mẫu của M3 (src/sim/scenario/demo.ts) đã thêm tuyến đê x=7 cao 3 và trạm giữ đê.
import { describe, expect, it } from 'vitest';
import { createSim, tick } from '../src/sim';
import { buildTown, demoPriorities, planDikeLine } from '../src/sim/scenario/demo';
import { BuildingType, DAYS_PER_MONTH, isDike, MONTHS_PER_YEAR, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { T_FLOODED } from '../src/sim/map/grid';
import { dikeSafety } from '../src/sim/buildings/dike';

const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;
/** Vốn kịch bản như tests/city.test.ts (M3 8.000 + 1.000 cho trạm giữ đê). */
const START_FUNDS = 9000;

function dikeStats(s: GameState): string {
  const h = [0, 0, 0, 0, 0];
  for (const b of s.buildings) if (isDike(b.type)) h[b.height]++;
  const d = dikeSafety(s);
  return `đê cao ${h.join('/')} bền ${d.safety}`;
}

/** Việc người chơi làm mỗi năm (tháng Giêng): vẽ vá lại tuyến đê — đoạn vỡ thành đất trũng cần đắp cao hơn 1. */
const steward = (s: GameState) => planDikeLine(s, 7, 0, 159, 5);

describe('cổng M4: lũ đê (bản đồ phẳng)', () => {
  it('10 năm lũ ngẫu nhiên: ≥1.000 dân, không năm nào mất quá 20% dân, đê xong thì không nhà nào ngập', () => {
    const s = createSim(3, { flat: true });
    s.treasury = START_FUNDS;
    buildTown(s);
    demoPriorities(s);
    const t0 = performance.now();
    let worstLossPct = 0, worstYear = 0, floodedHousesAfterDike = 0;
    const peaks: number[] = [];
    for (let y = 1; y <= 10; y++) {
      steward(s);
      let before = s.population, minPop = s.population, maxFlooded = 0, breaches = 0, floodedHouses = 0;
      for (let i = 0; i < TICKS_PER_YEAR; i++) {
        tick(s);
        if (i % TICKS_PER_DAY === 0) {
          // dân trước mùa lũ = mốc tính mất mát; trong mùa lũ theo dõi đáy
          if (s.flood.dayInSeason === 0) { before = s.population; minPop = s.population; }
          if (s.flood.dayInSeason >= 0) minPop = Math.min(minPop, s.population);
          maxFlooded = Math.max(maxFlooded, s.flood.floodedTiles);
          breaches = Math.max(breaches, s.flood.breachesThisYear);
          if (s.flood.peak && !peaks[y]) peaks[y] = s.flood.peak;
          for (const b of s.buildings) if (b.type === BuildingType.House && b.flooded) floodedHouses++;
        }
      }
      // mất mát tính từ 2 tháng sau mùa lũ để dân kịp quay lại (mốc: dân đầu mùa lũ)
      const lossPct = before > 0 ? Math.round(((before - Math.min(minPop, s.population)) * 100) / before) : 0;
      if (y >= 3 && lossPct > worstLossPct) { worstLossPct = lossPct; worstYear = y; }
      if (y >= 4) floodedHousesAfterDike += floodedHouses;
      let flooded = 0;
      for (let o = 0; o < s.grid.terrain.length; o++) if (s.grid.terrain[o] & T_FLOODED) flooded++;
      console.log(`năm ${y}: lũ mức ${peaks[y] ?? '-'} · dân ${before} → đáy ${minPop} → cuối năm ${s.population} (mất ${lossPct}%) · ngập tối đa ${maxFlooded} ô, nhà-ngày ngập ${floodedHouses}, vỡ ${breaches} · ${dikeStats(s)} · ngân khố ${s.treasury}`);
      expect(flooded).toBe(0); // cuối năm (tháng Giêng) không còn ô ngập
    }
    console.log('ms', Math.round(performance.now() - t0), '· sự kiện:', s.events.join(' | '));
    expect(s.population).toBeGreaterThanOrEqual(1000);
    expect(worstLossPct, `năm ${worstYear} mất ${worstLossPct}%`).toBeLessThanOrEqual(20);
    expect(dikeSafety(s).built).toBe(160); // phu đê đắp xong cả tuyến
    expect(floodedHousesAfterDike).toBe(0);
  }, 120000);

  it('đê xong rồi gặp đại hồng thủy (mức 4): thợ cả giữ đê, mất dân ≤ 20%', () => {
    const s = createSim(3, { flat: true });
    s.treasury = START_FUNDS;
    buildTown(s);
    demoPriorities(s);
    for (let y = 1; y <= 4; y++) { steward(s); for (let i = 0; i < TICKS_PER_YEAR; i++) tick(s); }
    expect(dikeSafety(s).built).toBe(160);
    // ép đỉnh lũ năm 5 = 4 (nha môn dự báo từ tháng 4 dùng nextPeak, nên đặt trước tháng 4)
    const before = s.population;
    let minPop = before, maxFlooded = 0, floodedHouses = 0;
    for (let i = 0; i < TICKS_PER_YEAR; i++) {
      if (s.time.month === 2 && s.time.day === 15 && s.time.tick === 0) s.flood.nextPeak = 4;
      tick(s);
      if (i % TICKS_PER_DAY === 0) {
        minPop = Math.min(minPop, s.population);
        maxFlooded = Math.max(maxFlooded, s.flood.floodedTiles);
        for (const b of s.buildings) if (b.type === BuildingType.House && b.flooded) floodedHouses++;
      }
    }
    console.log(`đại hồng thủy: dân ${before} → đáy ${minPop} → ${s.population} · ngập tối đa ${maxFlooded} ô · nhà-ngày ngập ${floodedHouses} · vỡ ${s.flood.breachesThisYear} · ${dikeStats(s)}`);
    expect(maxFlooded).toBeGreaterThan(0); // dải ngoài đê (x=4–6) vẫn ngập
    expect(s.flood.breachesThisYear).toBeLessThan(80); // có thể vỡ vài đoạn, không vỡ cả tuyến
    expect(((before - minPop) * 100) / before).toBeLessThanOrEqual(20);
  }, 120000);
});
