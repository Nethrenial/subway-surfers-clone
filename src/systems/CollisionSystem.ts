import type { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';

export class CollisionSystem {
  findPlayerHit(player: Player, obstacles: readonly Obstacle[]): Obstacle | null {
    const playerMinZ = player.position.z - player.halfDepth;
    const playerMaxZ = player.position.z + player.halfDepth;

    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      const currentZ = obstacle.worldZ();
      const sweptMinZ = Math.min(obstacle.previousWorldZ, currentZ) - obstacle.halfDepth;
      const sweptMaxZ = Math.max(obstacle.previousWorldZ, currentZ) + obstacle.halfDepth;
      if (sweptMaxZ < playerMinZ || sweptMinZ > playerMaxZ) continue;
      if (Math.abs(obstacle.group.position.x - player.position.x) > obstacle.halfWidth + player.halfWidth) continue;
      if (player.colliderMaxY <= obstacle.minY || player.colliderMinY >= obstacle.maxY) continue;
      return obstacle;
    }
    return null;
  }
}
