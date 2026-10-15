// QoL: nhật ký sự kiện có vị trí — `at` là offset ô (−1 = không có chỗ) để UI có nút "tới chỗ đó" như Caesar 3.
import type { GameState } from './state';

export function logEvent(s: GameState, text: string, at = -1): void {
  s.events.push(text);
  s.eventAt.push(at);
}
