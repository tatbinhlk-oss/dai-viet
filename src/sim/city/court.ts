// Triều đình — thiết kế phần 6. Ân sủng theo công thức Julius (favor), chiếu chỉ (request) do sứ giả đem tới nha môn,
// cống nạp hằng năm (tribute), phẩm hàm và bổng lộc (rank/salary), tiến cống (gift), khoa cử (thay hippodrome),
// ≤ 10 Ân sủng thì bị cách chức sau 192 ngày.
import { BuildingType, DAYS_PER_MONTH, FigureType, HOUSE_TIER_MANDARIN, isDike, Resource, type Building, type CourtState, type Edict, type EdictType, type GameState, type KingKind } from '../state';
import { BUILDING_DEFS, BUILDING_KEYS, court, HOUSE_LEVELS, RESOURCES, UNITS_PER_LOAD } from '../buildings/defs';
import { roadAccess, setHouseLevel } from '../buildings/spawn';
import { anchorOffset } from '../buildings/spawn';
import { takeable } from '../buildings/storage';
import { createFigure, removeFigure } from '../figures/figure';
import { setWalkPath } from '../figures/movement';
import { nextInt } from '../rng';
import { dikeSafety } from '../buildings/dike';

const F = court.favor;
const PENALTY = court.edictPenalty as Record<EdictType, number>;

export const RANK_NAMES: string[] = court.ranks.names;
export const SALARY: number[] = court.ranks.salary;
export const EDICT_TYPE_TEXT: Record<EdictType, string> = { goods: 'Thuế vật', troops: 'Binh dịch', corvee: 'Lao dịch', money: 'Nộp tiền', ritual: 'Nghi lễ', dike: 'Đắp đê' };

export function initCourt(rank: number, favor: number): CourtState {
  return {
    favor, rank, salaryLevel: rank, personalFunds: 0,
    tributeDue: 0, tributePaid: true, tributeMissedYears: 0, giftsInWindow: [],
    edicts: [], nextEdictId: 1, dismissalDay: -1, milestonesHit: [0, 0, 0], graduates: 0, lastExamYear: -1, corveeWorkers: 0,
  };
}

export function addFavor(s: GameState, delta: number): void {
  s.court.favor = Math.max(0, Math.min(100, s.court.favor + delta));
}

// ---------- M6b: tính cách vua ----------
export interface KingDef { name: string; text: string; edictBonus: Partial<Record<EdictType, number>>; graduateBonus: number; yearly: { building: string; perPop: number; minPop: number; bonus: number; penalty: number } }
const KINGS = court.king as unknown as Record<string, KingDef | string>;
export function kingDef(kind: KingKind): KingDef | null {
  if (!kind) return null;
  const k = KINGS[kind];
  if (!k || typeof k === 'string') throw new Error(`court.json: không có tính cách vua "${kind}"`);
  return k;
}
export const KING_KINDS: KingKind[] = ['buddhist', 'confucian', 'martial'];
for (const k of KING_KINDS) { const d = kingDef(k)!; if (!BUILDING_KEYS.has(d.yearly.building)) throw new Error(`court.json: vua ${k} cần công trình "${d.yearly.building}" không có`); }

/** Đầu năm: vua xét công trình mình trọng (chùa / trường / trại lính) có đủ theo dân không. */
export function kingYearly(s: GameState): void {
  const k = kingDef(s.scenario.king);
  if (!k || s.population < k.yearly.minPop) return;
  const type = BUILDING_KEYS.get(k.yearly.building)!;
  const have = s.buildings.filter((b) => b.type === type && (b.numWorkers > 0 || BUILDING_DEFS[type].workers === 0)).length;
  const need = Math.ceil(s.population / k.yearly.perPop);
  const name = BUILDING_DEFS[type].name.toLowerCase();
  if (have >= need) { addFavor(s, k.yearly.bonus); s.events.push(`Vua ${k.name} hài lòng: đủ ${name} (Ân sủng +${k.yearly.bonus})`); }
  else { addFavor(s, k.yearly.penalty); s.events.push(`Vua ${k.name} phật ý: cần ${need} ${name} có người làm, mới có ${have} (Ân sủng ${k.yearly.penalty})`); }
}

/** Mô tả ngắn chiếu chỉ cho sự kiện / UI. */
export function edictTitle(e: Edict): string {
  switch (e.type) {
    case 'goods': return `Nộp ${e.amount} kiện ${RESOURCES[e.resource].name.toLowerCase()}`;
    case 'troops': return `Gửi ${e.amount} đinh tráng ra trận`;
    case 'corvee': return `Lao dịch ${e.amount} ngày-người`;
    case 'money': return `Nộp ${e.amount} quan`;
    case 'ritual': return `Có ${e.amount} ${BUILDING_DEFS[e.building].name.toLowerCase()}`;
    case 'dike': return `Đắp ${e.amount} đoạn đê cao ${e.height}`;
  }
}

