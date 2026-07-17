import type { ObstacleType } from '../entities/Obstacle';
import type { SeededRandom } from '../utils/random';

export interface HazardPlacement {
  lane: number;
  z: number;
  type: ObstacleType;
  motionAmplitude?: number;
  blockedLanes?: readonly number[];
}

export function createSegmentPattern(generation: number, rng: SeededRandom): HazardPlacement[] {
  if (generation < 2) return [];
  const placements: HazardPlacement[] = [];
  addRow(placements, generation, -1.8, rng);
  if (generation > 4 && rng() < Math.min(0.78, 0.34 + generation * 0.018)) {
    addRow(placements, generation, 3.45, rng);
  }
  return placements.slice(0, 4);
}

export function isPatternSafe(pattern: readonly HazardPlacement[]): boolean {
  const rows = new Map<number, Set<number>>();
  for (const placement of pattern) {
    const row = Math.round(placement.z * 10);
    const blocked = rows.get(row) ?? new Set<number>();
    for (const lane of placement.blockedLanes ?? [placement.lane]) blocked.add(lane);
    rows.set(row, blocked);
  }
  for (const blocked of rows.values()) if (blocked.size >= 3) return false;
  return true;
}

function addRow(target: HazardPlacement[], generation: number, z: number, rng: SeededRandom): void {
  const safeLane = Math.floor(rng() * 3);
  const blocked = [0, 1, 2].filter((lane) => lane !== safeLane);

  if (generation > 6 && safeLane !== 1 && rng() < 0.22) {
    const startLane = safeLane === 0 ? 2 : 0;
    const targetLane = 1;
    target.push({
      lane: startLane,
      z,
      type: 'drone',
      motionAmplitude: (targetLane - startLane) * 2.35,
      blockedLanes: [startLane, targetLane],
    });
    return;
  }

  const primaryType = chooseType(generation, rng);
  target.push({ lane: blocked[0], z, type: primaryType });
  const densityChance = Math.min(0.8, 0.22 + generation * 0.032);
  if (rng() < densityChance) {
    const secondaryType: ObstacleType = generation > 8 && rng() < 0.2 ? 'train' : chooseType(generation, rng);
    target.push({ lane: blocked[1], z, type: secondaryType });
  }
}

function chooseType(generation: number, rng: SeededRandom): ObstacleType {
  const roll = rng();
  if (generation > 7 && roll < 0.15) return 'train';
  if (roll < 0.43) return 'hurdle';
  if (roll < 0.74) return 'gate';
  return 'barrier';
}
