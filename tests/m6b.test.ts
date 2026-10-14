// M6b: bản đồ nạp từ file, 3 màn mới + chuỗi phẩm hàm, Quốc Tử Giám, tính cách vua, đất cấp theo phẩm hàm.
// Cổng: người chơi tự động (tests/court.test.ts) thắng màn Làng ven sông trên thị trấn mẫu trong hạn.
import { describe, expect, it } from 'vitest';
import { applyCommand, cityStats, createSim, tick } from '../src/sim';
import { createScenario, MAPS, nextScenarioKey, SCENARIO_LIST, SCENARIOS } from '../src/sim/scenario/loader';
import { buildCourtTown, demoPriorities } from '../src/sim/scenario/demo';
import { BuildingType, DAYS_PER_MONTH, MONTHS_PER_YEAR, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { GRID_SIZE, gridOffset, isBuildable, T_FLOODPLAIN, T_RESERVED, T_WATER } from '../src/sim/map/grid';
import { applyLandGrants } from '../src/sim/map/mapfile';
import { checkVictory, goalsMet } from '../src/sim/scenario/victory';
import { completeEdict, kingYearly, RANK_NAMES } from '../src/sim/city/court';
import { cultureBreakdown } from '../src/sim/city/ratings';
import { riverEdgeTile } from '../src/sim/city/trade';
import { invasionEntry } from '../src/sim/city/war';
import { BUILDING_DEFS } from '../src/sim/buildings/defs';
import { fromJson, toJson } from '../src/sim/save';
import { autoPlayer } from './helpers';

const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR;
const runDays = (s: GameState, days: number) => { for (let i = 0; i < days * TICKS_PER_DAY; i++) tick(s); };
const count = (s: GameState, flag: number) => { let n = 0; for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) if (s.grid.terrain[i] & flag) n++; return n; };

describe('bản đồ nạp từ file', () => {
  it('ba bản đồ có cửa ngõ là đất, cửa sông là nước ở mép, mép giặc là đất; bãi bồi suy ra từ sông', () => {
    for (const name of ['lang-ven-song', 'tran-li', 'thang-long']) {
      const m = MAPS[name];
      expect(m, name).toBeDefined();
      const s = createScenario(SCENARIO_LIST.find((d) => d.map === name)!.key, 1);
      const g = s.grid;
      expect(g.terrain[s.entryOffset] & T_WATER).toBe(0);
      expect(g.terrain[s.riverMouthOffset] & T_WATER).not.toBe(0);
      const mx = s.riverMouthOffset % GRID_SIZE, my = Math.floor(s.riverMouthOffset / GRID_SIZE);
      expect(mx === 0 || my === 0 || mx === GRID_SIZE - 1 || my === GRID_SIZE - 1, `${name}: cửa sông ở mép`).toBe(true);
      expect(riverEdgeTile(s)).toBe(s.riverMouthOffset);
      for (const src of ['north', 'south'] as const) {
        const o = invasionEntry(s, src);
        expect(o).toBe(s.enemyEntry[src]);
        expect(g.terrain[o] & T_WATER).toBe(0);
      }
      expect(g.terrain[invasionEntry(s, 'sea')] & T_WATER).toBe(0); // cướp biển lên ô đất cạnh cửa sông
      expect(count(s, T_WATER)).toBeGreaterThan(500);
      expect(count(s, T_FLOODPLAIN)).toBeGreaterThan(2000);
      expect(s.scenario.map).toBe(name);
    }
  });
  it('file sai (thiếu dòng, ký tự lạ, cửa ngõ dưới nước) bị từ chối', () => {
    const base = MAPS['lang-ven-song'];
    expect(() => createSim(1, { map: { ...base, rows: base.rows.slice(1) } })).toThrow(/dòng/);
    expect(() => createSim(1, { map: { ...base, rows: base.rows.map((r, i) => (i === 5 ? r.replace(/./, 'x') : r)) } })).toThrow(/ký tự lạ/);
    expect(() => createSim(1, { map: { ...base, entry: base.riverMouth } })).toThrow(/cửa ngõ/);
  });
  it('đất cấp theo phẩm hàm: Làng ven sông chỉ xây được trong ô vuông đã cấp; lên Tri phủ thì mở cả bản đồ; Thăng Long mở hết từ đầu', () => {
    const s = createScenario('langVenSong', 2);
    expect(s.court.rank).toBe(0);
    const reserved = count(s, T_RESERVED);
    expect(reserved).toBeGreaterThan(10000);
    expect(isBuildable(s.grid, 80, 80)).toBe(true);
    expect(isBuildable(s.grid, 150, 100)).toBe(false);
    expect(s.grid.terrain[s.entryOffset] & T_RESERVED).not.toBe(0); // cửa ngõ ngoài vùng cấp: dân vẫn đi qua được
    applyCommand(s, { type: 'build', kind: 'well', x: 150, y: 100 });
    expect(s.buildings.some((b) => b.type === BuildingType.Well)).toBe(false);
    s.court.rank = 1;
    const opened = applyLandGrants(s.grid, s.scenario.land, s.court.rank, s.dirty);
    expect(opened).toBe(reserved);
    expect(count(s, T_RESERVED)).toBe(0);
    expect(s.dirty.size).toBe(reserved);
    expect(isBuildable(s.grid, 150, 100)).toBe(true);
    const tl = createScenario('thangLong', 2);
    expect(count(tl, T_RESERVED)).toBe(0);
    expect(tl.court.rank).toBe(4);
    expect(createScenario('tranLi', 2).court.rank).toBe(1);
  });
  it('màn trên bản đồ thật chạy được: dân tới ở, lũ về, không lỗi', () => {
    const s = createScenario('langVenSong', 5);
    for (let x = 70; x <= 90; x++) applyCommand(s, { type: 'build', kind: 'road', x, y: 80 });
    applyCommand(s, { type: 'build', kind: 'dinh', x: 72, y: 81 });
    applyCommand(s, { type: 'build', kind: 'well', x: 76, y: 81 });
    applyCommand(s, { type: 'build', kind: 'watchPost', x: 77, y: 81 }); // lều không có điếm canh thì cháy
    for (let x = 78; x <= 90; x += 1) applyCommand(s, { type: 'build', kind: 'house', x, y: 79 });
    expect(s.buildings.filter((b) => b.type === BuildingType.House).length).toBe(13);
    runDays(s, DAYS_PER_MONTH * 8); // qua mùa lũ (tháng 6–9); lâu hơn thì xóm lều không chợ, không việc sẽ bỏ đi
    expect(s.population).toBeGreaterThan(20);
    expect(s.flood.peak).toBeGreaterThanOrEqual(1);
    expect(s.flood.peak).toBeLessThanOrEqual(2); // lũ nhỏ / vừa thôi (peakChances 70/30/0/0)
  });
});

