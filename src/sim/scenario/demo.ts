// Thị trấn mẫu trên bản đồ phẳng: dùng cho test cổng M3 và cho chế độ xem thử ?demo=1.
// Bố cục vẽ bằng chữ để dễ sửa: mỗi ký tự một ô, chữ hoa = góc trên-trái công trình 2×2.
import { applyCommand } from '../commands';
import { BuildingType, isDike, LaborCat, type GameState } from '../state';
import { gridOffset } from '../map/grid';
import { raiseDike } from '../buildings/dike';
import { HOUSE_LEVELS } from '../buildings/defs';
import { setHouseLevel } from '../buildings/spawn';

const LEGEND: Record<string, string> = {
  '=': 'road', h: 'house', g: 'garden', p: 'lotusPond', w: 'well', b: 'brickWell', c: 'clinic', x: 'watchPost', k: 'builderPost',
  M: 'market', D: 'dinh', T: 'temple', S: 'school', E: 'theater', Y: 'yamen',
  R: 'paddy', V: 'vegGarden', P: 'pigSty', F: 'fishWharf', L: 'saltPan', C: 'clayPit', K: 'kiln',
  O: 'cottonField', Q: 'loom', H: 'teaHill', A: 'teaHouse', U: 'mulberryField', I: 'silkWorkshop',
  W: 'lumberCamp', N: 'copperMine', B: 'foundry', Z: 'ironMine', J: 'smithy', G: 'granary', X: 'warehouse',
};

/** Khu dân cư 38×8 trong vòng đường x=20..59, y=50..59. */
const HOMES = [
  'M.hhghhwhhgD.hhghhgT.hhwhhgM.hhghhxhhw', // y51
  '..whghhghhg..hhwhhg..hhghhg..hhwhhkhhg', // y52
  null, // y53 đường
  'hhwhhE.hhghhcghhwM.hhghhghhwS.hhghhchh', // y54
  'hhghh..hhwhhwhhgh..hhwhhghhg..hhwhhghh', // y55
  null, // y56 đường
  'M.hhgY.hhbhhghhxhD.hhghhbhhgE.hhgT.bhh', // y57
  '..hbh..hhghhkhhwh..hhwhhghhb..hhw..ghh', // y58
];

/**
 * M4: tuyến đê dọc cột `x` từ y0 tới y1 với cao trình `crest` (= cao độ ô + cao đê; bãi bồi cao độ 1, đê cao 3 → crest 4),
 * cộng đường chạy dọc chân đê ở cột x+1 để thợ cả tuần tra. Gọi lại được: đoạn đã có thì chỉ tôn cao cho đủ,
 * đoạn vỡ (ô đất trũng, thấp hơn 1) được vẽ lại với mục tiêu cao hơn 1 — như người chơi vẽ vá đê sau mùa lũ.
 */
export function planDikeLine(s: GameState, x: number, y0: number, y1: number, crest: number): void {
  for (let y = y0; y <= y1; y++) {
    const o = gridOffset(x, y);
    const want = Math.max(1, Math.min(4, crest - s.grid.elevation[o]));
    for (let guard = 0; guard < 4; guard++) {
      const b = s.buildings[s.grid.buildingId[o]];
      if (b && isDike(b.type) && b.targetHeight >= want) break;
      applyCommand(s, { type: 'build', kind: 'dike', x, y });
    }
    applyCommand(s, { type: 'build', kind: 'road', x: x + 1, y });
  }
}

/** Trạm giữ đê cách nhau 20 ô dọc đường chân đê (tránh các đường ngang y=66–84 của hai bố cục mẫu). */
export const DIKE_STATION_YS = [4, 24, 44, 60, 90, 110, 130, 150];

/** M4: đê có sẵn trong kịch bản (như đê Đỉnh Nhĩ thời Trần): đắp xong ngay, không cần phu đê. */
export function legacyDike(s: GameState, x: number, y0: number, y1: number, crest: number): void {
  planDikeLine(s, x, y0, y1, crest);
  for (const b of s.buildings) if (isDike(b.type) && b.x === x && b.y >= y0 && b.y <= y1) while (b.height < b.targetHeight) raiseDike(s, b);
}

/**
 * M4: trạm giữ đê cạnh đường chân đê: trại thợ + điếm canh + hai lều có sẵn dân phu + giếng.
 * Lều có dân để người mộ phu của trạm thấy nhà ngay (trạm xa thị trấn, dân nhập cư chọn nhà còn nhiều chỗ nên lều trống mãi).
 */
export function dikeStation(s: GameState, x: number, y: number): void {
  applyCommand(s, { type: 'build', kind: 'builderPost', x, y });
  applyCommand(s, { type: 'build', kind: 'watchPost', x, y: y + 1 });
  for (const dy of [3, 4]) seededHouse(s, x, y + dy);
  applyCommand(s, { type: 'build', kind: 'well', x, y: y + 5 });
}

