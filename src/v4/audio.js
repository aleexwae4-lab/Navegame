export class AudioEngine {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  async unlock() {
    if (!this.context) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      this.context = new AudioContextCtor();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  tone({ type = 'sine', from = 440, to = 220, duration = 0.12, gain = 0.12 }) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, from), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(volume);
    volume.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  noise(duration = 0.24, gain = 0.2) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const frameCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) channel[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const volume = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + duration);
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(volume);
    volume.connect(this.context.destination);
    source.start(now);
  }

  play(name) {
    if (name === 'laser') this.tone({ type: 'sawtooth', from: 980, to: 145, duration: 0.085, gain: 0.075 });
    if (name === 'enemyLaser') this.tone({ type: 'square', from: 250, to: 120, duration: 0.12, gain: 0.05 });
    if (name === 'hit') this.tone({ type: 'triangle', from: 170, to: 45, duration: 0.22, gain: 0.22 });
    if (name === 'explosion') this.noise(0.25, 0.18);
    if (name === 'powerup') this.tone({ type: 'sine', from: 440, to: 1180, duration: 0.28, gain: 0.12 });
    if (name === 'level') this.tone({ type: 'square', from: 520, to: 1040, duration: 0.22, gain: 0.08 });
    if (name === 'overdrive') this.tone({ type: 'sawtooth', from: 260, to: 1320, duration: 0.42, gain: 0.11 });
    if (name === 'boss') this.tone({ type: 'square', from: 120, to: 55, duration: 0.5, gain: 0.13 });
    if (name === 'mission') this.tone({ type: 'sine', from: 620, to: 1240, duration: 0.32, gain: 0.09 });
  }
}
