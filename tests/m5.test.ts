// Kiểm tra từng cơ chế M5 (triều đình, tín ngưỡng, chỉ số) trên bản đồ phẳng nhỏ.
import { describe, expect, it } from 'vitest';
import { applyCommand, createSim, tick } from '../src/sim';
import { BuildingType, Deity, FigureType, LaborCat, Resource, TICKS_PER_DAY, type GameState } from '../src/sim/state';
import { BUILDING_DEFS, court, HOUSE_LEVELS, MAX_HOUSE_LEVEL, UNITS_PER_LOAD } from '../src/sim/buildings/defs';
import { addFavor, deliverEdict, dispatchEdict, scheduleEdict, sendGift, tributeFor, updateCourt } from '../src/sim/city/court';
import { coverage, holdFestival, moodTarget, updateWorshipDaily, updateWorshipMonthly } from '../src/sim/city/worship';
import { cultureBreakdown, prosperityCap, updateCulture, updateYearlyRatings } from '../src/sim/city/ratings';
import { updateHealth } from '../src/sim/city/health';
import { updateLabor } from '../src/sim/city/labor';
import { missingFor } from '../src/sim/buildings/house';
import { createScenario, SCENARIOS } from '../src/sim/scenario/loader';
import { checkVictory } from '../src/sim/scenario/victory';
import { gridOffset } from '../src/sim/map/grid';

const build = (s: GameState, kind: string, x: number, y: number): GameState['buildings'][number] => {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind, x, y });
  expect(s.buildings.length, `đặt ${kind} tại ${x},${y}`).toBe(n + 1);
  return s.buildings[n];
};
const roadLine = (s: GameState, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) applyCommand(s, { type: 'build', kind: 'road', x, y }); };
const days = (s: GameState, n: number) => { for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s); };
/** Chạy n ngày mà không cho nhà thử cháy / sập (không có tuần đinh, thợ cả). */
const safeDays = (s: GameState, n: number, ...bs: GameState['buildings'][number][]) => { for (let d = 0; d < n; d++) { for (const b of bs) { b.fireRisk = 0; b.damageRisk = 0; } days(s, 1); } };
const flat = () => { const s = createSim(1, { flat: true }); s.treasury = 1e6; return s; };
/** Nhà thử trên núi (x ≥ 100, cao độ 3) để lũ vừa / lớn không xóa lều. */
const HX = 110, HY = 27;
const peopled = (s: GameState, pop: number) => { const h = build(s, 'house', HX, HY); h.population = pop; h.level = 1; s.population = pop; return h; };

describe('dữ liệu', () => {
  it('10 bậc nhà mở, phẩm hàm 9 bậc, công trình mới có trong bảng', () => {
    expect(MAX_HOUSE_LEVEL).toBe(10);
    expect(HOUSE_LEVELS[9].needs.academy && HOUSE_LEVELS[9].needs.puppet && HOUSE_LEVELS[10].needs.shrine).toBe(true);
    expect(HOUSE_LEVELS[10].prosperity).toBe(100);
    expect(court.ranks.names).toHaveLength(9);
    for (const t of [BuildingType.Academy, BuildingType.PuppetStage, BuildingType.Shrine, BuildingType.Altar, BuildingType.VanMieu]) expect(BUILDING_DEFS[t].name).toBeTruthy();
    expect(BUILDING_DEFS[BuildingType.VanMieu].rank).toBe(5);
    expect(SCENARIOS.sonNam.goals.population).toBe(1000);
  });
  it('Văn Miếu cần phẩm hàm 5', () => {
    const s = flat();
    applyCommand(s, { type: 'build', kind: 'vanMieu', x: 20, y: 20 });
    expect(s.buildings.length).toBe(1);
    s.court.rank = 5;
    build(s, 'vanMieu', 20, 20);
  });
});

