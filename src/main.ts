import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

const game = new Game(canvas);
const loadingProgress = document.querySelector<HTMLElement>('#loading-progress');
const loadingScreen = document.querySelector<HTMLElement>('#loading-screen');

await game.initialize((progress) => {
  if (loadingProgress) loadingProgress.style.setProperty('--load-progress', `${Math.round(progress * 100)}%`);
});
loadingScreen?.classList.add('is-complete');
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
  });
}