/** Thêm chiếu chỉ vào lịch (sứ giả xuất phát năm `year`, tháng ngẫu nhiên 2–9 nếu chưa định). */
export type EdictSpec = Omit<Edict, 'id' | 'title' | 'state' | 'extended' | 'progress' | 'corveePct' | 'returnDay' | 'survivors' | 'deadlineDay' | 'month'> & { month?: number };
export function scheduleEdict(s: GameState, e: EdictSpec): Edict {
  const month = e.month ?? court.edictMessengerMonthMin + nextInt(s.rng, court.edictMessengerMonthMax - court.edictMessengerMonthMin + 1);
  const edict: Edict = {
    ...e, month, id: s.court.nextEdictId++, title: '', state: 'coming', extended: false, progress: 0, corveePct: 0, returnDay: -1, survivors: 0, deadlineDay: -1,
  };
  edict.title = edictTitle(edict);
  s.court.edicts.push(edict);
  return edict;
}

const yamenOf = (s: GameState): Building | undefined => s.buildings.find((b) => b.type === BuildingType.Yamen);

/** Sứ giả tới nha môn (hoặc không có nha môn): chiếu chỉ có hiệu lực, bắt đầu tính hạn. */
export function deliverEdict(s: GameState, e: Edict): void {
  if (e.state !== 'coming') return;
  e.state = 'active';
  e.deadlineDay = s.time.totalDays + e.deadlineMonths * DAYS_PER_MONTH;
  s.events.push(`Chiếu chỉ: ${e.title} trong ${e.deadlineMonths} tháng`);
}

function spawnMessenger(s: GameState, e: Edict): void {
  const yamen = yamenOf(s);
  if (!yamen) { deliverEdict(s, e); return; }
  const f = createFigure(s, FigureType.Messenger, s.entryOffset, 0);
  if (!f) { deliverEdict(s, e); return; }
  f.loads = e.id;
  if (!setWalkPath(s, f, anchorOffset(yamen.x, yamen.y, 1), false)) { removeFigure(s, f.id); deliverEdict(s, e); }
  else s.events.push('Sứ giả triều đình đang tới nha môn');
}

export function completeEdict(s: GameState, e: Edict): void {
  const bonus = kingDef(s.scenario.king)?.edictBonus[e.type] ?? 0; // M6b: vua trọng loại chiếu chỉ này
  if (bonus) { addFavor(s, bonus); s.events.push(`Vua ${kingDef(s.scenario.king)!.name} khen: Ân sủng +${bonus}`); }
  e.state = 'done';
  addFavor(s, e.reward);
  s.events.push(`Hoàn thành chiếu chỉ: ${e.title} (Ân sủng +${e.reward})`);
}

/** Số kiện r trong vựa + kho (kể cả đang tích trữ). */
export function storedLoads(s: GameState, r: Resource): number {
  let u = 0;
  for (const b of s.buildings) if (b.type === BuildingType.Granary || b.type === BuildingType.Warehouse) u += b.store[r];
  return Math.floor(u / UNITS_PER_LOAD);
}

function takeLoads(s: GameState, r: Resource, loads: number): Building | null {
  let need = loads * UNITS_PER_LOAD, first: Building | null = null;
  for (const b of s.buildings) {
    if (need <= 0) break;
    if (b.type !== BuildingType.Granary && b.type !== BuildingType.Warehouse) continue;
    const n = Math.min(b.store[r], need);
    if (n <= 0) continue;
    b.store[r] -= n; need -= n;
    if (!first) first = b;
  }
  return first;
}

/** Dân thường (tầng 0) có thể gọi lính. */
export function draftablePopulation(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === BuildingType.House && HOUSE_LEVELS[b.level].tier === 0) n += b.population;
  return n;
}

function walkOut(s: GameState, type: FigureType, from: number, count: number): void {
  const f = createFigure(s, type, from, 0);
  if (!f) return;
  f.loads = count;
  if (!setWalkPath(s, f, s.entryOffset, false)) removeFigure(s, f.id);
}

