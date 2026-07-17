export class Collectible {
  active = false;
  x = 0;
  y = 0;
  z = 0;
  previousZ = 0;
  spin = 0;
  value = 1;
  rare = false;

  activate(x: number, y: number, z: number, rare: boolean): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.z = z;
    this.previousZ = z;
    this.spin = 0;
    this.rare = rare;
    this.value = rare ? 5 : 1;
  }

  reset(): void {
    this.active = false;
  }
}
