import { TopBar } from './TopBar';
import { BuildBar } from './BuildBar';
import { InfoPanel } from './InfoPanel';
import { Advisors } from './Advisors';
import { campaign, hoverText, ui } from './store';
import { SCENARIOS } from '../sim/scenario/list';

/** M6b: mở màn khác (nạp lại trang với ?scenario=; phẩm hàm chuỗi màn lấy từ localStorage). */
export function openScenario(key: string): void {
  const p = new URLSearchParams(location.search);
  p.delete('demo'); p.delete('rank'); p.delete('look');
  if (key) p.set('scenario', key); else p.delete('scenario');
  location.search = p.toString();
}

const OVER_TEXT = { won: 'Đạt mọi mục tiêu! Triều đình thăng phẩm hàm.', dismissed: 'Ân sủng cạn: triều đình đã cử quan khác đến thay.', timeout: 'Hết hạn mà chưa đạt mục tiêu.' } as const;

export function App() {
  return (
    <>
      <div class="bars">
        <TopBar />
        <BuildBar />
      </div>
      <InfoPanel />
      <Advisors />
      {ui.value?.city.scenario.gameOver && (
        <div class="gameover">
          <strong>{ui.value.city.scenario.gameOver === 'won' ? 'Thắng' : 'Thua'}</strong> — {OVER_TEXT[ui.value.city.scenario.gameOver]}
          {ui.value.city.scenario.gameOver === 'won' && <> Phẩm hàm mới: <em>{ui.value.city.court.rankName}</em>.</>}
          <div class="actions">
            {ui.value.city.scenario.gameOver === 'won' && ui.value.city.scenario.next && SCENARIOS[ui.value.city.scenario.next] && (
              <button onClick={() => openScenario(ui.value!.city.scenario.next)}>Màn kế: {SCENARIOS[ui.value.city.scenario.next].name} ▶</button>
            )}
            {ui.value.city.scenario.gameOver !== 'won' && <button onClick={() => openScenario(ui.value!.city.scenario.key)}>Chơi lại màn</button>}
            <span class="muted">{ui.value.city.scenario.gameOver === 'won' ? `Phẩm hàm chuỗi màn: ${campaign.value.rank}` : 'Hoặc chơi tiếp bằng nút ▶.'}</span>
          </div>
        </div>
      )}
      <div class="status">{hoverText.value}</div>
    </>
  );
}