describe('Ân sủng và chiếu chỉ', () => {
  it('−2 mỗi năm; bổng lộc cao hơn phẩm hàm trừ chênh lệch, thấp hơn +1; cống nạp theo dân, không nộp khi âm', () => {
    const s = flat();
    peopled(s, 500);
    s.court.rank = 3; s.court.salaryLevel = 5; s.court.favor = 50;
    s.time.month = 11; s.time.day = 15; s.time.tick = 0; s.time.totalDays = 191;
    days(s, 2); // qua ngày 1 tháng Giêng (tick 27 của ngày mới)
    expect(s.time.month).toBe(0);
    expect(s.court.favor).toBe(50 - 2 - 2);
    expect(s.court.tributeDue).toBe(100); // dân ≤ 1000
    expect(s.treasury).toBe(1e6 - 10 - 100 - court.ranks.salary[5] - (Math.floor(500 / 10) + 20)); // nhà + cống + 1 tháng bổng lộc + Tết
    expect(s.court.personalFunds).toBe(court.ranks.salary[5]);
    s.court.salaryLevel = 1; s.treasury = -10;
    applyCommand(s, { type: 'setTax', rate: 0 }); // kẻo dân bất mãn vì thất nghiệp bỏ đi hết, cống nạp về 0
    safeDays(s, 192, s.buildings[1]);
    expect(s.court.favor).toBe(46 - 2 + 1 - 3); // decay, bổng lộc thấp, không nộp cống
    expect(s.court.tributeMissedYears).toBe(1);
    s.population = 3000; s.lastYear.taxes = 4000;
    expect(tributeFor(s)).toBe(400);
    s.population = 6000; s.lastYear = { taxes: 10000, wages: 2000, construction: 0, stolen: 0, tribute: 0, salary: 0, festivals: 0, exports: 0, imports: 0 };
    expect(tributeFor(s)).toBe(2000); // 25% lãi
  });

  it('sứ giả tới nha môn giao chiếu chỉ; trễ lần đầu phạt + gia hạn, lần hai bỏ', () => {
    const s = flat();
    roadLine(s, 4, 30, 30);
    const h = peopled(s, 50);
    const yamen = build(s, 'yamen', 20, 31);
    const e = scheduleEdict(s, { type: 'money', year: 1, month: 2, resource: Resource.None, building: BuildingType.None, amount: 100, height: 0, deadlineMonths: 2, reward: 4 });
    expect(e.state).toBe('coming');
    days(s, 17); // qua ngày 1 tháng 2: sứ giả đi từ cửa ngõ (4,80)
    expect(s.figures.some((f) => f.type === FigureType.Messenger)).toBe(true);
    days(s, 25); // ~65 ô × 15 tick ≈ 20 ngày
    expect(e.state).toBe('active');
    expect(s.figures.some((f) => f.type === FigureType.Messenger)).toBe(false);
    const f0 = s.court.favor, y0 = s.time.year;
    safeDays(s, 2 * 16 + 1, h, yamen);
    expect(e.extended).toBe(true);
    expect(s.court.favor).toBe(f0 - 3 - 2 * (s.time.year - y0)); // −2 mỗi năm qua
    safeDays(s, 24 * 16 + 1, h, yamen);
    expect(e.state).toBe('failed');
    expect(s.court.favor).toBe(f0 - 3 - 5 - 2 * (s.time.year - y0));
    expect(yamen.type).toBe(BuildingType.Yamen); expect(h.type).toBe(BuildingType.House);
  });

  it('thuế vật rút từ kho và cho đoàn xe đi; tiền trừ ngân khố; binh dịch cần vũ khí + dân, về sau 12–24 tháng', () => {
    const s = flat();
    roadLine(s, 4, 40, 30);
    const h = peopled(s, 100); h.level = 3;
    const w = build(s, 'warehouse', 20, 31); w.numWorkers = 6;
    w.store[Resource.Pottery] = 5 * UNITS_PER_LOAD; w.store[Resource.Weapons] = 2 * UNITS_PER_LOAD;
    const g = scheduleEdict(s, { type: 'goods', year: 1, month: 1, resource: Resource.Pottery, building: BuildingType.None, amount: 6, height: 0, deadlineMonths: 6, reward: 5 });
    deliverEdict(s, g);
    expect(dispatchEdict(s, g.id)).toContain('chưa đủ');
    w.store[Resource.Pottery] = 7 * UNITS_PER_LOAD;
    const f0 = s.court.favor;
    expect(dispatchEdict(s, g.id)).toBeNull();
    expect(w.store[Resource.Pottery]).toBe(UNITS_PER_LOAD);
    expect(s.court.favor).toBe(f0 + 5);
    expect(s.figures.filter((f) => f.type === FigureType.Convoy).length).toBe(4);
    const m = scheduleEdict(s, { type: 'money', year: 1, month: 1, resource: Resource.None, building: BuildingType.None, amount: 300, height: 0, deadlineMonths: 6, reward: 3 });
    deliverEdict(s, m);
    expect(dispatchEdict(s, m.id)).toBeNull();
    expect(s.treasury).toBe(1e6 - 300 - BUILDING_DEFS[BuildingType.Warehouse].cost - 10);
    const t = scheduleEdict(s, { type: 'troops', year: 1, month: 1, resource: Resource.None, building: BuildingType.None, amount: 30, height: 0, deadlineMonths: 6, reward: 8 });
    deliverEdict(s, t);
    expect(dispatchEdict(s, t.id)).toContain('vũ khí');
    w.store[Resource.Weapons] = 3 * UNITS_PER_LOAD;
    expect(dispatchEdict(s, t.id)).toBeNull();
    expect(h.population).toBe(70);
    expect(w.store[Resource.Weapons]).toBe(0);
    expect(t.returnDay).toBeGreaterThan(s.time.totalDays + 11 * 16);
    expect(t.survivors).toBeGreaterThanOrEqual(9); expect(t.survivors).toBeLessThanOrEqual(21);
    expect(s.figures.some((f) => f.type === FigureType.Soldiers)).toBe(true);
    s.time.totalDays = t.returnDay;
    updateCourt(s);
    expect(s.migrationQuota).toBe(Math.min(20, t.survivors));
  });

  it('lao dịch khóa % nhân công vào ngành thứ 10, cộng tiến độ mỗi ngày; nghi lễ và đê tự hoàn thành', () => {
    const s = flat();
    roadLine(s, 4, 40, 30);
    const h = peopled(s, 100); h.level = 1;
    const paddy = build(s, 'paddy', 20, 31); paddy.housesCovered = 50;
    const c = scheduleEdict(s, { type: 'corvee', year: 1, month: 1, resource: Resource.None, building: BuildingType.None, amount: 100, height: 0, deadlineMonths: 6, reward: 4 });
    deliverEdict(s, c);
    expect(dispatchEdict(s, c.id, 2)).toBeNull();
    expect(c.corveePct).toBe(30);
    updateLabor(s);
    expect(s.labor.workforce).toBe(60);
    expect(s.labor.allocated[LaborCat.Corvee]).toBe(18);
    expect(s.court.corveeWorkers).toBe(18);
    expect(paddy.numWorkers).toBe(10); // còn 42 cho các ngành khác
    applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Corvee, priority: 1 });
    expect(s.labor.priority[LaborCat.Corvee]).toBe(0);
    updateCourt(s); updateCourt(s); updateCourt(s); updateCourt(s); updateCourt(s); updateCourt(s);
    expect(c.state).toBe('done'); // 6 × 18 = 108 ≥ 100
    expect(c.corveePct).toBe(0);
    const r = scheduleEdict(s, { type: 'ritual', year: 1, month: 1, resource: Resource.None, building: BuildingType.Altar, amount: 1, height: 0, deadlineMonths: 6, reward: 2 });
    deliverEdict(s, r);
    updateCourt(s);
    expect(r.state).toBe('active');
    build(s, 'altar', 10, 10);
    updateCourt(s);
    expect(r.state).toBe('done');
    const d = scheduleEdict(s, { type: 'dike', year: 1, month: 1, resource: Resource.None, building: BuildingType.None, amount: 2, height: 2, deadlineMonths: 6, reward: 10 });
    deliverEdict(s, d);
    for (const y of [50, 51]) { build(s, 'dike', 7, y); s.buildings.at(-1)!.height = 2; }
    updateCourt(s);
    expect(d.state).toBe('done');
  });

  it('tiến cống từ bổng lộc: +3/+5/+10, giảm dần về 0 ở lần thứ tư; Ân sủng ≤ 10 thì bị thay sau 192 ngày', () => {
    const s = flat();
    peopled(s, 100);
    s.treasury = 1000;
    s.court.personalFunds = 5000;
    s.court.favor = 50;
    expect(sendGift(s, 2)).toBeNull(); expect(s.court.favor).toBe(60);
    expect(sendGift(s, 2)).toBeNull(); expect(s.court.favor).toBe(67);
    expect(sendGift(s, 2)).toBeNull(); expect(s.court.favor).toBe(70);
    expect(sendGift(s, 2)).toBeNull(); expect(s.court.favor).toBe(70);
    s.court.personalFunds = 0;
    expect(sendGift(s, 0)).toContain('bổng lộc');
    addFavor(s, -65);
    updateCourt(s);
    expect(s.court.dismissalDay).toBe(s.time.totalDays + 192);
    s.time.totalDays = s.court.dismissalDay;
    checkVictory(s);
    expect(s.gameOver).toBe('dismissed');
  });

  it('khoa cử 3 năm một lần: số đỗ = dân có thầy đồ ÷ 200, Ân sủng +1 mỗi người, có thể về làm quan bậc 9', () => {
    const s = flat();
    roadLine(s, 4, 40, 30);
    const h = peopled(s, 400); h.school = 50; h.level = 5;
    const empty = build(s, 'house', 32, 31);
    s.grid.desirability[gridOffset(32, 31)] = 60;
    const ac = build(s, 'academy', 20, 31); ac.numWorkers = 12;
    s.time.year = 3; s.time.month = court.exam.examMonth - 1; s.time.day = 0;
    const f0 = s.court.favor;
    updateCourt(s);
    expect(s.court.graduates).toBe(2);
    expect(s.court.favor).toBe(f0 + 2);
    expect(s.court.lastExamYear).toBe(3);
    updateCulture(s);
    expect(s.ratings.culture).toBeGreaterThanOrEqual(4);
    // 1/4 mỗi người về: thử nhiều seed để chắc có lần về
    let returned = 0;
    for (let seed = 1; seed < 40 && !returned; seed++) {
      const t = flat(); t.rng.state = seed;
      roadLine(t, 4, 40, 30);
      const hh = peopled(t, 400); hh.school = 50; hh.level = 5;
      const em = build(t, 'house', 32, 31); t.grid.desirability[gridOffset(32, 31)] = 60;
      const a2 = build(t, 'academy', 20, 31); a2.numWorkers = 12;
      t.time.year = 3; t.time.month = court.exam.examMonth - 1; t.time.day = 0;
      updateCourt(t);
      if (em.level === 9) { returned++; expect(em.population).toBe(court.exam.mandarinHouseholdPop); }
    }
    expect(returned).toBe(1);
    expect(empty.type).toBe(BuildingType.House);
  });
});

