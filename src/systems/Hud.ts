export type UiState = 'running' | 'paused' | 'game-over';

export class Hud {
  private readonly score = this.getElement('#score-value');
  private readonly distance = this.getElement('#distance-value');
  private readonly speed = this.getElement('#speed-value');
  private readonly finalScore = this.getElement('#final-score-value');
  private readonly finalDistance = this.getElement('#final-distance-value');
  private readonly pauseOverlay = this.getElement('#pause-overlay');
  private readonly gameOverOverlay = this.getElement('#game-over-overlay');
  private readonly tutorial = this.getElement('#tutorial');
  private readonly impactFlash = this.getElement('#impact-flash');

  constructor(onPause: () => void, onResume: () => void, onRestart: () => void) {
    this.getElement('#pause-button').addEventListener('click', onPause);
    this.getElement('#resume-button').addEventListener('click', onResume);
    this.getElement('#restart-button').addEventListener('click', onRestart);
  }

  update(score: number, distance: number, speed: number): void {
    this.score.textContent = Math.floor(score).toString().padStart(6, '0');
    this.distance.textContent = `${Math.floor(distance)} m`;
    this.speed.textContent = `${Math.floor(speed * 3.6)} km/h`;
  }

  setState(state: UiState, score: number, distance: number): void {
    this.pauseOverlay.classList.toggle('is-visible', state === 'paused');
    this.pauseOverlay.setAttribute('aria-hidden', String(state !== 'paused'));
    this.gameOverOverlay.classList.toggle('is-visible', state === 'game-over');
    this.gameOverOverlay.setAttribute('aria-hidden', String(state !== 'game-over'));
    if (state === 'game-over') {
      this.finalScore.textContent = Math.floor(score).toString();
      this.finalDistance.textContent = `${Math.floor(distance)} m`;
    }
  }

  hideTutorial(): void {
    this.tutorial.classList.add('is-hidden');
  }

  flashImpact(): void {
    this.impactFlash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' });
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