/** Người chơi thi hành chiếu chỉ. Trả null nếu được, hoặc lý do không được. */
export function dispatchEdict(s: GameState, id: number, option = 0): string | null {
  const e = s.court.edicts.find((x) => x.id === id);
  if (!e || e.state !== 'active') return 'chiếu chỉ không còn hiệu lực';
  switch (e.type) {
    case 'goods': {
      if (storedLoads(s, e.resource) < e.amount) return `kho chưa đủ ${e.amount} kiện`;
      const from = takeLoads(s, e.resource, e.amount);
      const door = from ? roadAccess(s.grid, from) : -1;
      const n = Math.min(e.amount, 4);
      for (let i = 0; i < n; i++) walkOut(s, FigureType.Convoy, door >= 0 ? door : anchorOffset(from!.x, from!.y, 1), 1);
      completeEdict(s, e);
      return null;
    }
    case 'money':
      if (s.treasury < e.amount) return 'ngân khố không đủ';
      s.treasury -= e.amount;
      s.thisYear.tribute += e.amount;
      completeEdict(s, e);
      return null;
    case 'troops': {
      const T = court.troops;
      const weapons = Math.ceil(e.amount / T.menPerWeaponLoad);
      if (storedLoads(s, Resource.Weapons) < weapons) return `cần ${weapons} kiện vũ khí trong kho`;
      if (draftablePopulation(s) < e.amount) return `không đủ ${e.amount} đinh tráng (dân thường)`;
      takeLoads(s, Resource.Weapons, weapons);
      // gọi lính từ các nhà thường dân theo tỉ lệ
      let left = e.amount, from = s.entryOffset;
      for (const b of s.buildings) {
        if (left <= 0) break;
        if (b.type !== BuildingType.House || HOUSE_LEVELS[b.level].tier !== 0 || b.population === 0) continue;
        const take = Math.min(b.population, Math.max(1, Math.ceil(b.population / 2)), left);
        b.population -= take; left -= take;
        if (from === s.entryOffset) from = anchorOffset(b.x, b.y, 1);
        if (b.population === 0) setHouseLevel(s, b, 0);
      }
      walkOut(s, FigureType.Soldiers, from, e.amount);
      e.returnDay = s.time.totalDays + (T.returnMonthsMin + nextInt(s.rng, T.returnMonthsMax - T.returnMonthsMin + 1)) * DAYS_PER_MONTH;
      const loss = T.lossPctMin + nextInt(s.rng, T.lossPctMax - T.lossPctMin + 1);
      e.survivors = Math.floor((e.amount * (100 - loss)) / 100);
      completeEdict(s, e);
      return null;
    }
    case 'corvee': {
      const pct = court.corvee.pctOptions[Math.max(0, Math.min(court.corvee.pctOptions.length - 1, option))];
      e.corveePct = pct;
      s.events.push(`Lao dịch: khóa ${pct}% nhân công`);
      return null;
    }
    case 'ritual':
    case 'dike':
      return 'chiếu chỉ này tự hoàn thành khi đủ điều kiện';
  }
}

function checkAutoEdicts(s: GameState): void {
  for (const e of s.court.edicts) {
    if (e.state !== 'active') continue;
    if (e.type === 'ritual') {
      let n = 0;
      for (const b of s.buildings) if (b.type === e.building && (BUILDING_DEFS[b.type].workers === 0 || b.numWorkers > 0)) n++;
      if (n >= e.amount) completeEdict(s, e);
    } else if (e.type === 'dike') {
      let n = 0;
      for (const b of s.buildings) if (isDike(b.type) && b.height >= e.height) n++;
      if (n >= e.amount) completeEdict(s, e);
    } else if (e.type === 'corvee' && e.corveePct > 0) {
      e.progress += s.court.corveeWorkers;
      if (e.progress >= e.amount) { e.corveePct = 0; completeEdict(s, e); }
    }
  }
}

function checkDeadlines(s: GameState): void {
  for (const e of s.court.edicts) {
    if (e.state !== 'active' || s.time.totalDays <= e.deadlineDay) continue;
    if (!e.extended) {
      e.extended = true;
      e.deadlineDay += F.extensionMonths * DAYS_PER_MONTH;
      addFavor(s, PENALTY[e.type]);
      s.events.push(`Trễ chiếu chỉ "${e.title}": Ân sủng ${PENALTY[e.type]}, gia hạn ${F.extensionMonths} tháng`);
    } else {
      e.state = 'failed';
      e.corveePct = 0;
      addFavor(s, PENALTY[e.type] + F.secondLateExtra);
      s.events.push(`Bỏ chiếu chỉ "${e.title}": Ân sủng ${PENALTY[e.type] + F.secondLateExtra}`);
    }
  }
}

