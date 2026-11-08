// Web Audio API Synthesizer for Taekwondo Scoreboard
// Zero external dependencies, offline-ready, high-performance sound effects.

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.1;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
  }

  // Powerful arena horn buzzer (end of round / keu-man)
  playBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.exponentialRampToValueAtTime(82, now + 1.2);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(164.8, now); // E3 harmonic
    osc2.frequency.exponentialRampToValueAtTime(123.5, now + 1.2);

    osc3.type = 'square';
    osc3.frequency.setValueAtTime(55, now); // A1 sub-bass
    osc3.frequency.exponentialRampToValueAtTime(41, now + 1.2);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.8 * this.volume, now + 0.05);
    gainNode.gain.setValueAtTime(0.7 * this.volume, now + 0.9);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    osc3.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + 1.35);
    osc2.stop(now + 1.35);
    osc3.stop(now + 1.35);
  }

  // Start match sound (Shi-jak chime)
  playStart() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.6 * this.volume, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Pause match sound (Kal-yeo)
  playPause() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(440, now + 0.09); // A4

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.5 * this.volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Point confirmation chime
  playPoint(points = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const baseFreq = points >= 3 ? 1046.5 : 880;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.5 * this.volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Gam-jeom (penalty) buzz
  playGamjeom() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(196, now + 0.1);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.6 * this.volume, now + 0.02);
    gainNode.gain.setValueAtTime(0.5 * this.volume, now + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Countdown tick (last 10 seconds)
  playTick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.3 * this.volume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }
}

export const soundManager = new SoundSynthesizer();

