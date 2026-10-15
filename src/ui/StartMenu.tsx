// QoL: menu bắt đầu (như Caesar 3) — Chơi tiếp, Chuỗi màn, Chơi tự do, Nạp bản lưu. Hiện khi mở trang không có ?scenario / ?demo / ?stress / ?sandbox.
import { bridge, campaign, saves, savesOpen, startMenu } from './store';
import { SCENARIO_LIST } from '../sim/scenario/list';
import { openScenario } from './App';
import { MONTHS } from './format';

export function StartMenu() {
  if (!startMenu.value) return null;
  const latest = [...saves.value].sort((a, b) => b.savedAt - a.savedAt)[0];
  const won = campaign.value.won;
  const next = SCENARIO_LIST.find((d) => d.order !== undefined && !won.includes(d.key) && (d.order <= 1 || SCENARIO_LIST.some((p) => p.order === d.order! - 1 && won.includes(p.key)))) ?? SCENARIO_LIST[0];
  return (
    <div class="gameover start">
      <p class="muted">Caesar 3 trên đất Việt</p>
      <h2>Đại Việt</h2>
      <div class="menu">
        <button class="active" disabled={!latest} onClick={() => { if (latest) { startMenu.value = false; bridge.start('load', latest.slot); } }}>
          Chơi tiếp{latest ? <span class="muted"> — {latest.name}: {latest.scenario}, năm {latest.year + 1} tháng {MONTHS[latest.month]}</span> : <span class="muted"> — chưa có bản lưu</span>}
        </button>
        <button onClick={() => openScenario(next.key)}>
          Chuỗi màn<span class="muted"> — {won.length ? `tiếp màn ${next.order}: ${next.name}` : `bắt đầu màn 1: ${next.name}`}</span>
        </button>
        <button onClick={() => { startMenu.value = false; bridge.start('sandbox'); }}>
          Chơi tự do<span class="muted"> — bản đồ ngẫu nhiên, không mục tiêu (chọn hạt giống: sau)</span>
        </button>
        <button onClick={() => { bridge.listSaves(); savesOpen.value = true; }}>Nạp bản lưu…</button>
      </div>
      <p class="muted">Chuột phải kéo để dời bản đồ, lăn để zoom. F1: phím tắt và cài đặt. Trên điện thoại: một ngón dời, hai ngón zoom, giữ lâu rồi kéo để vẽ đường.</p>
    </div>
  );
}
