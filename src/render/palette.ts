// Bảng màu và chiều cao khối placeholder — dùng chung cho render (vẽ dự phòng khi thiếu frame) và scripts/gen-placeholders.ts
// (sinh PNG tạm). Không import Pixi để script Node dùng được.
import { BuildingType } from '../sim/state';

export const COLOR = {
  grass: [0x6f8f3a, 0x76963f, 0x6a8a37, 0x7a9a44, 0x80a04a], // theo elevation 0..4
  floodplain: 0x8fa85a,
  water: 0x3b6e9c,
  road: 0xb89a62,
  roadEdge: 0x8a7046,
  bridge: 0x9a7a4a, // M7: cầu gỗ (ván) trên ô sông
  bridgeEdge: 0x5a3a1a,
  floor: 0x55503a, // nền móng công trình
  tree: 0x3f6a2a,
  flooded: 0x4f82b0, // nước lũ phủ lên ô
  sunken: 0x7a7448, // đất trũng
  overlayUnprotected: 0x5aa0d8,
  overlayProtected: 0x6fcf7a,
  reserved: 0x202018, // M6b: đất triều đình chưa cấp (phủ tối)
  dike: [0x8a7a52, 0x6e6040, 0xa89a6a] as [number, number, number],
  dikePlanned: [0x5a5a50, 0x4a4a40, 0x707068] as [number, number, number],
  sluiceGate: 0x3b6e9c,
};

/** màu khối: [mặt trái, mặt phải, mái]. Nhà theo bậc 0..10. */
export const HOUSE_COLORS: [number, number, number][] = [
  [0x8a8a7a, 0x6e6e60, 0xa8a898], // lều trống: xám
  [0x9c6b3c, 0x7d5530, 0xc9a06a], // lều tranh
  [0xa0743f, 0x80592f, 0xd8b06a], // nhà tranh vách đất
  [0xa66a3a, 0x85522c, 0xc98a4a], // nhà tranh
  [0x8f5a2a, 0x70451f, 0xb08050], // nhà gỗ lợp lá
  [0xb0553a, 0x8a3f2a, 0x9a4632], // nhà gỗ lợp ngói
  [0xc8b89a, 0xa89878, 0x8a3a2a], // nhà ba gian: tường vôi, ngói
  [0xd8c8a8, 0xb8a888, 0x7a2e22], // nhà ngói năm gian
  [0xe0d0b0, 0xc0b090, 0x6a2a20], // nhà phố
  [0xe8dcc0, 0xc8bca0, 0x4a2a20], // tư dinh
  [0xf0e4c8, 0xd0c4a8, 0x3a2418], // phủ đệ
];
const C = (l: number, r: number, t: number): [number, number, number] => [l, r, t];
export const TYPE_COLORS: Partial<Record<BuildingType, [number, number, number]>> = {
  [BuildingType.Paddy]: C(0x5f8f3a, 0x4f7a2e, 0x9bc45a),
  [BuildingType.VegGarden]: C(0x5a8a3a, 0x4a7430, 0x7fbf4a),
  [BuildingType.PigSty]: C(0x8a6a4a, 0x6e543a, 0xc89a8a),
  [BuildingType.FishWharf]: C(0x7a6a50, 0x5e523e, 0x8ab0c0),
  [BuildingType.Granary]: C(0xb59a5a, 0x8f7a45, 0xd9c080),
  [BuildingType.Warehouse]: C(0x9a8060, 0x7a6448, 0x6a5a4a),
  [BuildingType.Market]: C(0xc08a4a, 0x9a6b35, 0xe8c070),
  [BuildingType.ClayPit]: C(0xa0603a, 0x80502e, 0xc07848),
  [BuildingType.CottonField]: C(0x8aa060, 0x70844c, 0xe8e8e0),
  [BuildingType.TeaHill]: C(0x4a7a3a, 0x3a642e, 0x5a9a48),
  [BuildingType.MulberryField]: C(0x5a7a40, 0x4a6434, 0x7a9a50),
  [BuildingType.CopperMine]: C(0x7a6a5a, 0x5e5246, 0xb87a4a),
  [BuildingType.IronMine]: C(0x6a6a6a, 0x505050, 0x8a8a90),
  [BuildingType.SaltPan]: C(0x9aa0a8, 0x7a8088, 0xf0f0f0),
  [BuildingType.LumberCamp]: C(0x7a5a3a, 0x5e4630, 0x4a6a30),
  [BuildingType.Kiln]: C(0xa05a3a, 0x80462e, 0x5a3a2a),
  [BuildingType.Loom]: C(0x9a7a5a, 0x7a6048, 0xc8b8a0),
  [BuildingType.TeaHouse]: C(0x8a7050, 0x6e5a40, 0x6a8a4a),
  [BuildingType.SilkWorkshop]: C(0xa08a6a, 0x806e54, 0xd8b84a),
  [BuildingType.Foundry]: C(0x6a5040, 0x523e32, 0xb87a3a),
  [BuildingType.Smithy]: C(0x5a5050, 0x443c3c, 0x7a7a80),
  [BuildingType.Well]: C(0x777777, 0x555555, 0x4aa0d0),
  [BuildingType.BrickWell]: C(0xa05a40, 0x804632, 0x4aa0d0),
  [BuildingType.Dinh]: C(0x8a4a3a, 0x6a3428, 0x5a3a2a),
  [BuildingType.Temple]: C(0xc8a060, 0xa0804a, 0x6a3020),
  [BuildingType.School]: C(0xb8a080, 0x988064, 0x5a4030),
  [BuildingType.Clinic]: C(0xb0b090, 0x909074, 0x4a7a5a),
  [BuildingType.Theater]: C(0xa03a3a, 0x80302e, 0xd8a040),
  [BuildingType.WatchPost]: C(0x6a5a4a, 0x52463a, 0xa03a2a),
  [BuildingType.BuilderPost]: C(0x7a6a5a, 0x5e5246, 0x4a6a8a),
  [BuildingType.Yamen]: C(0xa04040, 0x803434, 0x3a2a2a),
  [BuildingType.Garden]: C(0x4a7a30, 0x3a6428, 0x5aa040),
  [BuildingType.LotusPond]: C(0x4a7a90, 0x3a6474, 0x70b0a0),
  [BuildingType.Ruins]: C(0x3a3430, 0x2a2420, 0x4a3a30),
  [BuildingType.Dock]: C(0x7a5a3a, 0x5e4630, 0x9a7a4a),
  [BuildingType.Academy]: C(0xc8b090, 0xa89070, 0x6a3a2a),
  [BuildingType.QuocTuGiam]: C(0xd8c090, 0xb09868, 0x8a2a2a),
  [BuildingType.PuppetStage]: C(0x6a8aa0, 0x506a80, 0xa03a3a),
  [BuildingType.Shrine]: C(0x9a5a4a, 0x7a4638, 0x3a6a8a),
  [BuildingType.Altar]: C(0xa08a5a, 0x806e48, 0xd8b870),
  [BuildingType.VanMieu]: C(0xd8c0a0, 0xb8a080, 0x8a2a2a),
  [BuildingType.Port]: C(0x6a5a40, 0x4e4230, 0x9aa8b0),
  [BuildingType.Barracks]: C(0x7a3a3a, 0x5e2e2e, 0x4a3a2a),
  [BuildingType.EarthWall]: C(0x8a7a52, 0x6e6040, 0x9a8a62),
  [BuildingType.StoneWall]: C(0x8a8a8a, 0x6a6a6a, 0xa0a0a0),
  [BuildingType.Gate]: C(0x7a5a3a, 0x5e4428, 0xa0a0a0), // M7: cổng thành — gỗ, nóc đá
};
export const FLAT = new Set<BuildingType>([BuildingType.Paddy, BuildingType.VegGarden, BuildingType.CottonField, BuildingType.TeaHill, BuildingType.MulberryField, BuildingType.SaltPan, BuildingType.ClayPit, BuildingType.Garden, BuildingType.LotusPond, BuildingType.Ruins, BuildingType.Altar]);
const HEIGHT_BY_SIZE = [0, 10, 18, 26];
/** Chiều cao khối (px) theo loại, kích thước móng và bậc nhà. */
export function typeHeight(t: BuildingType, size: number, level: number): number {
  if (t === BuildingType.House) return Math.round((10 + Math.min(level & 15, 10) * 1.5) * (1 + (size - 1) * 0.5));
  if (t === BuildingType.EarthWall) return 14;
  if (t === BuildingType.StoneWall) return 20;
  if (t === BuildingType.Gate) return 24;
  if (FLAT.has(t)) return t === BuildingType.Garden ? 6 : 2;
  if (t === BuildingType.Well || t === BuildingType.BrickWell) return 8;
  return HEIGHT_BY_SIZE[size] ?? 20;
}
export const blockColors = (t: BuildingType, level: number): [number, number, number] =>
  t === BuildingType.House ? HOUSE_COLORS[level] ?? HOUSE_COLORS[0] : TYPE_COLORS[t] ?? HOUSE_COLORS[0];
