export type InputAction = 'left' | 'right' | 'jump' | 'roll' | 'pause' | 'restart';

export interface InputFrame {
  left: boolean;
  right: boolean;
  jump: boolean;
  roll: boolean;
  pause: boolean;
  restart: boolean;
}

const SWIPE_THRESHOLD = 28;

export function interpretSwipe(dx: number, dy: number, threshold = SWIPE_THRESHOLD): InputAction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'jump' : 'roll';
}

export class InputController {
  private readonly pending = new Set<InputAction>();
  private readonly frame: InputFrame = {
    left: false,
    right: false,
    jump: false,
    roll: false,
    pause: false,
    restart: false,
  };
  private pointerId: number | null = null;
  private pointerStartX = 0;
  private pointerStartY = 0;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const action = this.actionForKey(event.code);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) this.pending.add(action);
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser tests can provide a pointer without capture support.
    }
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.pointerStartX;
    const dy = event.clientY - this.pointerStartY;
    this.pointerId = null;
    const action = interpretSwipe(dx, dy);
    if (action) this.pending.add(action);
  };

  private readonly onPointerCancel = () => {
    this.pointerId = null;
  };

  private readonly onBlur = () => {
    this.pointerId = null;
    this.pending.clear();
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  consume(): Readonly<InputFrame> {
    this.frame.left = this.pending.delete('left');
    this.frame.right = this.pending.delete('right');
    this.frame.jump = this.pending.delete('jump');
    this.frame.roll = this.pending.delete('roll');
    this.frame.pause = this.pending.delete('pause');
    this.frame.restart = this.pending.delete('restart');
    return this.frame;
  }

  queue(action: InputAction): void {
    this.pending.add(action);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
  }

  private actionForKey(code: string): InputAction | null {
    if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
    if (code === 'ArrowRight' || code === 'KeyD') return 'right';
    if (code === 'ArrowUp' || code === 'KeyW') return 'jump';
    if (code === 'ArrowDown' || code === 'KeyS') return 'roll';
    if (code === 'Space') return 'jump';
    if (code === 'Escape') return 'pause';
    if (code === 'Enter') return 'restart';
    return null;
  }
}
