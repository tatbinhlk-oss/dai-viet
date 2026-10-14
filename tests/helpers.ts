// Người chơi tự động dùng chung cho cổng M5 (Sơn Nam) và M6b (Làng ven sông). Không phải file test.
import { applyCommand } from '../src/sim';
import { planDikeLine } from '../src/sim/scenario/demo';
import { Resource, type GameState } from '../src/sim/state';
import { ROUTES } from '../src/sim/city/trade';
import { festivalCost } from '../src/sim/city/worship';
import { giftCost } from '../src/sim/city/court';

/** Người chơi tự động: mỗi tháng xem nha môn và tín ngưỡng, mỗi năm vá đê; M6a: mở tuyến buôn, bán hàng dư. */
export function autoPlayer(s: GameState): void {
  if (s.time.day === 0 && s.time.month === 0) planDikeLine(s, 7, 0, 159, 5);
  if (s.time.day !== 0) return;
  if (s.taxRate < 11) applyCommand(s, { type: 'setTax', rate: 11 }); // Tết, cống nạp, bổng lộc cần thêm thuế; 9–11% cùng mức lòng dân −1 (economy.json)
  for (const e of s.court.edicts) {
    if (e.state !== 'active') continue;
    if (e.type === 'corvee' && e.corveePct === 0) applyCommand(s, { type: 'dispatchEdict', id: e.id, option: 1 });
    else if (e.type === 'goods' || e.type === 'money' || e.type === 'troops') applyCommand(s, { type: 'dispatchEdict', id: e.id });
  }
  s.worship.gods.forEach((g, d) => {
    if (g.mood < 45 && g.monthsSinceFestival >= 3 && s.treasury > festivalCost(s, 0) + 300) applyCommand(s, { type: 'holdFestival', deity: d, size: 0 });
  });
  if (s.court.personalFunds >= giftCost(s, 1) && s.court.giftsInWindow.length < 2 && s.court.favor < s.scenario.goals.favor) applyCommand(s, { type: 'sendGift', size: 1 });
  // M6a: mở tuyến buôn khi đủ tiền, bán hàng xưởng dư (lụa, trà, vải)
  s.trade.routes.forEach((r, i) => { if (!r.open && s.time.year >= 1 + i && s.treasury > ROUTES[i].openCost + 500) applyCommand(s, { type: 'openRoute', route: i }); });
  for (const r of [Resource.Silk, Resource.Tea, Resource.Cloth]) if (s.trade.orders[r] !== 2) applyCommand(s, { type: 'setTradeOrder', resource: r, order: 2 });
}
