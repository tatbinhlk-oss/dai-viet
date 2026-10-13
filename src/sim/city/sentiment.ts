// Lòng dân — city/sentiment.c của Julius, bỏ "lương so với Rome". Cập nhật ngày 0 và 8 mỗi tháng.
// Mỗi nhà cộng dồn điểm từ thuế, thất nghiệp, tỉ lệ lều (chung cả thành) và lương thực (riêng nhà),
// kéo dần về điểm nghỉ 60 nên một nguyên nhân xấu kéo dài làm lòng dân tụt tới mức cân bằng, không tụt mãi.
// Tội phạm: mỗi tháng nhà bất mãn nhất sinh dân kêu oan (<50), trộm (<30) hoặc loạn dân (≤10).
import { BuildingType, FigureType, type GameState, type MoodCause } from '../state';
import { court, economy, flood } from '../buildings/defs';
import { foodTypes } from '../buildings/house';
import { roadAccess } from '../buildings/spawn';
import { createFigure } from '../figures/figure';
import { startRoam } from '../figures/movement';

const S = economy.sentiment;

export function taxContribution(rate: number): number {
  return S.taxByRate[Math.max(0, Math.min(S.taxByRate.length - 1, Math.round(rate)))];
}

export function unemploymentContribution(pct: number): number {
  for (const [limit, v] of S.unemployment) if (pct <= limit) return v;
  return S.unemployment[S.unemployment.length - 1][1];
}

/** Ngày 0 và 8 (tick 22). */
export function updateSentiment(s: GameState): void {
  const taxC = taxContribution(s.taxRate);
  const unC = unemploymentContribution(s.labor.unemploymentPct);
  let tentPop = 0;
  for (const b of s.buildings) if (b.type === BuildingType.House && b.level <= 1) tentPop += b.population;
  const tentC = s.population >= S.tentMinPopulation && (tentPop * 100) / s.population > S.tentShareBad ? S.tentPenalty : 0;
  // M4: vỡ đê → −3 mỗi kỳ trong 3 tháng cho cả thành
  const breachC = s.flood.breachMoodPeriods > 0 ? flood.consequences.moodPenalty : 0;
  if (s.flood.breachMoodPeriods > 0) s.flood.breachMoodPeriods--;
  // M5: lao dịch theo chiếu chỉ quá 20% nhân công → −1 mỗi kỳ
  const corveeC = s.labor.workforce > 0 && (s.court.corveeWorkers * 100) / s.labor.workforce > court.corvee.moodAbovePct ? court.corvee.moodPenalty : 0;
  const cityDelta = taxC + unC + tentC + breachC + corveeC;

  let sum = 0, pop = 0, foodSum = 0, floodSum = 0, houses = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    let foodC = 0;
    const types = foodTypes(b);
    if (types === 0 && b.level >= 3) { b.hungryPeriods++; foodC = -Math.min(b.hungryPeriods, 4); }
    else { b.hungryPeriods = 0; foodC = types >= 2 ? S.foodTwoTypes : S.foodOneType; }
    // cộng dồn như Julius, cộng thêm lực kéo về điểm nghỉ để có cân bằng thay vì trôi hẳn về 0 hoặc 100:
    // ở trạng thái dừng, lòng dân ≈ điểm nghỉ + pullDivisor × (tổng điểm mỗi kỳ)
    // M4: nhà bị ngập −3 mỗi kỳ trong 3 tháng
    let floodC = 0;
    if (b.floodMoodPeriods > 0) { b.floodMoodPeriods--; floodC = flood.consequences.moodPenalty; }
    const delta = cityDelta + foodC + floodC;
    const pull = Math.round((S.restingPoint - b.happiness) / S.pullDivisor);
    b.happiness = Math.max(0, Math.min(100, b.happiness + delta + pull));
    sum += b.happiness * b.population;
    pop += b.population;
    foodSum += foodC;
    floodSum += floodC;
    houses++;
  }
  if (pop > 0) s.sentiment = Math.round(sum / pop);

  // nguyên nhân âm lớn nhất
  const causes: [MoodCause, number][] = [['tax', taxC], ['unemployment', unC], ['tents', tentC], ['food', houses ? foodSum / houses : 0], ['flood', breachC + (houses ? floodSum / houses : 0)], ['corvee', corveeC]];
  let worst: MoodCause = 'none', worstV = 0;
  for (const [c, v] of causes) if (v < worstV) { worst = c; worstV = v; }
  s.lowMoodCause = worst;
}

/** Ngày 0 mỗi tháng (tick 23): nhà bất mãn nhất sinh tội phạm. */
export function generateCriminals(s: GameState): void {
  const C = economy.crime;
  let worst: GameState['buildings'][number] | null = null;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    if (!worst || b.happiness < worst.happiness) worst = b;
  }
  if (!worst || worst.happiness >= C.protestBelow) return;
  const door = roadAccess(s.grid, worst);
  if (door < 0) return;
  const type = worst.happiness <= C.riotAtOrBelow ? FigureType.Rioter : worst.happiness < C.thiefBelow ? FigureType.Thief : FigureType.Protester;
  const f = createFigure(s, type, door, worst.id);
  if (!f) return;
  startRoam(f, 48);
  if (type === FigureType.Thief) s.ratings.thievesThisYear++; else if (type === FigureType.Rioter) s.ratings.riotsThisYear++; // M5: Trị an
  s.events.push(type === FigureType.Rioter ? 'Loạn dân nổi lên!' : type === FigureType.Thief ? 'Có trộm trong thành' : 'Dân kêu oan trước nha môn');
}

export const MOOD_CAUSE_TEXT: Record<MoodCause, string> = {
  none: '—', tax: 'thuế cao', unemployment: 'thất nghiệp', food: 'thiếu ăn', tents: 'quá nhiều lều', flood: 'lũ lụt', corvee: 'lao dịch',
};
