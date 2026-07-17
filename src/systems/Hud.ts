export type UiState = 'running' | 'paused' | 'game-over';

import type { PowerUpType } from './PowerUpSystem';

const POWER_DURATIONS: Record<PowerUpType, number> = {
  magnet: 9,
  shield: 12,
  multiplier: 8,
  'jump-boost': 10,
};

export class Hud {
  private readonly score = this.getElement('#score-value');
  private readonly distance = this.getElement('#distance-value');
  private readonly speed = this.getElement('#speed-value');
  private readonly coins = this.getElement('#coin-value');
  private readonly multiplier = this.getElement('#multiplier-value');
  private readonly finalScore = this.getElement('#final-score-value');
  private readonly finalDistance = this.getElement('#final-distance-value');
  private readonly pauseOverlay = this.getElement('#pause-overlay');
  private readonly gameOverOverlay = this.getElement('#game-over-overlay');
  private readonly tutorial = this.getElement('#tutorial');
  private readonly impactFlash = this.getElement('#impact-flash');
  private readonly powerChips = new Map<PowerUpType, HTMLElement>();

  constructor(onPause: () => void, onResume: () => void, onRestart: () => void) {
    this.getElement('#pause-button').addEventListener('click', onPause);
    this.getElement('#resume-button').addEventListener('click', onResume);
    this.getElement('#restart-button').addEventListener('click', onRestart);
    for (const type of Object.keys(POWER_DURATIONS) as PowerUpType[]) {
      this.powerChips.set(type, this.getElement(`[data-power="${type}"]`));
    }
  }

  update(
    score: number,
    distance: number,
    speed: number,
    coins: number,
    multiplier: number,
    remaining: Readonly<Record<PowerUpType, number>>,
  ): void {
    this.score.textContent = Math.floor(score).toString().padStart(6, '0');
    this.distance.textContent = `${Math.floor(distance)} m`;
    this.speed.textContent = `${Math.floor(speed * 3.6)} km/h`;
    this.coins.textContent = String(coins);
    this.multiplier.textContent = `x${multiplier}`;
    for (const [type, chip] of this.powerChips) {
      const duration = remaining[type];
      chip.classList.toggle('is-active', duration > 0);
      chip.style.setProperty('--power-progress', `${Math.min(100, (duration / POWER_DURATIONS[type]) * 100)}%`);
    }
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

  flashCollect(): void {
    this.coins.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.45)', color: '#fff3a6' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' },
    );
  }

  flashPowerUp(): void {
    this.getElement('#power-strip').animate(
      [{ transform: 'translateY(-4px)', filter: 'brightness(1.8)' }, { transform: 'translateY(0)', filter: 'brightness(1)' }],
      { duration: 260, easing: 'ease-out' },
    );
  }

  flashShield(): void {
    this.impactFlash.animate(
      [{ opacity: 0.5, background: '#43efff' }, { opacity: 0, background: '#43efff' }],
      { duration: 240, easing: 'ease-out' },
    );
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
