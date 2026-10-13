// Thị trấn mẫu trên bản đồ phẳng: dùng cho test cổng M3 và cho chế độ xem thử ?demo=1.
// Bố cục vẽ bằng chữ để dễ sửa: mỗi ký tự một ô, chữ hoa = góc trên-trái công trình 2×2.
import { applyCommand } from '../commands';
import { LaborCat, type GameState } from '../state';

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

function stamp(s: GameState, rows: (string | null)[], x0: number, y0: number): void {
  rows.forEach((row, dy) => {
    if (!row) return;
    for (let dx = 0; dx < row.length; dx++) {
      const kind = LEGEND[row[dx]];
      if (kind) applyCommand(s, { type: 'build', kind, x: x0 + dx, y: y0 + dy });
    }
  });
}

/** Dựng thị trấn mẫu ~130 nhà, 6 chuỗi xưởng, đủ dịch vụ tới nhà bậc 8. */
export function buildTown(s: GameState): void {
  const road = (x: number, y: number) => applyCommand(s, { type: 'build', kind: 'road', x, y });
  // khung đường
  for (let x = 4; x <= 20; x++) road(x, 80); // từ cửa ngõ
  for (let y = 50; y <= 80; y++) road(20, y);
  for (const y of [50, 53, 56, 59]) for (let x = 20; x <= 59; x++) road(x, y);
  for (let y = 50; y <= 66; y++) road(59, y);
  for (const x of [30, 46]) for (let y = 60; y <= 65; y++) road(x, y); // nối khu dân cư với trục sản xuất
  for (let x = 4; x <= 104; x++) road(x, 66); // trục sản xuất
  for (let y = 66; y <= 76; y++) road(6, y);
  stamp(s, HOMES, 21, 51);
  // xưởng và ruộng dọc trục y=66: phía bắc móng ở y=64 (3×3 ở y=63), phía nam ở y=67
  const place: [string, number, number][] = [
    // bắc trục, ven sông → thượng nguồn
    ['saltPan', 4, 64], ['paddy', 8, 64], ['vegGarden', 10, 64], ['vegGarden', 12, 64], ['pigSty', 14, 64], ['pigSty', 16, 64], ['vegGarden', 18, 64],
    ['granary', 21, 63], ['clayPit', 24, 64], ['clayPit', 26, 64], ['clayPit', 28, 64],
    ['kiln', 31, 64], ['kiln', 33, 64], ['kiln', 35, 64], ['kiln', 37, 64], ['warehouse', 39, 63],
    ['vegGarden', 42, 64], ['pigSty', 44, 64], ['granary', 47, 63], ['vegGarden', 50, 64], ['pigSty', 52, 64], ['vegGarden', 54, 64],
    ['watchPost', 56, 65], ['builderPost', 57, 65],
    // nam trục: bến cá, ruộng muối dọc đường x=6
    ['fishWharf', 4, 67], ['fishWharf', 4, 69], ['saltPan', 4, 71], ['saltPan', 4, 73],
    ['paddy', 8, 67], ['paddy', 10, 67], ['vegGarden', 12, 67],
    // đất cao x ≥ 70, núi x ≥ 100
    ['cottonField', 70, 64], ['teaHill', 72, 64], ['mulberryField', 74, 64], ['lumberCamp', 76, 64],
    ['loom', 78, 64], ['teaHouse', 80, 64], ['silkWorkshop', 82, 64], ['warehouse', 84, 63],
    ['foundry', 88, 64], ['smithy', 90, 64], ['copperMine', 100, 64], ['ironMine', 102, 64],
    // tuần đinh + thợ cả cho khu sản xuất
    ['watchPost', 16, 67], ['builderPost', 17, 67], ['watchPost', 32, 67], ['builderPost', 33, 67], ['watchPost', 40, 67], ['builderPost', 41, 67],
    ['watchPost', 80, 67], ['builderPost', 81, 67], ['watchPost', 98, 67], ['builderPost', 99, 67], ['watchPost', 7, 70], ['builderPost', 7, 72],
  ];
  for (const [kind, x, y] of place) applyCommand(s, { type: 'build', kind, x, y });
}

/** Ưu tiên lao động người chơi thường đặt: tuần đinh, lương thực, thợ cả. */
export function demoPriorities(s: GameState): void {
  applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Watch, priority: 1 });
  applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Food, priority: 2 });
  applyCommand(s, { type: 'setLaborPriority', category: LaborCat.Engineering, priority: 3 });
}
