import type { ObstacleType } from '../entities/Obstacle';
import { PLAYER_HALF_DEPTH } from '../entities/Player';
import type { SeededRandom } from '../utils/random';

export interface HazardPlacement {
  lane: number;
  z: number;
  type: ObstacleType;
  motionAmplitude?: number;
  blockedLanes?: readonly number[];
}

export function createSegmentPattern(
  generation: number,
  rng: SeededRandom,
  safeLane = 1,
  reservedLanes: readonly number[] = [],
): HazardPlacement[] {
  if (generation < 2 || isRecoveryGeneration(generation)) return [];
  const placements: HazardPlacement[] = [];
  const firstRowZ = -2.45 + rng() * 1.3;
  addRow(placements, generation, firstRowZ, rng, safeLane);
  const protectedLanes = [...reservedLanes];
  if (reservedLanes.includes(safeLane)) {
    const alternateSafeLane = [safeLane - 1, safeLane + 1, 0, 1, 2]
      .find((lane) => lane >= 0 && lane <= 2 && !reservedLanes.includes(lane));
    if (alternateSafeLane !== undefined) protectedLanes.push(alternateSafeLane);
  }
  return placements.slice(0, 2).filter((placement) => (
    !(placement.blockedLanes ?? [placement.lane]).some((lane) => protectedLanes.includes(lane))
  ));
}

export function isRecoveryGeneration(generation: number): boolean {
  return generation >= 5 && generation % 5 === 0;
}

export function chooseNextSafeLane(currentLane: number, rng: SeededRandom): number {
  if (currentLane === 0) return 1;
  if (currentLane === 2) return 1;
  return rng() < 0.5 ? 0 : 2;
}

export function isPatternSafe(pattern: readonly HazardPlacement[]): boolean {
  const intervals = pattern.map((placement) => {
    const obstacleHalfDepth = placement.type === 'train' ? 2.7 : placement.type === 'drone' ? 0.72 : 0.4;
    const halfDepth = obstacleHalfDepth + PLAYER_HALF_DEPTH;
    return {
      min: placement.z - halfDepth,
      max: placement.z + halfDepth,
      lanes: placement.blockedLanes ?? [placement.lane],
    };
  });
  const boundaries = intervals.flatMap((interval) => [interval.min, interval.max]);
  const samples = [...boundaries];
  boundaries.sort((a, b) => a - b);
  for (let index = 1; index < boundaries.length; index += 1) {
    samples.push((boundaries[index - 1] + boundaries[index]) * 0.5);
  }
  for (const z of samples) {
    const blocked = new Set<number>();
    for (const interval of intervals) {
      if (z < interval.min || z > interval.max) continue;
      for (const lane of interval.lanes) blocked.add(lane);
    }
    if (blocked.size >= 3) return false;
  }
  return true;
}

function addRow(
  target: HazardPlacement[],
  generation: number,
  z: number,
  rng: SeededRandom,
  requestedSafeLane?: number,
): number {
  const safeLane = requestedSafeLane ?? Math.floor(rng() * 3);
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
    return safeLane;
  }

  const primaryType = chooseType(generation, rng);
  target.push({ lane: blocked[0], z, type: primaryType });
  const densityChance = Math.min(0.8, 0.22 + generation * 0.032);
  if (rng() < densityChance) {
    const secondaryType: ObstacleType = generation > 8 && rng() < 0.2 ? 'train' : chooseType(generation, rng);
    target.push({ lane: blocked[1], z, type: secondaryType });
  }
  return safeLane;
}

function chooseType(generation: number, rng: SeededRandom): ObstacleType {
  const roll = rng();
  if (generation > 7 && roll < 0.15) return 'train';
  if (roll < 0.43) return 'hurdle';
  if (roll < 0.74) return 'gate';
  return 'barrier';
}