describe('chuỗi màn và phẩm hàm', () => {
  it('bốn màn nạp từ bốn file theo thứ tự làng ven sông → trấn lị → Sơn Nam → Thăng Long; mỗi màn có vua', () => {
    expect(SCENARIO_LIST.map((d) => d.key)).toEqual(['langVenSong', 'tranLi', 'sonNam', 'thangLong']);
    expect(nextScenarioKey('langVenSong')).toBe('tranLi');
    expect(nextScenarioKey('tranLi')).toBe('sonNam');
    expect(nextScenarioKey('sonNam')).toBe('thangLong');
    expect(nextScenarioKey('thangLong')).toBe('');
    expect(SCENARIOS.langVenSong.events.some((e) => e.kind === 'invasion')).toBe(false); // màn đầu chưa có giặc
    expect(SCENARIOS.langVenSong.flood?.peakChances).toEqual([70, 30, 0, 0]);
    expect(SCENARIOS.tranLi.events.filter((e) => e.kind === 'invasion').length).toBeGreaterThanOrEqual(2);
    for (const d of SCENARIO_LIST) { expect(['buddhist', 'confucian', 'martial']).toContain(d.king); expect(d.rank).toBeLessThanOrEqual(d.promoteTo!); }
    expect(SCENARIO_LIST.map((d) => d.rank)).toEqual([0, 1, 3, 4]);
    expect(RANK_NAMES).toHaveLength(9);
  });
  it('thắng màn → phong phẩm hàm ghi trong màn (ít nhất +1), cấp thêm đất; màn kế nhận phẩm hàm mang theo', () => {
    const s = createScenario('langVenSong', 3);
    const g = s.scenario.goals;
    s.population = g.population; s.ratings.culture = g.culture; s.ratings.prosperity = g.prosperity; s.ratings.peace = g.peace; s.court.favor = g.favor;
    expect(goalsMet(s)).toBe(true);
    checkVictory(s);
    expect(s.gameOver).toBe('won');
    expect(s.court.rank).toBe(1);
    expect(s.speed).toBe(0);
    expect(count(s, T_RESERVED)).toBe(0);
    expect(s.events.join(' ')).toContain('Tri phủ');
    expect(s.events.join(' ')).toContain('cấp thêm');
    // Sơn Nam thắng ở phẩm hàm 3 → 4 (Tuyên phủ sứ); mang 4 sang Thăng Long; mang phẩm hàm cao hơn màn ghi thì giữ
    const sn = createScenario('sonNam', 3, true, 2);
    expect(sn.court.rank).toBe(3);
    const gg = sn.scenario.goals;
    sn.population = gg.population; sn.ratings.culture = gg.culture; sn.ratings.prosperity = gg.prosperity; sn.ratings.peace = gg.peace; sn.court.favor = gg.favor;
    checkVictory(sn);
    expect(sn.court.rank).toBe(4);
    expect(createScenario('thangLong', 3, true, sn.court.rank).court.rank).toBe(4);
    expect(createScenario('tranLi', 3, true, 4).court.rank).toBe(4);
    expect(createScenario('tranLi', 3, true, 4).court.salaryLevel).toBe(4);
  });
  it('công trình cần phẩm hàm: Quốc Tử Giám / Văn Miếu 4, thành đá 3 — lệnh xây bị từ chối khi phẩm hàm thấp', () => {
    expect(BUILDING_DEFS[BuildingType.QuocTuGiam].rank).toBe(4);
    expect(BUILDING_DEFS[BuildingType.StoneWall].rank).toBe(3);
    const s = createScenario('langVenSong', 4, true);
    s.treasury = 100000;
    applyCommand(s, { type: 'build', kind: 'quocTuGiam', x: 110, y: 27 });
    expect(s.buildings.some((b) => b.type === BuildingType.QuocTuGiam)).toBe(false);
    s.court.rank = 4;
    applyCommand(s, { type: 'build', kind: 'quocTuGiam', x: 110, y: 27 });
    expect(s.buildings.some((b) => b.type === BuildingType.QuocTuGiam)).toBe(true);
  });
  it('màn chỉ mở được tuyến buôn ghi trong kịch bản (Làng ven sông: miền núi, không có tuyến biển)', () => {
    const s = createScenario('langVenSong', 4, true);
    s.treasury = 5000;
    applyCommand(s, { type: 'openRoute', route: 1 });
    expect(s.trade.routes[1].open).toBe(false);
    applyCommand(s, { type: 'openRoute', route: 0 });
    expect(s.trade.routes[0].open).toBe(true);
  });
});