/** Chiều cao đê (px) theo mức cao 0–4. */
export const dikeHeightPx = (h: number): number => (h === 0 ? 3 : 4 + h * 5);

// màu áo walker và màu kiện hàng theo Resource
export const FIG_COLOR: Record<number, number> = {
  1: 0xf0e0a0, 2: 0xe07050, 3: 0xd0a040, 4: 0x6a4a2a, 5: 0x80c0e0, 6: 0x8090a0, 7: 0xb0b0b0, 8: 0xe8a030, 9: 0x4a6aa0, 10: 0x5aa070,
  11: 0x60a0d0, 12: 0xd04080, 13: 0xc03020, 14: 0x3a5a9a, 15: 0x202020, 16: 0x8a6a4a, 17: 0xe0e040, 18: 0x402040, 19: 0xff2010,
  20: 0xc8a060, 21: 0x8a6a3a, 22: 0xf0c030, 23: 0x8a7a5a, 24: 0xa02020, 25: 0xd8d0c0, 26: 0x3050a0, 27: 0x30a0a0, 28: 0xe0a000,
  29: 0xb08050, 30: 0x5a7a9a, 31: 0x301010, 32: 0xc02020, 33: 0xe0b020, 34: 0x806020, 35: 0x6a6a70, 36: 0x4a3a30,
};
export const RES_COLOR = [0, 0xf0f0d8, 0x80a8c0, 0x60b040, 0xd08080, 0xa06040, 0xc07040, 0xffffff, 0xf0f0f0, 0x6080c0, 0x4a8a30, 0x8a6a30, 0xf0e8c0, 0xe8c840, 0xb87040, 0xc89040, 0x707078, 0x9090a0, 0x8a5a2a];
