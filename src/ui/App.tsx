import { TopBar } from './TopBar';
import { BuildBar } from './BuildBar';
import { InfoPanel } from './InfoPanel';
import { Advisors } from './Advisors';
import { hoverText, ui } from './store';

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
        <div class="gameover"><strong>{ui.value.city.scenario.gameOver === 'won' ? 'Thắng' : 'Thua'}</strong> — {OVER_TEXT[ui.value.city.scenario.gameOver]} Có thể chơi tiếp bằng nút ▶.</div>
      )}
      <div class="status">{hoverText.value}</div>
    </>
  );
}