describe('Quốc Tử Giám và tính cách vua', () => {
  it('Quốc Tử Giám có người làm tính vào Văn hiến như trường học; thầy đi dạo phủ academy cho nhà', () => {
    const s = createScenario('thangLong', 6, true);
    s.treasury = 100000;
    for (let x = 100; x <= 120; x++) applyCommand(s, { type: 'build', kind: 'road', x, y: 30 });
    applyCommand(s, { type: 'build', kind: 'quocTuGiam', x: 110, y: 27 });
    const q = s.buildings.find((b) => b.type === BuildingType.QuocTuGiam)!;
    expect(q).toBeDefined();
    expect(q.size).toBe(3);
    s.population = 1000;
    q.numWorkers = 20;
    expect(cultureBreakdown(s).find((g) => g.key === 'academy')!.coverage).toBeGreaterThan(0);
    const info = cityStats(s);
    expect(info.ratings.culture).toBeGreaterThanOrEqual(0);
  });
  it('vua sùng Phật: đủ chùa theo dân thì Ân sủng +2 mỗi năm, thiếu thì −2; chiếu chỉ lễ nghi thưởng thêm', () => {
    const s = createScenario('langVenSong', 6, true);
    expect(s.scenario.king).toBe('buddhist');
    s.population = 600; // cần 2 chùa
    const f0 = s.court.favor;
    kingYearly(s);
    expect(s.court.favor).toBe(f0 - 2);
    expect(s.events.at(-1)).toContain('phật ý');
    s.treasury = 100000;
    for (const x of [100, 104, 108]) applyCommand(s, { type: 'build', kind: 'temple', x, y: 27 });
    const temples = s.buildings.filter((b) => b.type === BuildingType.Temple);
    expect(temples.length).toBe(3);
    temples[0].numWorkers = 1; temples[1].numWorkers = 1;
    kingYearly(s);
    expect(s.court.favor).toBe(f0);
    expect(s.events.at(-1)).toContain('hài lòng');
    // chiếu chỉ lễ nghi: thưởng + 2
    const e = s.court.edicts.find((x) => x.type === 'ritual')!;
    const f1 = s.court.favor;
    completeEdict(s, e);
    expect(s.court.favor).toBe(f1 + e.reward + 2);
    // dân ít thì vua chưa để ý
    const t = createScenario('langVenSong', 6, true);
    t.population = 50; const ft = t.court.favor; kingYearly(t); expect(t.court.favor).toBe(ft);
  });
  it('vua hiếu chiến (Trấn lị) xét trại lính, chiếu chỉ binh dịch +3; vua trọng Nho (Thăng Long) xét trường học', () => {
    const s = createScenario('tranLi', 6, true);
    expect(s.scenario.king).toBe('martial');
    s.population = 1200; kingYearly(s); expect(s.events.at(-1)).toContain('trại lính');
    const e = s.court.edicts.find((x) => x.type === 'troops')!;
    const f = s.court.favor; completeEdict(s, e); expect(s.court.favor).toBe(f + e.reward + 3);
    const t = createScenario('thangLong', 6, true);
    expect(t.scenario.king).toBe('confucian');
    t.population = 1200; kingYearly(t); expect(t.events.at(-1)).toContain('trường học');
  });
  it('lưu / nạp giữ cửa sông, mép giặc, đất cấp, vua (phiên bản 2); bản 1 cũ vẫn nạp được', () => {
    const s = createScenario('tranLi', 8);
    const r = fromJson(toJson(s));
    expect(r.riverMouthOffset).toBe(s.riverMouthOffset);
    expect(r.enemyEntry).toEqual(s.enemyEntry);
    expect(r.scenario.king).toBe('martial');
    expect(r.scenario.land).toEqual(s.scenario.land);
    expect(count(r, T_RESERVED)).toBe(count(s, T_RESERVED));
    const old = JSON.parse(toJson(createScenario('sonNam', 8, true))) as { version: number; state: Record<string, unknown> };
    old.version = 1; delete old.state.riverMouthOffset; delete old.state.enemyEntry;
    const sc = old.state.scenario as Record<string, unknown>; delete sc.king; delete sc.land; delete sc.next;
    const o = fromJson(JSON.stringify(old));
    expect(o.riverMouthOffset).toBe(-1);
    expect(o.scenario.king).toBe('');
    expect(o.scenario.land).toEqual([]);
  });
});

