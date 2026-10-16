// M6c: câu thoại walker khi người chơi bấm vào (như Caesar 3): đang chở gì, đi đâu, vì sao đứng chờ.
import { BuildingType, Deity, FigureMode, FigureType, isMilitaryBase, isSoldier, Resource, type Figure, type GameState } from '../state';
import { BUILDING_DEFS, RESOURCES } from '../buildings/defs';
import { ROUTES } from '../city/trade';
import { DEITY_NAMES } from '../city/worship';

export const FIGURE_NAMES: Record<number, string> = {
  [FigureType.DinhRoamer]: 'Lý trưởng', [FigureType.MarketTrader]: 'Bà bán chợ', [FigureType.MarketBuyer]: 'Người gánh chợ', [FigureType.CartPusher]: 'Xe bò',
  [FigureType.Immigrant]: 'Dân đến ở', [FigureType.Emigrant]: 'Dân bỏ đi', [FigureType.LaborSeeker]: 'Người mộ phu', [FigureType.Monk]: 'Sư', [FigureType.Teacher]: 'Thầy đồ',
  [FigureType.Healer]: 'Thầy lang', [FigureType.WellKeeper]: 'Người gánh nước', [FigureType.Actor]: 'Phường chèo', [FigureType.Watchman]: 'Tuần đinh', [FigureType.Builder]: 'Thợ cả',
  [FigureType.TaxCollector]: 'Lại thu thuế', [FigureType.Warehouseman]: 'Phu kho', [FigureType.Protester]: 'Dân kêu oan', [FigureType.Thief]: 'Kẻ trộm', [FigureType.Rioter]: 'Loạn dân',
  [FigureType.LevyWorker]: 'Phu đê', [FigureType.Boat]: 'Thuyền nan', [FigureType.Messenger]: 'Sứ giả triều đình', [FigureType.Convoy]: 'Đoàn xe cống nạp', [FigureType.Soldiers]: 'Đinh tráng',
  [FigureType.TempleKeeper]: 'Ông từ', [FigureType.Academic]: 'Thầy giáo', [FigureType.Puppeteer]: 'Phường rối nước', [FigureType.Mandarin]: 'Quan đi kiệu', [FigureType.Caravan]: 'Đoàn buôn',
  [FigureType.TradeShip]: 'Thuyền buôn', [FigureType.Enemy]: 'Giặc', [FigureType.Militia]: 'Lính', [FigureType.CourtTroops]: 'Quân triều đình',
  [FigureType.Archer]: 'Cung thủ', [FigureType.Elephant]: 'Voi trận', [FigureType.Corpse]: 'Xác',
};

export interface FigureInfo { id: number; name: string; text: string; x: number; y: number; /** M8: quân thuộc đội của trại (id, tên, ô trại) */ squad: { buildingId: number; name: string; x: number; y: number } | null }