function stamp(s: GameState, rows: (string | null)[], x0: number, y0: number): void {
  rows.forEach((row, dy) => {
    if (!row) return;
    for (let dx = 0; dx < row.length; dx++) {
      const kind = LEGEND[row[dx]];
      if (kind) applyCommand(s, { type: 'build', kind, x: x0 + dx, y: y0 + dy });
    }
  });
}

/** Dựng thị trấn mẫu ~130 nhà, 6 chuỗi xưởng, đủ dịch vụ tới nhà bậc 8; M4: tuyến đê x=7 cao 3 với 8 trạm giữ đê. */
export function buildTown(s: GameState): void {
  const road = (x: number, y: number) => applyCommand(s, { type: 'build', kind: 'road', x, y });
  // khung đường
  for (let x = 4; x <= 20; x++) road(x, 80); // từ cửa ngõ
  for (let y = 50; y <= 80; y++) road(20, y);
  for (const y of [50, 53, 56, 59]) for (let x = 20; x <= 59; x++) road(x, y);
  for (let y = 50; y <= 66; y++) road(59, y);
  for (const x of [30, 46]) for (let y = 60; y <= 65; y++) road(x, y); // nối khu dân cư với trục sản xuất
  for (let x = 4; x <= 104; x++) road(x, 66); // trục sản xuất
  for (let y = 60; y <= 84; y++) road(6, y); // đường ven sông ngoài đê (M4: kéo dài cho ruộng muối, ruộng lúa ngoài đê)
  stamp(s, HOMES, 21, 51);
  // xưởng và ruộng dọc trục y=66: phía bắc móng ở y=64 (3×3 ở y=63), phía nam ở y=67
  const place: [string, number, number][] = [
    // bắc trục, ven sông → thượng nguồn
    ['saltPan', 4, 64], ['vegGarden', 10, 64], ['vegGarden', 12, 64], ['pigSty', 14, 64], ['pigSty', 16, 64], ['vegGarden', 18, 64],
    ['granary', 21, 63], ['clayPit', 24, 64], ['clayPit', 26, 64], ['clayPit', 28, 64],
    ['kiln', 31, 64], ['kiln', 33, 64], ['kiln', 35, 64], ['kiln', 37, 64], ['warehouse', 39, 63],
    ['vegGarden', 42, 64], ['pigSty', 44, 64], ['granary', 47, 63], ['vegGarden', 50, 64], ['pigSty', 52, 64], ['vegGarden', 54, 64],
    ['watchPost', 56, 65], ['builderPost', 57, 65],
    // nam trục: bến cá, ruộng muối dọc đường x=6. M4: cả dải x=4–5 nằm ngoài đê, ngập mỗi năm lũ ≥ vừa
    // → thêm ruộng muối (bù 2–3 tháng ngừng) và ruộng lúa ngoài đê lấy phù sa (×1,5 năm sau)
    ['saltPan', 4, 60], ['saltPan', 4, 62],
    ['fishWharf', 4, 67], ['fishWharf', 4, 69], ['saltPan', 4, 71], ['saltPan', 4, 73],
    ['paddy', 4, 77], ['paddy', 4, 81], ['paddy', 4, 83],
    ['paddy', 10, 67], ['vegGarden', 12, 67], ['pigSty', 14, 67], ['paddy', 10, 70], ['paddy', 12, 70], ['paddy', 14, 70], ['vegGarden', 16, 70], ['pigSty', 18, 70],
    // đất cao x ≥ 70, núi x ≥ 100
    ['cottonField', 70, 64], ['teaHill', 72, 64], ['mulberryField', 74, 64], ['lumberCamp', 76, 64],
    ['loom', 78, 64], ['teaHouse', 80, 64], ['silkWorkshop', 82, 64], ['warehouse', 84, 63],
    ['foundry', 88, 64], ['smithy', 90, 64], ['copperMine', 100, 64], ['ironMine', 102, 64],
    // tuần đinh + thợ cả cho khu sản xuất
    ['watchPost', 16, 67], ['builderPost', 17, 67], ['watchPost', 32, 67], ['builderPost', 33, 67], ['watchPost', 40, 67], ['builderPost', 41, 67],
    ['watchPost', 80, 67], ['builderPost', 81, 67], ['watchPost', 98, 67], ['builderPost', 99, 67], ['watchPost', 5, 75], ['builderPost', 5, 76],
  ];
  for (let x = 8; x <= 20; x++) road(x, 69); // ruộng lúa, trại phía nam, kề đường chân đê, nối trục x=20
  for (const [kind, x, y] of place) applyCommand(s, { type: 'build', kind, x, y });
  // M4: đê dọc x=7 từ mép bắc tới mép nam. Thị trấn dựng sẵn 1.000 dân không kịp đắp 160 đoạn trước lũ năm 1,
  // nên kịch bản có đê cũ cao 3 (cao trình 4, chắn lũ lớn) và người chơi vẽ tôn lên cao 4 (cao trình 5) cho phu đê đắp:
  // đê cao hơn đỉnh lũ 1 mức thì nước không mòn đê; bằng đỉnh thì mòn 2/ngày, thợ cả phải qua đều.
  // Bến cá, ruộng muối ở x=4–5 nằm ngoài đê; đường chân đê x=8 với 8 trạm giữ đê.
  legacyDike(s, 7, 0, 159, 4);
  planDikeLine(s, 7, 0, 159, 5);
  for (const y of DIKE_STATION_YS) dikeStation(s, 9, y);
  // M5: bốn tín ngưỡng đủ đền (đình, chùa có sẵn): miếu Hà Bá ven sông, đàn tế ngoài đồng — không có thì thần quở
  road(5, 59); road(6, 59);
  for (const [kind, x, y] of [['shrine', 4, 79], ['shrine', 4, 59], ['altar', 19, 51], ['altar', 19, 57]] as [string, number, number][]) applyCommand(s, { type: 'build', kind, x, y });
}

