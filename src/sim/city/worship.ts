// Tín ngưỡng — thiết kế phần 6, cơ chế thần linh của Julius (city/gods.c) với 4 đối tượng thờ:
// Thành hoàng (đình), Phật (chùa), Thủy thần (miếu ven sông), Tiên nông (đàn tế). Tâm trạng ±1/ngày về mục tiêu
// = % nhà được phủ + (12 − tháng từ lễ) + nhiều đền nhất +50 / ít nhất −25. Sét giận tích theo tháng: 20 quở nhỏ, 50 quở lớn.
import { BuildingType, DEITIES, Deity, FigureType, type Building, type DeityState, type GameState, type WorshipState } from '../state';
import { logEvent } from '../log';
import { BUILDING_DEFS, court, flood } from '../buildings/defs';
import { roadAccess } from '../buildings/spawn';
import { createFigure, removeFigure } from '../figures/figure';
import { startRoam } from '../figures/movement';
import { nextInt } from '../rng';
import { isDike } from '../state';

const W = court.worship;
export const DEITY_NAMES: string[] = W.deities;
const TEMPLE_OF: BuildingType[] = [BuildingType.Dinh, BuildingType.Temple, BuildingType.Shrine, BuildingType.Altar];

export function initWorship(): WorshipState {
  const gods: DeityState[] = [];
  for (let i = 0; i < DEITIES; i++) gods.push({ mood: W.startMood, bolts: 0, monthsSinceFestival: W.festivalMonthsMax, blessings: 0, wraths: 0 });
  return { gods, healersOffDays: 0, paddyFreezeDays: 0, healthBonusMonths: 0, floodLevelMod: 0 };
}

/** Bao phủ đền (%) như religion coverage của Julius: sức chứa × số đền có người làm ÷ dân, trần 100. */
export function coverage(s: GameState, d: Deity): number {
  if (s.population <= 0) return 0;
  return Math.min(100, Math.floor((templeCount(s, d) * W.templeCapacity * 100) / s.population));
}

export function templeCount(s: GameState, d: Deity): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === TEMPLE_OF[d] && (BUILDING_DEFS[b.type].workers === 0 || b.numWorkers > 0)) n++;
  return n;
}

export function moodTarget(s: GameState, d: Deity): number {
  const counts = [0, 1, 2, 3].map((k) => templeCount(s, k));
  const max = Math.max(...counts), min = Math.min(...counts);
  let bonus = 0;
  if (max > min) { if (counts[d] === max) bonus = W.mostTemplesBonus; else if (counts[d] === min) bonus = W.leastTemplesPenalty; }
  const g = s.worship.gods[d];
  return coverage(s, d) + Math.max(0, W.festivalMonthsMax - g.monthsSinceFestival) + bonus;
}

// ---------- phù hộ / quở ----------

function worstHouses(s: GameState, n: number): Building[] {
  return s.buildings.filter((b) => b.type === BuildingType.House && b.population > 0).sort((a, b) => a.happiness - b.happiness).slice(0, n);
}

function spawnCriminals(s: GameState, type: FigureType, n: number): number {
  let k = 0;
  for (const h of worstHouses(s, n)) {
    const door = roadAccess(s.grid, h);
    if (door < 0) continue;
    const f = createFigure(s, type, door, h.id);
    if (f) { startRoam(f, 48); k++; }
  }
  if (type === FigureType.Thief) s.ratings.thievesThisYear += k; else s.ratings.riotsThisYear += k;
  return k;
}

function blessing(s: GameState, d: Deity): void {
  const B = W.blessing;
  switch (d) {
    case Deity.ThanhHoang:
      for (const b of s.buildings) if (b.type === BuildingType.House) b.happiness = Math.min(100, b.happiness + B.sentiment);
      logEvent(s, `Thành hoàng phù hộ: lòng dân +${B.sentiment}`);
      break;
    case Deity.Phat:
      s.worship.healthBonusMonths = B.healthBonusMonths;
      logEvent(s, `Phật phù hộ: sức khỏe +${B.healthBonus} trong ${B.healthBonusMonths} tháng`);
      break;
    case Deity.ThuyThan:
      adjustFlood(s, -1);
      logEvent(s, 'Thủy thần phù hộ: lũ năm nay nhỏ hơn một mức');
      break;
    case Deity.TienNong:
      for (const b of s.buildings) if (b.type === BuildingType.Paddy && !b.flooded) b.progress = BUILDING_DEFS[b.type].progressMax;
      logEvent(s, 'Tiên nông phù hộ: ruộng lúa chín rộ');
      break;
  }
}

function smallWrath(s: GameState, d: Deity): void {
  const R = W.wrath;
  switch (d) {
    case Deity.ThanhHoang: spawnCriminals(s, FigureType.Thief, R.thieves); logEvent(s, 'Thành hoàng quở: trộm cắp nổi lên'); break;
    case Deity.Phat: s.worship.healersOffDays = R.healersOffDays; logEvent(s, 'Phật quở: thầy lang nghỉ một tháng'); break;
    case Deity.ThuyThan: {
      const boat = s.figures.find((f) => f.type === FigureType.Boat);
      if (boat) removeFigure(s, boat.id);
      logEvent(s, boat ? 'Thủy thần quở: thuyền nan chìm' : 'Thủy thần quở: sóng dữ trên sông');
      break;
    }
    case Deity.TienNong:
      for (const b of s.buildings) if (b.type === BuildingType.Paddy) b.progress = 0;
      s.worship.paddyFreezeDays = R.paddyFreezeSmallDays;
      logEvent(s, 'Tiên nông quở: ruộng lúa lép');
      break;
  }
}

