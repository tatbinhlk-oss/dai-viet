import { RESOURCES, type TerrainRule } from '../sim/buildings/defs';

export const MONTHS = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Một', 'Chạp'];
export const GROUPS: [string, string][] = [
  ['home', 'Nhà ở'], ['farm', 'Nông nghiệp'], ['raw', 'Nguyên liệu'], ['workshop', 'Xưởng'],
  ['store', 'Kho & chợ'], ['service', 'Dịch vụ'], ['admin', 'Quản trị'], ['dike', 'Đê điều'], ['military', 'Quân sự'], ['decor', 'Cảnh quan'],
];
export const TERRAIN_HINT: Record<TerrainRule, string> = {
  any: '', floodplain: 'chỉ trên bãi bồi ven sông', highland: 'chỉ trên đất cao (không phải bãi bồi)', mountain: 'chỉ trên núi', shore: 'phải kề sông', land: 'mọi ô đất, kể cả lên đường (dốc qua đê)',
};
export const resName = (r: number) => RESOURCES[r]?.name ?? '?';
export const loads = (units: number) => (units / 100).toFixed(units % 100 ? 1 : 0);
export const num = (n: number) => n.toLocaleString('vi-VN');
