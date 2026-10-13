// Tài chính — city/finance.c + city/tax.c của Julius. Thu thuế và trả lương mỗi tháng (ngày 0).
// Thuế chỉ thu ở nhà có lại thu thuế đi qua trong 50 ngày gần nhất: dân × hệ số thuế bậc nhà × thuế suất.
import { BuildingType, emptyLedger, type GameState } from '../state';
import { economy, HOUSE_LEVELS } from '../buildings/defs';

export function monthlyTaxBase(s: GameState): { covered: number; uncovered: number } {
  let covered = 0, uncovered = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    const v = b.population * HOUSE_LEVELS[b.level].tax;
    if (b.taxCoverage > 0) covered += v; else uncovered += v;
  }
  return { covered, uncovered };
}

export const monthlyWages = (s: GameState): number => Math.floor((s.labor.employed * economy.wagePer10WorkersPerYear) / 10 / 12);

/** Ngày 0 mỗi tháng (tick 0). Sang năm mới thì chốt sổ năm cũ. */
export function updateFinance(s: GameState): void {
  if (s.time.month === 0 && s.time.totalDays > 0) {
    s.lastYear = s.thisYear;
    s.thisYear = emptyLedger();
  }
  const taxes = Math.floor((monthlyTaxBase(s).covered * s.taxRate) / 100);
  const wages = monthlyWages(s);
  s.treasury += taxes - wages;
  s.thisYear.taxes += taxes;
  s.thisYear.wages += wages;
}