/** % lao dịch đang khóa (tổng các chiếu chỉ lao dịch đang thi hành, tối đa 30). */
export function corveePct(s: GameState): number {
  let p = 0;
  for (const e of s.court.edicts) if (e.state === 'active' && e.type === 'corvee') p += e.corveePct;
  return Math.min(30, p);
}

/** Cống nạp năm nay theo dân và lãi năm trước (Julius tribute). */
export function tributeFor(s: GameState): number {
  const pop = s.population;
  const tiers = court.tribute.byPopulation;
  let fixed = 0;
  for (const [limit, v] of tiers) if (pop <= limit) { fixed = v; break; } else fixed = -1;
  if (fixed >= 0) return fixed;
  const L = s.lastYear;
  const profit = L.taxes - L.wages - L.construction - L.stolen - L.tribute - L.salary - L.festivals;
  return Math.max(tiers[tiers.length - 1][1], Math.floor((Math.max(0, profit) * court.tribute.profitPct) / 100));
}

/** Đầu năm (ngày 1 tháng Giêng, sau chốt sổ): Ân sủng −2, bổng lộc so phẩm hàm, cống nạp. */
function yearly(s: GameState): void {
  const C = s.court;
  addFavor(s, -F.yearlyDecay);
  const diff = C.salaryLevel - C.rank;
  if (diff > 0) addFavor(s, -diff);
  else if (diff < 0) addFavor(s, F.salaryBelowBonus);
  kingYearly(s);
  C.tributeDue = tributeFor(s);
  if (C.tributeDue === 0) { C.tributePaid = true; C.tributeMissedYears = 0; return; }
  if (s.treasury < 0) {
    C.tributePaid = false;
    const pen = F.tributeMissed[Math.min(F.tributeMissed.length - 1, C.tributeMissedYears)];
    C.tributeMissedYears++;
    addFavor(s, pen);
    s.events.push(`Không nộp được cống nạp ${C.tributeDue} quan (ngân khố âm): Ân sủng ${pen}`);
  } else {
    s.treasury -= C.tributeDue;
    s.thisYear.tribute += C.tributeDue;
    C.tributePaid = true;
    C.tributeMissedYears = 0;
    s.events.push(`Nộp cống ${C.tributeDue} quan`);
  }
}

function monthly(s: GameState): void {
  const C = s.court;
  const pay = SALARY[C.salaryLevel];
  if (pay > 0) { s.treasury -= pay; s.thisYear.salary += pay; C.personalFunds += pay; }
  C.giftsInWindow = C.giftsInWindow.filter((d) => s.time.totalDays - d < court.gifts.windowMonths * DAYS_PER_MONTH);
  if (s.time.month === 0 && s.time.totalDays > 0) yearly(s);
}

function milestones(s: GameState): void {
  const goal = s.scenario.goals.population;
  if (goal <= 0) return;
  for (let i = 0; i < F.milestonePct.length; i++) {
    if (s.court.milestonesHit[i]) continue;
    if (s.population * 100 >= goal * F.milestonePct[i]) {
      s.court.milestonesHit[i] = 1;
      addFavor(s, F.milestoneBonus);
      s.events.push(`Triều đình hài lòng: dân đạt ${F.milestonePct[i]}% mục tiêu (Ân sủng +${F.milestoneBonus})`);
    } else if (s.time.year >= (s.scenario.milestoneYears[i] ?? 99)) {
      s.court.milestonesHit[i] = 2;
      addFavor(s, F.milestoneLatePenalty);
      s.events.push(`Triều đình sốt ruột: dân chưa đạt ${F.milestonePct[i]}% mục tiêu (Ân sủng ${F.milestoneLatePenalty})`);
    }
  }
}

function dismissal(s: GameState): void {
  const C = s.court;
  if (C.favor <= F.dismissAtOrBelow) {
    if (C.dismissalDay < 0) {
      C.dismissalDay = s.time.totalDays + F.dismissWarningDays;
      s.events.push(`Ân sủng quá thấp: triều đình cử quan khác đến thay sau ${F.dismissWarningDays} ngày!`);
    }
  } else if (C.dismissalDay >= 0) {
    C.dismissalDay = -1;
    s.events.push('Triều đình nguôi giận, hoãn thay quan');
  }
}

/** Binh dịch: đinh tráng sống sót trở về theo dòng dân nhập cư. */
function soldiersReturn(s: GameState): void {
  for (const e of s.court.edicts) {
    if (e.type !== 'troops' || e.returnDay < 0 || s.time.totalDays < e.returnDay) continue;
    e.returnDay = -1;
    s.migrationQuota = Math.min(20, s.migrationQuota + e.survivors);
    s.events.push(`${e.survivors}/${e.amount} đinh tráng trở về`);
  }
}

