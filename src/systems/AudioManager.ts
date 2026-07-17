export type AudioGroup = 'master' | 'music' | 'sfx';
export type SoundEvent =
  | 'lane'
  | 'jump'
  | 'roll'
  | 'coin'
  | 'rare'
  | 'power'
  | 'shield'
  | 'crash'
  | 'confirm'
  | 'pause';

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private readonly volumes: Record<AudioGroup, number> = { master: 0.8, music: 0.55, sfx: 0.8 };
  private variation = 0;
  private disposed = false;

  private readonly unlockFromGesture = () => {
    void this.unlock();
  };

  constructor() {
    window.addEventListener('pointerdown', this.unlockFromGesture, { once: true });
    window.addEventListener('keydown', this.unlockFromGesture, { once: true });
  }

  get diagnostics(): { unlocked: boolean; state: string; master: number; music: number; sfx: number } {
    return {
      unlocked: this.context !== null,
      state: this.context?.state ?? 'uninitialized',
      master: this.volumes.master,
      music: this.volumes.music,
      sfx: this.volumes.sfx,
    };
  }

  async unlock(): Promise<void> {
    if (this.disposed) return;
    if (!this.context) this.createContext();
    if (this.context?.state === 'suspended') await this.context.resume();
    window.removeEventListener('pointerdown', this.unlockFromGesture);
    window.removeEventListener('keydown', this.unlockFromGesture);
  }

  play(event: SoundEvent): void {
    if (!this.context || !this.sfxGain || this.context.state !== 'running') return;
    this.variation += 1;
    const pitch = 1 + Math.sin(this.variation * 12.9898) * 0.035;
    if (event === 'lane') this.tone(180 * pitch, 260 * pitch, 0.075, 'triangle', 0.08);
    else if (event === 'jump') this.tone(190 * pitch, 620 * pitch, 0.24, 'sine', 0.14);
    else if (event === 'roll') this.noise(0.2, 680, 0.12);
    else if (event === 'coin') this.tone(640 * pitch, 980 * pitch, 0.13, 'triangle', 0.12);
    else if (event === 'rare') this.chord([680, 910, 1260], 0.3, 0.12);
    else if (event === 'power') this.chord([220, 440, 660], 0.42, 0.14);
    else if (event === 'shield') {
      this.tone(160, 84, 0.38, 'sine', 0.2);
      this.noise(0.28, 1500, 0.11);
    } else if (event === 'crash') {
      this.tone(110, 42, 0.55, 'sawtooth', 0.22);
      this.noise(0.44, 420, 0.18);
    } else if (event === 'confirm') this.chord([420, 630], 0.18, 0.09);
    else if (event === 'pause') this.tone(260, 180, 0.12, 'sine', 0.08);
  }

  setVolume(group: AudioGroup, value: number): void {
    this.volumes[group] = Math.max(0, Math.min(1, value));
    const now = this.context?.currentTime ?? 0;
    const gain = group === 'master' ? this.masterGain : group === 'music' ? this.musicGain : this.sfxGain;
    gain?.gain.setTargetAtTime(this.volumes[group], now, 0.025);
  }

  setRunIntensity(speedRatio: number): void {
    if (!this.context || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(0.018 + speedRatio * 0.045, this.context.currentTime, 0.18);
  }

  setPaused(paused: boolean): void {
    if (!this.context || !this.musicGain) return;
    const target = paused ? this.volumes.music * 0.28 : this.volumes.music;
    this.musicGain.gain.setTargetAtTime(target, this.context.currentTime, 0.08);
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('pointerdown', this.unlockFromGesture);
    window.removeEventListener('keydown', this.unlockFromGesture);
    void this.context?.close();
    this.context = null;
  }

  private createContext(): void {
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    const music = context.createGain();
    const sfx = context.createGain();
    master.gain.value = this.volumes.master;
    music.gain.value = this.volumes.music;
    sfx.gain.value = this.volumes.sfx;
    music.connect(master);
    sfx.connect(master);
    master.connect(context.destination);
    this.context = context;
    this.masterGain = master;
    this.musicGain = music;
    this.sfxGain = sfx;
    this.createSoundscape();
  }

  private createSoundscape(): void {
    if (!this.context || !this.musicGain) return;
    const context = this.context;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.8;
    filter.connect(this.musicGain);
    for (const [index, frequency] of [55, 82.5, 110, 164.8].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index % 2 === 0 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 3 - 4;
      gain.gain.value = index === 0 ? 0.055 : 0.022;
      oscillator.connect(gain).connect(filter);
      oscillator.start();
    }
    const pulse = context.createOscillator();
    const pulseGain = context.createGain();
    pulse.type = 'square';
    pulse.frequency.value = 2.1;
    pulseGain.gain.value = 110;
    pulse.connect(pulseGain).connect(filter.frequency);
    pulse.start();

    const wind = context.createBufferSource();
    const windFilter = context.createBiquadFilter();
    const windGain = context.createGain();
    wind.buffer = this.createNoiseBuffer(2);
    wind.loop = true;
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 780;
    windFilter.Q.value = 0.45;
    windGain.gain.value = 0.02;
    wind.connect(windFilter).connect(windGain).connect(this.musicGain);
    wind.start();
    this.windGain = windGain;
  }

  private tone(startFrequency: number, endFrequency: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private chord(frequencies: number[], duration: number, volume: number): void {
    frequencies.forEach((frequency, index) => this.tone(frequency, frequency * 1.04, duration + index * 0.035, 'sine', volume / frequencies.length));
  }

  private noise(duration: number, frequency: number, volume: number): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.createNoiseBuffer(duration);
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(now);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const context = this.context!;
    const length = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 0x9e3779b9;
    for (let index = 0; index < length; index += 1) {
      state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0;
      data[index] = ((state >>> 0) / 2147483648 - 1) * 0.7;
    }
    return buffer;
  }
}