/** Lều có sẵn dân (kịch bản) để trạm thợ / điếm canh xa thị trấn có nhân công ngay. */
export function seededHouse(s: GameState, x: number, y: number): void {
  const n = s.buildings.length;
  applyCommand(s, { type: 'build', kind: 'house', x, y });
  const h = s.buildings[n];
  if (h && h.type === BuildingType.House) { h.population = HOUSE_LEVELS[1].capacity; setHouseLevel(s, h, 1); }
}

/**
 * M5: thị trấn mẫu cho màn Sơn Nam — thêm trường học và thủy đình cho Văn hiến, khoa cử và nhà quan lại;
 * xóm thợ mỏ cạnh điếm canh / trại thợ khu mỏ để mỏ không sập (binh dịch cần vũ khí từ lò rèn).
 */
export function buildCourtTown(s: GameState): void {
  buildTown(s);
  for (const [kind, x, y] of [['academy', 60, 57], ['puppetStage', 60, 54]] as [string, number, number][]) applyCommand(s, { type: 'build', kind, x, y });
  // M6a: bến cảng ven sông (thuyền buôn), trại lính cạnh trục x=59 (vũ khí từ lò rèn)
  for (let y = 85; y <= 88; y++) applyCommand(s, { type: 'build', kind: 'road', x: 6, y });
  applyCommand(s, { type: 'build', kind: 'port', x: 4, y: 86 });
  applyCommand(s, { type: 'build', kind: 'barracks', x: 60, y: 60 });
  seededHouse(s, 96, 67); seededHouse(s, 97, 67);
  applyCommand(s, { type: 'build', kind: 'well', x: 96, y: 68 });
}

/** Ưu tiên lao động người chơi thường đặt: tuần đinh, lương thực, thợ cả. */
export function demoPriorities(s: GameState): void {
  applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Watch, priority: 1 });
  applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Food, priority: 2 });
  applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Engineering, priority: 3 });
}

/**
 * M6c: thị trấn thử tải cho mục tiêu hiệu năng (1.500 công trình, 800 walker) — xếp dải phố trên đất cao x ≥ 72 của bản đồ phẳng:
 * hàng đường, hai hàng lều có dân sẵn, cứ ba ô một dịch vụ 1×1 có walker (điếm canh, trại thợ, giếng gạch, nhà thuốc).
 * Dùng cho test hiệu năng và ?stress=1.
 */
export function buildStressTown(s: GameState, targetBuildings = 1500): void {
  const saved = s.treasury;
  s.treasury = 1e9;
  const services = ['watchPost', 'builderPost', 'brickWell', 'clinic'];
  let k = 0;
  const count = () => s.buildings.filter((b) => b.type !== BuildingType.None).length;
  for (let y0 = 72; y0 + 2 < 158 && count() < targetBuildings; y0 += 3) {
    for (let x = 72; x <= 156; x++) applyCommand(s, { type: 'build', kind: 'road', x, y: y0 });
    for (const y of [y0 + 1, y0 + 2]) {
      for (let x = 72; x <= 156; x++) {
        if (x % 3 === 0) applyCommand(s, { type: 'build', kind: services[k++ % services.length], x, y });
        else seededHouse(s, x, y);
      }
    }
  }
  for (let y = 72; y < 158; y++) applyCommand(s, { type: 'build', kind: 'road', x: 71, y }); // nối các dải với trục sản xuất y=66
  for (let y = 67; y <= 72; y++) applyCommand(s, { type: 'build', kind: 'road', x: 71, y });
  s.treasury = saved;
}