/** Khoa cử 3 năm một lần (tháng 3) nếu có trường học có người làm. */
function exam(s: GameState): void {
  const X = court.exam;
  const C = s.court;
  if (s.time.year === 0 || s.time.year % X.everyYears !== 0 || C.lastExamYear === s.time.year) return;
  if (s.time.month !== X.examMonth - 1 || s.time.day !== 0) return;
  C.lastExamYear = s.time.year;
  if (!s.buildings.some((b) => (b.type === BuildingType.Academy || b.type === BuildingType.QuocTuGiam) && b.numWorkers > 0)) { s.events.push('Không mở được khoa thi: chưa có trường học'); return; }
  let students = 0;
  for (const b of s.buildings) if (b.type === BuildingType.House && (b.school > 0 || b.academy > 0)) students += b.population;
  const n = Math.floor(students / X.perGraduate);
  C.graduates += n;
  const perGrad = X.favorPerGraduate + (kingDef(s.scenario.king)?.graduateBonus ?? 0); // M6b: vua trọng Nho
  addFavor(s, n * perGrad);
  let returned = 0;
  for (let i = 0; i < n; i++) {
    if (nextInt(s.rng, X.returnChanceIn) !== 0) continue;
    const home = s.buildings.find((b) => b.type === BuildingType.House && b.population === 0 && s.grid.desirability[anchorOffset(b.x, b.y, b.size)] >= HOUSE_LEVELS[HOUSE_TIER_MANDARIN].needs.desirability);
    if (!home) break;
    setHouseLevel(s, home, HOUSE_TIER_MANDARIN);
    home.population = X.mandarinHouseholdPop;
    home.happiness = s.sentiment;
    returned++;
  }
  s.events.push(n ? `Khoa thi: ${n} người đỗ (Ân sủng +${n * perGrad})${returned ? `, ${returned} vị về làm quan` : ''}` : 'Khoa thi: không ai đỗ');
}

/** Mỗi ngày (tick 27, sau lũ). */
export function updateCourt(s: GameState): void {
  const C = s.court;
  if (s.time.day === 0) monthly(s);
  // sứ giả xuất phát
  for (const e of C.edicts) {
    if (e.state === 'coming' && e.deadlineDay === -1 && s.time.year === e.year - 1 && s.time.month === e.month - 1 && s.time.day === 0) {
      e.deadlineDay = -2; // đã cử sứ giả
      spawnMessenger(s, e);
    }
  }
  checkAutoEdicts(s);
  checkDeadlines(s);
  soldiersReturn(s);
  milestones(s);
  exam(s);
  dismissal(s);
}

// ---------- lệnh người chơi ----------

export function giftCost(s: GameState, size: number): number {
  const G = court.gifts;
  return Math.max(G.costMin[size], Math.floor((Math.max(0, s.treasury) * G.costPctOfTreasury[size]) / 100));
}

export function sendGift(s: GameState, size: number): string | null {
  const G = court.gifts;
  if (size < 0 || size >= G.favor.length) return 'cỡ quà không hợp lệ';
  const cost = giftCost(s, size);
  if (s.court.personalFunds < cost) return `bổng lộc tích lũy chưa đủ ${cost} quan`;
  s.court.personalFunds -= cost;
  const n = s.court.giftsInWindow.length;
  const gain = Math.round((G.favor[size] * Math.max(0, 3 - n)) / 3);
  s.court.giftsInWindow.push(s.time.totalDays);
  addFavor(s, gain);
  s.events.push(`Tiến cống ${cost} quan: Ân sủng +${gain}`);
  return null;
}

export function setSalary(s: GameState, level: number): void {
  s.court.salaryLevel = Math.max(0, Math.min(SALARY.length - 1, Math.round(level)));
}

/** Hà đê sứ thanh tra (sự kiện kịch bản): độ bền trung bình < 60 → Ân sủng −5. */
export function dikeInspection(s: GameState): void {
  const d = dikeSafety(s);
  if (d.built > 0 && d.safety < 60) { addFavor(s, -5); s.events.push(`Hà đê sứ thanh tra: đê chỉ bền ${d.safety}% — Ân sủng −5`); }
  else s.events.push(d.built > 0 ? `Hà đê sứ thanh tra: đê bền ${d.safety}%, triều đình hài lòng` : 'Hà đê sứ thanh tra: lộ chưa có đê');
}
