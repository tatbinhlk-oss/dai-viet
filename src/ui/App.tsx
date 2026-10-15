import { TopBar } from './TopBar';
import { BuildBar } from './BuildBar';
import { InfoPanel } from './InfoPanel';
import { Advisors } from './Advisors';
import { SavesPanel } from './SavesPanel';
import { bridge, briefing, campaign, hoverText, ui } from './store';
import { num } from './format';
import { SCENARIOS } from '../sim/scenario/list';

/** M6b: mở màn khác (nạp lại trang với ?scenario=; phẩm hàm chuỗi màn lấy từ localStorage). */
export function openScenario(key: string): void {
  const p = new URLSearchParams(location.search);
  p.delete('demo'); p.delete('rank'); p.delete('look');
  if (key) p.set('scenario', key); else p.delete('scenario');
  location.search = p.toString();
}

const OVER_TEXT = { won: 'Đạt mọi mục tiêu! Triều đình thăng phẩm hàm.', dismissed: 'Ân sủng cạn: triều đình đã cử quan khác đến thay.', timeout: 'Hết hạn mà chưa đạt mục tiêu.' } as const;

/** QoL: màn giới thiệu nhiệm vụ (mission briefing của Caesar 3) — mở lúc vào màn (sim dừng) và từ nút Nhiệm vụ. */
function Briefing() {
  const s = ui.value!;
  const sc = s.city.scenario;
  const def = SCENARIOS[sc.key];
  const start = () => { briefing.value = false; if (s.speed === 0) bridge.cmd({ type: 'setSpeed', speed: 1 }); };
  const rows: [string, number, number][] = [['Dân', sc.current.population, sc.goals.population], ['Văn hiến', sc.current.culture, sc.goals.culture], ['Thịnh vượng', sc.current.prosperity, sc.goals.prosperity], ['Trị an', sc.current.peace, sc.goals.peace], ['Ân sủng', sc.current.favor, sc.goals.favor]];
  return (
    <div class="gameover briefing">
      <p class="muted">Chiếu chỉ triều đình</p>
      <h2>{sc.name}</h2>
      <p>Phẩm hàm: <em>{s.city.court.rankName}</em>{sc.king ? <> · {sc.kingText}</> : ''}</p>
      {def?.description && <p class="desc">{def.description}</p>}
      <table class="mini">
        <thead><tr><th>Mục tiêu</th><th>Hiện</th><th>Cần</th></tr></thead>
        <tbody>{rows.map(([n, cur, goal]) => <tr class={cur >= goal ? 'ok' : ''}><td>{n}</td><td>{num(cur)}</td><td>{num(goal)}</td></tr>)}</tbody>
      </table>
      {s.city.tutorial.length > 0 && (
        <>
          <p><strong>Các bước cho người mới</strong></p>
          <ul class="tutorial">{s.city.tutorial.map((st) => <li class={st.done ? 'done' : ''}>{st.done ? '☑' : '☐'} {st.text}</li>)}</ul>
        </>
      )}
      {sc.timeLimitYears > 0 && <p class="muted">Phải xong trong {sc.timeLimitYears} năm{s.time.totalDays > 0 ? ` · đang năm ${s.time.year + 1}` : ''}. Chiếu chỉ sẽ tới theo năm; lũ về tháng Sáu.</p>}
      <div class="actions"><button class="active" onClick={start}>{s.time.totalDays > 0 ? 'Tiếp tục' : 'Bắt đầu'}</button></div>
    </div>
  );
}

export function App() {
  return (
    <>
      <div class="bars">
        <TopBar />
        <BuildBar />
      </div>
      <InfoPanel />
      <Advisors />
      <SavesPanel />
      {briefing.value && ui.value && ui.value.city.scenario.key !== 'sandbox' && <Briefing />}
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