describe('cổng M6b: màn Làng ven sông', () => {
  it('người chơi tự động thắng màn đầu trong hạn trên thị trấn mẫu (bản đồ phẳng)', () => {
    const s = createScenario('langVenSong', 3, true);
    s.treasury = 100000; // thị trấn mẫu dựng sẵn không tính tiền xây (vốn 6.000 không đủ đặt hết một lúc; người chơi xây dần)
    buildCourtTown(s);
    demoPriorities(s);
    s.treasury = SCENARIOS.langVenSong.treasury;
    let wonYear = -1;
    for (let y = 1; y <= s.scenario.timeLimitYears; y++) {
      for (let i = 0; i < TICKS_PER_YEAR; i++) {
        if (s.time.tick === 0) autoPlayer(s);
        tick(s);
        if (s.gameOver) break;
      }
      const g = s.scenario.goals, r = s.ratings, c = s.court;
      console.log(`năm ${y}: dân ${s.population}/${g.population} · văn hiến ${r.culture}/${g.culture} · thịnh vượng ${r.prosperity}/${g.prosperity} · trị an ${r.peace}/${g.peace} · ân sủng ${c.favor}/${g.favor} · ngân khố ${s.treasury} · lũ ${s.flood.peak} · ${s.gameOver || ''}`);
      if (s.gameOver) { wonYear = y; break; }
    }
    expect(s.gameOver).toBe('won');
    expect(wonYear).toBeLessThanOrEqual(6);
    expect(s.court.rank).toBe(1);
    expect(s.scenario.next).toBe('tranLi');
  }, 120000);
});