describe('nhà quan lại bậc 9–10', () => {
  it('bậc 9 cần trường học, rối nước, lụa, độ hấp dẫn 55; bậc 10 cần đền và đồ đồng; quan đi kiệu cộng độ hấp dẫn tạm', () => {
    const s = flat();
    roadLine(s, 4, 40, 30);
    const h = peopled(s, 28); h.level = 8; h.water = 2; h.dinh = h.temple = h.school = h.clinic = h.entertainment = h.marketAccess = 50;
    for (const r of [Resource.Rice, Resource.Fish, Resource.Veg]) h.store[r] = 50;
    for (const g of [Resource.Pottery, Resource.Salt, Resource.Cloth, Resource.Tea]) h.store[g] = 2;
    s.grid.desirability[gridOffset(HX, HY)] = 80;
    expect(missingFor(s, h, 9)).toBe('rối nước');
    h.puppet = 50;
    expect(missingFor(s, h, 9)).toBe('trường học');
    h.academy = 50;
    expect(missingFor(s, h, 9)).toBe('lụa');
    h.store[Resource.Silk] = 2;
    expect(missingFor(s, h, 9)).toBeNull();
    expect(missingFor(s, h, 10)).toBe('đền (miếu, Văn Miếu)');
    h.shrine = 50;
    expect(missingFor(s, h, 10)).toBe('đồ đồng');
    h.store[Resource.Bronze] = 2;
    expect(missingFor(s, h, 10)).toBeNull();
    h.level = 9;
    roadLine(s, HX, HX + 20, HY + 1); // quan đi kiệu cần đường kề để dạo
    for (let d = 0; d < 20; d++) { h.devolveDays = 0; h.fireRisk = 0; h.damageRisk = 0; days(s, 1); } // không có giếng gạch thì nhà tụt bậc, giữ bậc 9 để thử
    expect(s.figures.some((f) => f.type === FigureType.Mandarin) || s.grid.prestige.some((v) => v > 0)).toBe(true);
    updateLabor(s);
    expect(s.labor.workforce).toBe(0); // quan lại không lao động
  });
});

