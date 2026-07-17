export class ScoreSystem {
  score = 0;
  distance = 0;
  coins = 0;

  update(delta: number, speed: number, multiplier: number): void {
    const travelled = speed * delta;
    this.distance += travelled;
    this.score += travelled * 11 * multiplier;
  }

  collect(value: number, multiplier: number): void {
    this.coins += value;
    this.score += value * 35 * multiplier;
  }

  reset(): void {
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
  }
}
