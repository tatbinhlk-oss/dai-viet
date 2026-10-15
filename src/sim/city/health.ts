// Sức khỏe (chỉ số phụ) — thiết kế phần 7: nhà khỏe = có thầy lang + lương thực; tiến ±2 mỗi tháng về tỉ lệ nhà khỏe.
// Dịch khi < 40 và rand(64) ≤ 40 − health (+15 trong 2 tháng sau khi có giếng ngập) hoặc Phật quở lớn: một nhà mất nửa dân.
import { BuildingType, type GameState } from '../state';
import { gridOffset } from '../map/grid';
import { logEvent } from '../log';
import { court } from '../buildings/defs';
import { foodTypes } from '../buildings/house';
import { setHouseLevel } from '../buildings/spawn';
import { nextInt } from '../rng';

const H = court.health;

/** Mỗi tháng (ngày 1). */
export function updateHealth(s: GameState): void {
  const rt = s.ratings;
  let n = 0, ok = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    n++;
    if (b.clinic > 0 && foodTypes(b) > 0) ok++;
  }
  let target = n ? Math.round((ok * 100) / n) : H.start;
  if (s.worship.healthBonusMonths > 0) target += court.worship.blessing.healthBonus;
  target = Math.min(100, target);
  if (rt.health < target) rt.health = Math.min(target, rt.health + H.step);
  else if (rt.health > target) rt.health = Math.max(target, rt.health - H.step);
  if (rt.floodedWellMonths > 0) rt.floodedWellMonths--;

  let plague = rt.plaguePending;
  rt.plaguePending = false;
  if (!plague && rt.health < H.plagueBelow) {
    const chance = H.plagueBelow - rt.health + (rt.floodedWellMonths > 0 ? H.floodedWellBonus : 0);
    if (nextInt(s.rng, H.plagueDie) <= chance) plague = true;
  }
  if (plague) outbreak(s);
}

function outbreak(s: GameState): void {
  const houses = s.buildings.filter((b) => b.type === BuildingType.House && b.population > 0);
  if (!houses.length) return;
  const h = houses[nextInt(s.rng, houses.length)];
  const lost = Math.ceil((h.population * H.plagueLossPct) / 100);
  h.population -= lost;
  if (h.population === 0) setHouseLevel(s, h, 0);
  logEvent(s, `Dịch bệnh: ${lost} người chết ở một nhà`, gridOffset(h.x, h.y));
}
