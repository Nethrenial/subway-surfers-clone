import type { Obstacle } from '../entities/Obstacle';

export interface ProtectedRouteItem {
  active: boolean;
  readonly routeProtected?: boolean;
  readonly routeHalfDepth?: number;
  x: number;
  z: number;
}

export function findClearLane(
  preferredLane: number,
  nearZ: number,
  farZ: number,
  obstacles: readonly Obstacle[],
): number | null {
  for (let offset = 0; offset < 3; offset += 1) {
    const lane = (preferredLane + offset) % 3;
    if (isLaneRangeClear(lane, nearZ, farZ, obstacles)) return lane;
  }
  return null;
}

export function isLaneRangeClear(
  lane: number,
  nearZ: number,
  farZ: number,
  obstacles: readonly Obstacle[],
): boolean {
  const minZ = Math.min(nearZ, farZ);
  const maxZ = Math.max(nearZ, farZ);
  return !obstacles.some((obstacle) => {
    if (!obstacle.active || !obstacle.occupiedLanes.includes(lane)) return false;
    if (obstacle.type === 'train') return true;
    const margin = 3;
    const z = obstacle.worldZ();
    return z + obstacle.halfDepth + margin >= minZ && z - obstacle.halfDepth - margin <= maxZ;
  });
}
