// Di cư — city/population.c + figuretype/migrant.c rút gọn: có chỗ trống thì dân đến.
// M3 thêm sentiment (đến nhanh/chậm, bỏ đi khi bất mãn).
import { BuildingType, FigureType, type GameState } from '../state';
import { HOUSE_LEVELS, MIGRANT_GROUP_MIN, MIGRANT_GROUP_RANDOM, MIGRATION_INTERVAL_DAYS } from '../buildings/defs';
import { spawnImmigrants } from '../figures/behaviors';
import { gridOffset, inBounds } from '../map/grid';
import { bfs, passLand, UNREACHABLE } from '../map/routing';
import { nextInt } from '../rng';

/** Mỗi ngày (tick 4). */
export function updateMigration(s: GameState): void {
  if (s.migrationCooldown > 0) { s.migrationCooldown--; return; }
  if (s.housingCapacity <= s.population) return;
  // dân đang trên đường tính như đã có chỗ, theo từng nhà
  let inFlight = 0;
  const reserved = new Map<number, number>();
  for (const f of s.figures) {
    if (f.type !== FigureType.Immigrant) continue;
    inFlight += f.loads;
    reserved.set(f.destBuildingId, (reserved.get(f.destBuildingId) ?? 0) + f.loads);
  }
  if (inFlight >= s.housingCapacity - s.population) return;
  // một BFS từ cửa ngõ trên đất; nhà tới được nếu có ô kề đi được
  const r = bfs(s.grid, s.entryOffset, passLand);
  let best: GameState['buildings'][number] | null = null, bestRoom = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House) continue;
    const room = HOUSE_LEVELS[Math.max(1, b.level)].capacity - b.population - (reserved.get(b.id) ?? 0);
    if (room <= bestRoom) continue;
    if (!adjacentReachable(r.dist, b.x, b.y)) continue;
    best = b; bestRoom = room;
  }
  if (!best) return;
  const count = Math.min(bestRoom, MIGRANT_GROUP_MIN + nextInt(s.rng, MIGRANT_GROUP_RANDOM));
  if (spawnImmigrants(s, best, count)) s.migrationCooldown = MIGRATION_INTERVAL_DAYS;
}

function adjacentReachable(dist: Uint16Array, x: number, y: number): boolean {
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(nx, ny) && dist[gridOffset(nx, ny)] !== UNREACHABLE) return true;
  }
  return false;
}
