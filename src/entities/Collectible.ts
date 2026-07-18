export class Collectible {
  active = false;
  x = 0;
  y = 0;
  z = 0;
  previousZ = 0;
  spin = 0;
  value = 1;
  rare = false;
  capturing = false;
  captureElapsed = 0;
  captureDuration = 0;
  captureStartX = 0;
  captureStartY = 0;
  captureStartZ = 0;
  captureVelocityZ = 0;

  get routeProtected(): boolean {
    return this.active && !this.capturing;
  }

  readonly routeHalfDepth = 0.35;

  activate(x: number, y: number, z: number, rare: boolean): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.z = z;
    this.previousZ = z;
    this.spin = 0;
    this.rare = rare;
    this.value = rare ? 5 : 1;
    this.capturing = false;
    this.captureElapsed = 0;
    this.captureDuration = 0;
    this.captureStartX = 0;
    this.captureStartY = 0;
    this.captureStartZ = 0;
    this.captureVelocityZ = 0;
  }

  reset(): void {
    this.active = false;
    this.capturing = false;
    this.captureElapsed = 0;
    this.captureDuration = 0;
    this.captureStartX = 0;
    this.captureStartY = 0;
    this.captureStartZ = 0;
    this.captureVelocityZ = 0;
  }
}
