// Bốn chỉ số — thiết kế phần 7 (city/ratings.c của Julius): Văn hiến theo tháng; Thịnh vượng, Trị an theo năm.
// Ân sủng nằm ở court.ts. Sức khỏe (chỉ số phụ) ở health.ts.
import { BuildingType, isDike, type GameState, type Ratings } from '../state';
import { BUILDING_DEFS, court, HOUSE_LEVELS } from '../buildings/defs';
import { foodTypes } from '../buildings/house';

const R = court.ratings;

export function initRatings(): Ratings {
  return {
    culture: 0, prosperity: 0, peace: 0, health: court.health.start,
    yearsCalm: 0, destroyedThisYear: 0, thievesThisYear: 0, riotsThisYear: 0, breachesThisYear: 0,
    floodedHousesThisYear: 0, paddiesFloodedThisYear: 0, floodedWellMonths: 0, plaguePending: false,
  };
}

const working = (s: GameState, t: BuildingType): number => {
  let n = 0;
  for (const b of s.buildings) if (b.type === t && (BUILDING_DEFS[t].workers === 0 || b.numWorkers > 0) && !b.flooded) n++;
  return n;
};

function points(coveragePct: number, max: number): number {
  for (const [at, ratio] of R.culture.tiers) if (coveragePct >= at && (at > 0 || coveragePct > 0)) return Math.round(max * ratio);
  return 0;
}

/** Bao phủ (%) và điểm từng loại — dùng cho UI và tính Văn hiến. */
export function cultureBreakdown(s: GameState): { key: string; name: string; coverage: number; points: number; max: number }[] {
  const pop = Math.max(1, s.population);
  const C = R.culture;
  const groups: [string, string, number, { max: number; capacity: number }][] = [
    ['dinh', 'Đình làng', working(s, BuildingType.Dinh), C.dinh],
    ['temple', 'Chùa và đền', working(s, BuildingType.Temple) + working(s, BuildingType.Shrine) + working(s, BuildingType.Altar) + working(s, BuildingType.VanMieu), C.temple],
    ['school', 'Lớp học thầy đồ', working(s, BuildingType.School), C.school],
    ['academy', 'Trường học', working(s, BuildingType.Academy), C.academy],
    ['entertainment', 'Chèo và rối nước', working(s, BuildingType.Theater) + working(s, BuildingType.PuppetStage), C.entertainment],
  ];
  return groups.map(([key, name, n, cfg]) => {
    const cov = s.population > 0 ? Math.min(100, Math.floor((n * cfg.capacity * 100) / pop)) : 0;
    return { key, name, coverage: cov, points: points(cov, cfg.max), max: cfg.max };
  });
}

/** Mỗi tháng. */
export function updateCulture(s: GameState): void {
  let total = 0;
  for (const g of cultureBreakdown(s)) total += g.points;
  total += s.court.graduates * court.exam.culturePerGraduate;
  s.ratings.culture = Math.max(0, Math.min(100, total));
}

/** Trần Thịnh vượng = trung bình giá trị thịnh vượng các bậc nhà có dân. */
export function prosperityCap(s: GameState): number {
  let sum = 0, n = 0;
  for (const b of s.buildings) if (b.type === BuildingType.House && b.population > 0) { sum += HOUSE_LEVELS[b.level].prosperity; n++; }
  return n ? Math.round(sum / n) : 0;
}

/** Đầu năm: Thịnh vượng và Trị an cộng dồn theo năm vừa qua, rồi xóa bộ đếm. */
export function updateYearlyRatings(s: GameState): void {
  const P = R.prosperity, Pe = R.peace, rt = s.ratings, L = s.lastYear;
  // --- Thịnh vượng ---
  let d = 0;
  const un = s.labor.unemploymentPct;
  if (un < P.unemploymentLow[0]) d += P.unemploymentLow[1];
  else if (un >= P.unemploymentHigh[0]) d += P.unemploymentHigh[1];
  const profit = L.taxes - L.wages - L.construction - L.stolen - L.tribute - L.salary - L.festivals;
  d += profit > 0 ? P.profit : P.loss;
  let houses = 0, foods = 0, tentPop = 0, mandarinPop = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    houses++; foods += foodTypes(b);
    if (b.level <= 1) tentPop += b.population;
    if (HOUSE_LEVELS[b.level].tier >= 2) mandarinPop += b.population;
  }
  if (houses && foods / houses >= 2) d += P.twoFoods;
  if (s.population > 0 && (tentPop * 100) / s.population > P.tentShare[0]) d += P.tentShare[1];
  if (s.population > 0 && (mandarinPop * 100) / s.population > P.mandarinShare[0]) d += P.mandarinShare[1];
  if (!s.court.tributePaid) d += P.tributeMissed;
  if (rt.paddiesFloodedThisYear === 0) d += P.noFloodCropLoss;
  if (rt.floodedHousesThisYear > 0) d += P.floodedHouses;
  const cap = prosperityCap(s);
  rt.prosperity = Math.max(0, Math.min(cap, rt.prosperity + d));
  // --- Trị an ---
  const calmYear = rt.destroyedThisYear === 0 && rt.riotsThisYear === 0 && rt.breachesThisYear === 0;
  rt.yearsCalm = calmYear ? rt.yearsCalm + 1 : 0;
  let p = rt.yearsCalm < Pe.calmAfterYears ? Pe.calm : Pe.calmLong;
  p += Math.max(Pe.destroyed * Pe.destroyedMax, rt.destroyedThisYear * Pe.destroyed);
  if (rt.thievesThisYear > 0) p += Pe.thieves;
  if (rt.riotsThisYear > 0) p += Pe.riot;
  if (rt.breachesThisYear > 0) p += Pe.breach;
  rt.peace = Math.max(0, Math.min(100, rt.peace + p));
  rt.destroyedThisYear = rt.thievesThisYear = rt.riotsThisYear = rt.breachesThisYear = rt.floodedHousesThisYear = rt.paddiesFloodedThisYear = 0;
}

export const dikeCountAtLeast = (s: GameState, h: number): number => s.buildings.filter((b) => isDike(b.type) && b.height >= h).length;
