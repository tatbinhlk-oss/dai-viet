// Di cư theo lòng dân — city/migration.c + city/population.c của Julius.
// Lòng dân > 70: 12 người/ngày; 50–70: 6; 40–50: đứng yên; 20–40: 2 người/ngày bỏ đi; < 20: 6 người/ngày bỏ đi.
import { BuildingType, FigureType, type Building, type GameState } from '../state';
import { economy, HOUSE_LEVELS } from '../buildings/defs';
import { setHouseLevel } from '../buildings/spawn';
import { spawnEmigrants, spawnImmigrants } from '../figures/migrant';
import { gridOffset, inBounds } from '../map/grid';
import { bfs, passLand, UNREACHABLE } from '../map/routing';
import { nextInt } from '../rng';

const M = economy.migration;

export function migrationRate(sentiment: number): number {
  for (const [t, rate] of M.bands) if (sentiment > t) return rate;
  return M.bands[M.bands.length - 1][1];
}

/** Mỗi ngày (tick 4). */
export function updateMigration(s: GameState): void {
  const rate = migrationRate(s.sentiment);
  s.migrationQuota = Math.max(-20, Math.min(20, s.migrationQuota + rate));
  if (rate > 0 && s.migrationQuota >= M.groupMin) immigrate(s);
  else if (s.migrationQuota <= -M.groupMin) emigrate(s);
  if (rate === 0) s.migrationQuota = 0;
}

function immigrate(s: GameState): void {
  // dân đang trên đường tính như đã có chỗ, theo từng nhà
  let inFlight = 0;
  const reserved = new Map<number, number>();
  for (const f of s.figures) {
    if (f.type !== FigureType.Immigrant) continue;
    inFlight += f.loads;
    reserved.set(f.destBuildingId, (reserved.get(f.destBuildingId) ?? 0) + f.loads);
  }
  if (inFlight >= s.housingCapacity - s.population) { s.migrationQuota = Math.min(s.migrationQuota, M.groupMin); return; }
  const r = bfs(s.grid, s.entryOffset, passLand);
  let best: Building | null = null, bestRoom = 0;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House) continue;
    const room = HOUSE_LEVELS[Math.max(1, b.level)].capacity - b.population - (reserved.get(b.id) ?? 0);
    if (room <= bestRoom) continue;
    if (!adjacentReachable(r.dist, b.x, b.y)) continue;
    best = b; bestRoom = room;
  }
  if (!best) return;
  const count = Math.min(bestRoom, Math.floor(s.migrationQuota), M.groupMin + nextInt(s.rng, M.groupRandom));
  if (spawnImmigrants(s, best, count)) s.migrationQuota -= count;
}

function emigrate(s: GameState): void {
  let worst: Building | null = null;
  for (const b of s.buildings) {
    if (b.type !== BuildingType.House || b.population === 0) continue;
    if (!worst || b.happiness < worst.happiness) worst = b;
  }
  if (!worst) { s.migrationQuota = 0; return; }
  const n = Math.min(worst.population, Math.ceil(-s.migrationQuota));
  worst.population -= n;
  if (worst.population === 0) setHouseLevel(s, worst, 0);
  s.migrationQuota += n;
  spawnEmigrants(s, worst, n);
}

function adjacentReachable(dist: Uint16Array, x: number, y: number): boolean {
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(nx, ny) && dist[gridOffset(nx, ny)] !== UNREACHABLE) return true;
  }
  return false;
}
