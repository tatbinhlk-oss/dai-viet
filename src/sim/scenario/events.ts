// Sự kiện kịch bản (thiết kế phần 5/6): "Thượng nguồn mưa lớn" ép mực lũ +1 năm đó; "Hà đê sứ đến thanh tra"
// kiểm tra độ bền đê; "Triều đình lệnh đắp đê" thành chiếu chỉ loại đê (N đoạn cao 2 trong 24 tháng, Ân sủng +10).
import { BuildingType, Resource, type GameState } from '../state';
import { flood } from '../buildings/defs';
import { dikeInspection, scheduleEdict } from '../city/court';
import { nextInt } from '../rng';

export type ScenarioEventKind = 'rain' | 'inspector' | 'dikeOrder';

export interface ScenarioEvent { year: number; month: number; kind: ScenarioEventKind; done: boolean }

const list = new WeakMap<GameState, ScenarioEvent[]>();
export const scenarioEvents = (s: GameState): ScenarioEvent[] => { let l = list.get(s); if (!l) { l = []; list.set(s, l); } return l; };

export function addScenarioEvent(s: GameState, year: number, kind: ScenarioEventKind, month?: number, amount?: number, height?: number): void {
  if (kind === 'dikeOrder') {
    scheduleEdict(s, { type: 'dike', year, month, resource: Resource.None, building: BuildingType.None, amount: amount ?? 50, height: height ?? 2, deadlineMonths: 24, reward: 10 });
    return;
  }
  // mưa lớn báo ở tháng 4 (lúc quay đỉnh lũ); hà đê sứ tới tháng ngẫu nhiên 2–9
  const m = month ?? (kind === 'rain' ? flood.season.forecastMonth : 2 + nextInt(s.rng, 8));
  scenarioEvents(s).push({ year, month: m, kind, done: false });
}

/** Mỗi ngày (tick 27, sau lũ tick 26 đã quay đỉnh ở tháng 4). */
export function updateScenarioEvents(s: GameState): void {
  if (s.time.day !== 0) return;
  for (const ev of scenarioEvents(s)) {
    if (ev.done || s.time.year !== ev.year - 1 || s.time.month !== ev.month - 1) continue;
    ev.done = true;
    if (ev.kind === 'rain') {
      const F = s.flood;
      if (F.nextPeak > 0) F.nextPeak = Math.min(flood.peakChances.byLevel.length, F.nextPeak + 1);
      else s.worship.floodLevelMod += 1;
      s.events.push('Thượng nguồn mưa lớn: lũ năm nay dữ hơn một mức');
    } else if (ev.kind === 'inspector') {
      dikeInspection(s);
    }
  }
  // Thủy thần / mưa lớn để dành: áp vào đỉnh vừa quay (tháng 4)
  if (s.worship.floodLevelMod !== 0 && s.flood.nextPeak > 0) {
    s.flood.nextPeak = Math.max(1, Math.min(flood.peakChances.byLevel.length, s.flood.nextPeak + s.worship.floodLevelMod));
    s.worship.floodLevelMod = 0;
  }
}