function bigWrath(s: GameState, d: Deity): void {
  const R = W.wrath;
  switch (d) {
    case Deity.ThanhHoang: spawnCriminals(s, FigureType.Rioter, R.riotHouses); logEvent(s, 'Thành hoàng quở lớn: loạn dân!'); break;
    case Deity.Phat: s.ratings.plaguePending = true; logEvent(s, 'Phật quở lớn: dịch bệnh'); break;
    case Deity.ThuyThan: {
      adjustFlood(s, 1);
      const dikes = s.buildings.filter((b) => isDike(b.type) && b.height > 0);
      if (dikes.length) dikes[nextInt(s.rng, dikes.length)].integrity = R.dikeIntegrity;
      logEvent(s, 'Thủy thần quở lớn: lũ dữ hơn, một đoạn đê rạn nứt');
      break;
    }
    case Deity.TienNong:
      for (const b of s.buildings) if (b.type === BuildingType.Paddy) b.progress = 0;
      s.worship.paddyFreezeDays = R.paddyFreezeBigDays;
      logEvent(s, 'Tiên nông quở lớn: mất mùa');
      break;
  }
}

/** Thủy thần ±1 mực lũ: đang mùa thì đổi đỉnh ngay, đã quay đỉnh (tháng 4–5) thì đổi đỉnh sắp tới, còn lại để dành cho lần quay sau. */
function adjustFlood(s: GameState, delta: number): void {
  const F = s.flood;
  const clamp = (v: number) => Math.max(1, Math.min(flood.peakChances.byLevel.length, v));
  if (F.dayInSeason >= 0) F.peak = clamp(F.peak + delta);
  else if (F.nextPeak > 0) F.nextPeak = clamp(F.nextPeak + delta);
  else s.worship.floodLevelMod += delta;
}

// ---------- cập nhật ----------

/** Mỗi ngày (tick 27). */
export function updateWorshipDaily(s: GameState): void {
  const Wst = s.worship;
  if (Wst.healersOffDays > 0) Wst.healersOffDays--;
  if (Wst.paddyFreezeDays > 0) Wst.paddyFreezeDays--;
  if (s.population < W.minPopulation) return; // thần chưa để ý làng mới lập: tâm trạng giữ nguyên
  for (let d = 0; d < DEITIES; d++) {
    const g = Wst.gods[d];
    const target = moodTarget(s, d);
    if (g.mood < target) g.mood++; else if (g.mood > target) g.mood--;
    g.mood = Math.max(0, Math.min(100, g.mood));
    if (g.mood >= 100) { blessing(s, d); g.blessings++; g.mood = W.startMood; }
  }
}

/** Ngày 1 mỗi tháng. */
export function updateWorshipMonthly(s: GameState): void {
  const Wst = s.worship;
  if (Wst.healthBonusMonths > 0) Wst.healthBonusMonths--;
  for (let d = 0; d < DEITIES; d++) {
    const g = Wst.gods[d];
    if (g.monthsSinceFestival < 99) g.monthsSinceFestival++;
    const before = g.bolts;
    // thành dưới minPopulation dân chưa bị quở (làng mới lập chưa kịp dựng đền)
    if (g.mood < 50 && s.population >= W.minPopulation) { for (const [below, add] of W.boltsBelow) if (g.mood < below) { g.bolts += add; break; } }
    else g.bolts = Math.max(0, g.bolts - 1);
    if (g.bolts >= W.bigWrathBolts) { bigWrath(s, d); g.wraths++; g.bolts = 0; }
    else if (g.bolts >= W.smallWrathBolts && before < W.smallWrathBolts) { smallWrath(s, d); g.wraths++; }
  }
  // Tết Nguyên đán: tháng Giêng, tự động, +7 lòng dân
  if (s.time.month === 0) {
    const cost = festivalCost(s, W.tet.sizeIndex);
    s.treasury -= cost;
    s.thisYear.festivals += cost;
    for (const b of s.buildings) if (b.type === BuildingType.House) b.happiness = Math.min(100, b.happiness + W.tet.sentiment);
    logEvent(s, `Tết Nguyên đán: ${cost} quan, lòng dân +${W.tet.sentiment}`);
  }
}

export function festivalCost(s: GameState, size: number): number {
  const Fe = W.festival;
  return Math.floor(s.population / Fe.div[size]) + Fe.base[size];
}

/** Lễ hội làng cho một đối tượng thờ: đặt lại bộ đếm tháng-từ-lễ. */
export function holdFestival(s: GameState, deity: number, size: number): string | null {
  if (deity < 0 || deity >= DEITIES) return 'đối tượng thờ không hợp lệ';
  if (size < 0 || size >= W.festival.div.length) return 'cỡ lễ không hợp lệ';
  const cost = festivalCost(s, size);
  if (s.treasury < cost) return `ngân khố không đủ ${cost} quan`;
  s.treasury -= cost;
  s.thisYear.festivals += cost;
  s.worship.gods[deity].monthsSinceFestival = 0;
  logEvent(s, `Lễ hội ${['nhỏ', 'vừa', 'lớn'][size]} thờ ${DEITY_NAMES[deity]}: ${cost} quan`);
  return null;
}