const resName = (r: Resource): string => RESOURCES[r]?.name ?? 'hàng';
const bName = (s: GameState, id: number): string => {
  const b = s.buildings[id];
  if (!b || b.type === BuildingType.None) return '';
  return b.type === BuildingType.House ? 'nhà' : BUILDING_DEFS[b.type].name.toLowerCase();
};
const cargoText = (f: Figure): string => {
  if (f.cargo.length) {
    const parts = f.cargo.map((u, r) => (u > 0 ? `${u} ${resName(r as Resource)}` : '')).filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return f.loads > 0 && f.resource !== Resource.None ? `${f.loads} kiện ${resName(f.resource)}` : '';
};

/** Tìm walker đứng tại ô (x, y) (ô hiện tại hoặc ô đang bước tới); không có → null. */
export function figureAt(s: GameState, x: number, y: number): Figure | null {
  let best: Figure | null = null;
  for (const f of s.figures) {
    if (f.type === FigureType.None) continue;
    if (f.x === x && f.y === y) return f;
    if (!best && f.nx === x && f.ny === y) best = f;
  }
  return best;
}

export function figureDialogue(s: GameState, f: Figure): FigureInfo {
  const name = FIGURE_NAMES[f.type] ?? 'Người';
  const home = bName(s, f.buildingId), dest = bName(s, f.destBuildingId);
  const cargo = cargoText(f);
  const waiting = f.waitTicks > 0;
  let text: string;
  switch (f.type) {
    case FigureType.CartPusher:
    case FigureType.Warehouseman:
    case FigureType.Boat:
      text = cargo ? (f.returning ? `Tôi đem ${cargo} về ${home || 'xưởng'}.` : `Tôi chở ${cargo} tới ${dest || 'kho'}.`)
        : waiting ? `Tôi đứng chờ ở ${home || 'xưởng'}: chưa có chỗ nhận hàng, kho đầy hay không có đường.`
        : f.returning ? `Giao xong, tôi về ${home || 'xưởng'}.` : `Tôi đi lấy hàng ở ${dest || 'kho'}.`;
      break;
    case FigureType.MarketBuyer:
      text = cargo ? `Tôi gánh ${cargo} về chợ.` : `Tôi đi ${dest || 'vựa'} lấy hàng cho chợ.`;
      break;
    case FigureType.MarketTrader:
      text = f.mode === FigureMode.Roam ? 'Tôi đi quanh xóm bán gạo, cá, rau và hàng của chợ cho từng nhà.' : 'Tôi về chợ lấy thêm hàng.';
      break;
    case FigureType.Immigrant:
      text = `Chúng tôi ${f.loads} người đến ở nhà mới. Nghe nói ${s.sentiment >= 60 ? 'làng này dễ sống' : 'ở đây có việc làm'}.`;
      break;
    case FigureType.Emigrant:
      text = `Chúng tôi ${f.loads} người bỏ làng đi vì ${s.lowMoodCause === 'tax' ? 'thuế nặng' : s.lowMoodCause === 'food' ? 'đói' : s.lowMoodCause === 'unemployment' ? 'không có việc' : s.lowMoodCause === 'flood' ? 'nhà ngập' : 'sống khổ'}.`;
      break;
    case FigureType.LaborSeeker:
      text = s.labor.unemploymentPct > 10 ? 'Tôi đi tìm người làm cho xưởng; ngoài kia còn nhiều người rỗi việc.' : 'Tôi đi mộ phu cho xưởng nhưng xóm nào cũng thiếu người.';
      break;
    case FigureType.Watchman:
      text = 'Tôi đi tuần, nhắc nhà nào cũng coi chừng lửa và bắt kẻ gian.';
      break;
    case FigureType.Builder:
      text = s.flood.dayInSeason >= 0 ? 'Mùa lũ, tôi đi xem từng đoạn đê, chỗ nào yếu thì vá.' : 'Tôi đi xem nhà cửa, đê điều, chỗ nào hỏng thì sửa.';
      break;
    case FigureType.TaxCollector:
      text = `Tôi thu thuế ${s.taxRate}% cho nha môn.`;
      break;
    case FigureType.Protester:
      text = 'Dân chúng tôi kêu oan vì sống khổ quá; quan hãy xem lại thuế, lương thực, việc làm.';
      break;
    case FigureType.Thief:
      text = 'Suỵt… đói thì phải liều.';
      break;
    case FigureType.Rioter:
      text = 'Đốt hết! Quan trên không lo cho dân thì dân tự lo!';
      break;
    case FigureType.LevyWorker:
      text = f.route === -2 ? (f.returning ? 'Hết phiên lao dịch, chúng tôi về đình.' : `Đình cử chúng tôi (${f.loads || 20} người) đi lao dịch cho triều đình.`)
        : waiting ? 'Phu đê chúng tôi chờ đất đắp.' : f.returning ? 'Đắp xong đoạn đê, chúng tôi về đình.' : `Đình làng cử chúng tôi (${f.loads || 20} người) đi đắp đê.`;
      break;
    case FigureType.Messenger:
      text = 'Có chiếu chỉ! Tôi đem tới nha môn.';
      break;
    case FigureType.Convoy:
      text = 'Đoàn xe đem cống phẩm về kinh.';
      break;
    case FigureType.Soldiers:
      text = 'Đinh tráng lên đường theo lệnh vua; mong ngày về.';
      break;
    case FigureType.Mandarin:
      text = 'Quan đi kiệu qua, phố xá thêm phần sang.';
      break;
    case FigureType.Caravan:
    case FigureType.TradeShip: {
      const r = ROUTES[f.route];
      text = f.returning ? `Mua bán xong, ${f.type === FigureType.Caravan ? 'đoàn' : 'thuyền'} về ${r?.name ?? 'xứ'}.` : `${f.type === FigureType.Caravan ? 'Đoàn buôn' : 'Thuyền buôn'} ${r?.name ?? ''} tới ${dest || (f.type === FigureType.Caravan ? 'kho' : 'bến cảng')} mua bán theo lệnh của quan.`;
      break;
    }
    case FigureType.Enemy:
      text = waiting ? 'Đốt! Đốt sạch!' : f.returning ? 'Rút! Lần sau sẽ quay lại.' : `Giặc đi tới ${dest || 'công trình gần nhất'} để cướp phá.`;
      break;
    case FigureType.CourtTroops:
      text = waiting ? 'Nha môn đây rồi. Quan huyện, hãy giao ấn!' : 'Phụng mệnh triều đình tới cách chức quan huyện. Ai cản thì chém.';
      break;
    case FigureType.Militia:
      text = waiting ? 'Giết! Giữ lấy đất này!' : f.hp < 50 ? 'Tôi bị thương nhưng còn giữ được chỗ gác.' : s.buildings[f.buildingId]?.post >= 0 ? 'Lính đứng gác theo lệnh quan, giặc vào tầm là đánh.' : 'Lính trại đây, giặc tới là đánh.';
      break;
    case FigureType.Archer:
      text = waiting ? 'Giương cung! Bắn!' : f.hp < 40 ? 'Cung thủ bị áp sát thì khó, xin cho lính giáo che.' : 'Cung thủ đây, giặc trong ba ô là bắn.';
      break;
    case FigureType.Elephant:
      text = waiting ? 'Voi gầm, giặc bạt vía!' : 'Voi trận đi tuần, chậm mà chắc. Một voi chọi bốn.';
      break;
    case FigureType.Corpse:
      text = [ 'Một lính nằm lại nơi đây.', 'Xác giặc, sẽ được dọn.', 'Một cung thủ nằm lại nơi đây.', 'Xác quân triều đình.', 'Voi trận ngã xuống.' ][f.route] ?? 'Xác.';
      break;
    case FigureType.TempleKeeper: {
      const b = s.buildings[f.buildingId];
      text = b?.type === BuildingType.VanMieu ? 'Ông từ Văn Miếu đi khắp phố nhắc dân trọng chữ nghĩa, thờ thánh hiền.'
        : `Ông từ đi khắp xóm nhắc dân thờ ${b?.type === BuildingType.Shrine ? DEITY_NAMES[Deity.ThuyThan] : b?.type === BuildingType.Altar ? DEITY_NAMES[Deity.TienNong] : DEITY_NAMES[Deity.ThanhHoang]}.`;
      break;
    }
    default:
      text = f.mode === FigureMode.Roam ? `${name} từ ${home || 'công trình'} đi quanh xóm, còn ${Math.max(0, f.maxRoamLength - f.roamLength)} bước nữa thì về.` : f.returning ? `${name} về ${home || 'công trình'}.` : `${name} đi tới ${dest || 'nơi cần đến'}.`;
  }
  const hb = s.buildings[f.buildingId];
  const squad = isSoldier(f.type) && hb && isMilitaryBase(hb.type) ? { buildingId: hb.id, name: BUILDING_DEFS[hb.type].name, x: hb.x, y: hb.y } : null;
  return { id: f.id, name, text, x: f.x, y: f.y, squad };
}