describe('tín ngưỡng', () => {
  it('mục tiêu = bao phủ đền + lễ + nhiều/ít đền nhất; phù hộ ở 100; sét giận 20 quở nhỏ, 50 quở lớn', () => {
    const s = flat();
    peopled(s, 1000);
    build(s, 'dinh', 10, 10); build(s, 'dinh', 14, 10); build(s, 'dinh', 18, 10);
    for (const b of s.buildings) if (b.type === BuildingType.Dinh) b.numWorkers = 6;
    build(s, 'altar', 10, 14);
    expect(coverage(s, Deity.ThanhHoang)).toBe(100);
    expect(coverage(s, Deity.TienNong)).toBe(50);
    expect(coverage(s, Deity.Phat)).toBe(0);
    expect(moodTarget(s, Deity.ThanhHoang)).toBe(150); // + nhiều đền nhất
    expect(moodTarget(s, Deity.Phat)).toBe(-25);
    expect(moodTarget(s, Deity.TienNong)).toBe(50);
    expect(holdFestival(s, Deity.TienNong, 1)).toBeNull();
    expect(moodTarget(s, Deity.TienNong)).toBe(62);
    expect(s.treasury).toBe(1e6 - 10 - 120 * 3 - 50 - (Math.floor(1000 / 10) + 20));
    for (let i = 0; i < 60; i++) updateWorshipDaily(s);
    const g = s.worship.gods[Deity.ThanhHoang];
    expect(g.blessings).toBe(1); // 50 → 100 trong 50 ngày rồi về 50
    expect(s.events.some((e) => e.includes('Thành hoàng phù hộ'))).toBe(true);
    const p = s.worship.gods[Deity.Phat];
    expect(p.mood).toBe(0);
    for (let i = 0; i < 7; i++) updateWorshipMonthly(s);
    expect(p.bolts).toBe(21); // 3 sét/tháng khi < 20
    expect(p.wraths).toBe(1);
    expect(s.worship.healersOffDays).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) updateWorshipMonthly(s);
    expect(p.wraths).toBe(2); // 51 → quở lớn
    expect(p.bolts).toBe(0);
    expect(s.ratings.plaguePending).toBe(true);
    updateHealth(s);
    expect(s.events.some((e) => e.startsWith('Dịch bệnh'))).toBe(true);
  });
  it('Thủy thần quở lớn dâng lũ và rạn đê; Tiên nông quở làm ruộng lép', () => {
    const s = flat();
    peopled(s, 1000);
    build(s, 'dike', 7, 50); s.buildings.at(-1)!.height = 3; s.buildings.at(-1)!.integrity = 100;
    const paddy = build(s, 'paddy', 20, 20); paddy.progress = 150; paddy.numWorkers = 10;
    s.flood.nextPeak = 2;
    const w = s.worship.gods[Deity.ThuyThan]; w.mood = 0; w.bolts = 49;
    const t = s.worship.gods[Deity.TienNong]; t.mood = 0; t.bolts = 49;
    updateWorshipMonthly(s);
    expect(s.flood.nextPeak).toBe(3);
    expect(s.buildings.at(-2)!.integrity).toBe(court.worship.wrath.dikeIntegrity);
    expect(paddy.progress).toBe(0);
    expect(s.worship.paddyFreezeDays).toBe(48);
  });
  it('Tết tháng Giêng tự động: trừ tiền cỡ vừa, +7 lòng dân; thành dưới 100 dân thần chưa để ý', () => {
    const s = flat();
    const h = peopled(s, 50);
    s.time.month = 11; s.time.day = 15; s.time.tick = 0; s.time.totalDays = 191;
    days(s, 1); // ngày 1 tháng Giêng, tick 0
    for (let i = 0; i < 27; i++) tick(s); // tới trước tick 27 (lòng dân kỳ tháng đã tính ở tick 22)
    const before = h.happiness;
    tick(s);
    expect(h.happiness).toBe(before + 7);
    expect(s.thisYear.festivals).toBe(Math.floor(50 / 10) + 20);
    for (let i = 0; i < 200; i++) updateWorshipDaily(s);
    expect(s.worship.gods.every((g) => g.mood === 50)).toBe(true);
  });
});

