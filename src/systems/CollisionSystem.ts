import type { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';

export class CollisionSystem {
  findPlayerHit(player: Player, obstacles: readonly Obstacle[]): Obstacle | null {
    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      const currentZ = obstacle.worldZ();
      const zOverlap = overlapInterval(
        obstacle.previousWorldZ - player.position.z,
        currentZ - player.position.z,
        obstacle.halfDepth + player.halfDepth,
      );
      if (!zOverlap) continue;
      const xOverlap = overlapInterval(
        obstacle.previousWorldX - player.previousX,
        obstacle.worldX() - player.position.x,
        obstacle.halfWidth + player.halfWidth,
      );
      if (!xOverlap) continue;
      const yOverlap = boxOverlapInterval(
        player.previousColliderMinY,
        player.previousColliderMaxY,
        player.colliderMinY,
        player.colliderMaxY,
        obstacle.minY,
        obstacle.maxY,
      );
      if (!yOverlap) continue;
      const overlapStart = Math.max(zOverlap[0], xOverlap[0], yOverlap[0]);
      const overlapEnd = Math.min(zOverlap[1], xOverlap[1], yOverlap[1]);
      if (overlapStart > overlapEnd) continue;
      return obstacle;
    }
    return null;
  }
}

function overlapInterval(start: number, end: number, radius: number): readonly [number, number] | null {
  const velocity = end - start;
  if (Math.abs(velocity) < 1e-9) return Math.abs(start) <= radius ? [0, 1] : null;
  const first = (-radius - start) / velocity;
  const second = (radius - start) / velocity;
  const enter = Math.max(0, Math.min(first, second));
  const exit = Math.min(1, Math.max(first, second));
  return enter <= exit ? [enter, exit] : null;
}

function boxOverlapInterval(
  minStart: number,
  maxStart: number,
  minEnd: number,
  maxEnd: number,
  obstacleMin: number,
  obstacleMax: number,
): readonly [number, number] | null {
  const aboveObstacleMin = greaterThanInterval(maxStart - obstacleMin, maxEnd - obstacleMin);
  const belowObstacleMax = greaterThanInterval(obstacleMax - minStart, obstacleMax - minEnd);
  if (!aboveObstacleMin || !belowObstacleMax) return null;
  const start = Math.max(aboveObstacleMin[0], belowObstacleMax[0]);
  const end = Math.min(aboveObstacleMin[1], belowObstacleMax[1]);
  return start <= end ? [start, end] : null;
}

function greaterThanInterval(start: number, end: number): readonly [number, number] | null {
  if (start > 0 && end > 0) return [0, 1];
  if (start <= 0 && end <= 0) return null;
  const crossing = -start / (end - start);
  return end > start ? [crossing, 1] : [0, crossing];
}
