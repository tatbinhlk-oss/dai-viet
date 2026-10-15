// QoL: hướng dẫn màn đầu (Làng ven sông) — các bước tự đánh dấu xong theo trạng thái thành phố, hiện ở Tổng quan và màn nhiệm vụ.
import { BuildingType, type GameState } from '../state';
import { SCENARIOS } from './list';
import { T_ROAD } from '../map/grid';

export interface TutorialStep { text: string; done: boolean }

export function tutorialSteps(s: GameState): TutorialStep[] {
  const def = SCENARIOS[s.scenario.key];
  if (!def || def.order !== 1) return [];
  const count = (t: BuildingType, pred?: (b: GameState['buildings'][number]) => boolean) => s.buildings.filter((b) => b.type === t && (!pred || pred(b))).length;
  let roads = 0;
  for (let i = 0; i < s.grid.terrain.length; i++) if (s.grid.terrain[i] & T_ROAD) roads++;
  const houses = count(BuildingType.House);
  const peopled = count(BuildingType.House, (b) => b.population > 0);
  return [
    { text: 'Vẽ đường (kéo chuột) — mọi công trình cần kề đường, dân đi theo đường', done: roads >= 10 },
    { text: 'Đặt lều ven đường (kéo vùng) — dân nhập cư sẽ tới ở', done: houses >= 5 },
    { text: 'Đào giếng gần nhà để nhà lên bậc', done: count(BuildingType.Well) + count(BuildingType.BrickWell) >= 1 },
    { text: 'Dựng đình làng: lý trưởng đi dạo, đình cử phu đắp đê', done: count(BuildingType.Dinh) >= 1 },
    { text: 'Ruộng lúa / vườn rau + vựa + chợ: lương thực tới từng nhà', done: count(BuildingType.Paddy) + count(BuildingType.VegGarden) >= 1 && count(BuildingType.Granary) >= 1 && count(BuildingType.Market) >= 1 },
    { text: 'Điếm canh và trại thợ: tuần đinh chống cháy, thợ cả chống sập và vá đê', done: count(BuildingType.WatchPost) >= 1 && count(BuildingType.BuilderPost) >= 1 },
    { text: 'Vẽ đê (Đê điều) che bãi bồi trước tháng Sáu — lũ về mỗi năm', done: count(BuildingType.Dike) >= 20 },
    { text: 'Chùa và nha môn: Phật phù hộ, nha môn nhận chiếu chỉ và thu thuế', done: count(BuildingType.Temple) >= 1 && count(BuildingType.Yamen) >= 1 },
    { text: 'Dân tới ở và nhà lên bậc — xem Tổng quan để biết thiếu gì', done: peopled >= 10 && s.buildings.some((b) => b.type === BuildingType.House && b.level >= 2) },
  ];
}