describe('bốn chỉ số và sức khỏe', () => {
  it('Văn hiến = tổng điểm bao phủ 5 loại (+2 mỗi người đỗ), trần 100', () => {
    const s = flat();
    peopled(s, 800);
    build(s, 'dinh', 10, 10); build(s, 'dinh', 14, 10); // 800/800 = 100% → 30
    build(s, 'temple', 18, 10); // 500/800 = 62% → 14 × 25/30 ≈ 12
    build(s, 'theater', 22, 10); // 62% → 5
    for (const b of s.buildings) b.numWorkers = 20;
    const br = cultureBreakdown(s);
    expect(br.find((g) => g.key === 'dinh')!.points).toBe(30);
    expect(br.find((g) => g.key === 'temple')!.points).toBe(12);
    expect(br.find((g) => g.key === 'school')!.points).toBe(0);
    updateCulture(s);
    expect(s.ratings.culture).toBe(30 + 12 + 5);
    s.court.graduates = 40;
    updateCulture(s);
    expect(s.ratings.culture).toBe(100);
  });
  it('Thịnh vượng cộng theo năm tới trần theo bậc nhà; Trị an +2/+5, −5 loạn dân, −3 vỡ đê', () => {
    const s = flat();
    const h = peopled(s, 20); h.level = 6; h.store[Resource.Rice] = 10; h.store[Resource.Fish] = 10;
    expect(prosperityCap(s)).toBe(35);
    s.lastYear.taxes = 1000; s.labor.unemploymentPct = 3; s.court.tributePaid = true;
    updateYearlyRatings(s);
    expect(s.ratings.prosperity).toBe(1 + 5 + 1 + 1); // thất nghiệp thấp, lãi, 2 loại lương thực, không mất mùa
    expect(s.ratings.peace).toBe(2);
    s.ratings.riotsThisYear = 1; s.ratings.breachesThisYear = 2; s.ratings.destroyedThisYear = 20; s.ratings.floodedHousesThisYear = 1;
    s.lastYear.taxes = 0; s.labor.unemploymentPct = 20;
    updateYearlyRatings(s);
    expect(s.ratings.prosperity).toBe(8 - 1 - 1 + 1 + 1 - 2); // thất nghiệp cao, lỗ, 2 lương thực, không mất mùa, nhà ngập
    expect(s.ratings.peace).toBe(0); // 2 + 2 − 12 − 5 − 3 < 0
    expect(s.ratings.yearsCalm).toBe(0);
    for (let i = 0; i < 3; i++) updateYearlyRatings(s);
    expect(s.ratings.peace).toBe(2 + 5 + 5);
    s.lastYear.taxes = 1000; s.labor.unemploymentPct = 3;
    for (let i = 0; i < 30; i++) updateYearlyRatings(s);
    expect(s.ratings.prosperity).toBe(35); // trần
  });
  it('sức khỏe tiến ±2/tháng về tỉ lệ nhà có thầy lang + lương thực; dịch khi < 40', () => {
    const s = flat();
    const a = peopled(s, 100); a.clinic = 50; a.store[Resource.Rice] = 10;
    const b = build(s, 'house', 32, 30); b.population = 100; b.level = 1;
    s.ratings.health = 50;
    updateHealth(s);
    expect(s.ratings.health).toBe(50); // mục tiêu 50
    b.clinic = 50; b.store[Resource.Rice] = 10;
    for (let i = 0; i < 30; i++) updateHealth(s);
    expect(s.ratings.health).toBe(100);
    s.worship.healthBonusMonths = 1;
    updateHealth(s);
    expect(s.ratings.health).toBe(100);
  });
  it('kịch bản: thắng khi đủ dân và 4 ngưỡng; hết hạn thì thua', () => {
    const s = createScenario('sonNam', 1, true);
    expect(s.court.rank).toBe(3);
    expect(s.treasury).toBe(10000);
    expect(s.court.edicts.length).toBe(7);
    expect(s.court.edicts.every((e) => e.month >= 2 && e.month <= 9)).toBe(true);
    checkVictory(s);
    expect(s.gameOver).toBe('');
    s.population = 1000; s.ratings.culture = 30; s.ratings.prosperity = 15; s.ratings.peace = 15; s.court.favor = 55;
    checkVictory(s);
    expect(s.gameOver).toBe('won');
    expect(s.court.rank).toBe(4);
    const t = createScenario('sonNam', 1, true);
    t.time.year = 10;
    checkVictory(t);
    expect(t.gameOver).toBe('timeout');
  });
});
