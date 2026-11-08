// Synthesized sound effects and venue ambience (WebAudio, no audio files).
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.amb = null; }

  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _noise(seconds) {
    const c = this.ctx, b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _knock(freq, gain, len = 0.12) {
    const c = this._ctx(); if (!c || this.muted) return;
    const t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this._noise(len);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(bp).connect(g).connect(this.master); n.start(t);
    const o = c.createOscillator(); o.frequency.setValueAtTime(freq / 4, t); o.frequency.exponentialRampToValueAtTime(freq / 8, t + 0.08);
    const og = c.createGain(); og.gain.setValueAtTime(gain * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.12);
  }

  _tone(freqs, dur = 0.25, type = 'sine', gain = 0.12) {
    const c = this._ctx(); if (!c || this.muted) return;
    freqs.forEach((f, i) => {
      const t = c.currentTime + i * dur * 0.6, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  move() { this._knock(1800, 0.6); }
  capture() { this._knock(1100, 0.9, 0.18); setTimeout(() => this._knock(2200, 0.35), 60); }
  check() { this._tone([880, 1320], 0.22, 'triangle', 0.1); }
  select() { this._tone([1400], 0.06, 'sine', 0.04); }
  win() { this._tone([523, 659, 784, 1047], 0.35, 'triangle', 0.12); }
  lose() { this._tone([392, 330, 262], 0.4, 'sine', 0.1); }
  notify() { this._tone([988, 1319], 0.18, 'sine', 0.08); }

  ambience(kind) {
    const c = this._ctx(); if (!c) return;
    if (this.amb) { const old = this.amb; old.g.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => { try { old.src.stop(); old.lfo?.stop(); } catch { /* ignore */ } }, 1500); this.amb = null; }
    if (kind) this.lastKind = kind;
    if (this.muted || !kind) return;
    const src = c.createBufferSource(); src.buffer = this._noise(4); src.loop = true;
    const f = c.createBiquadFilter(), g = c.createGain();
    let lfo = null;
    if (kind === 'titanic') { f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0; g.gain.setTargetAtTime(0.22, c.currentTime, 1); }
    else if (kind === 'liberty') {
      f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6; g.gain.value = 0; g.gain.setTargetAtTime(0.09, c.currentTime, 1);
      lfo = c.createOscillator(); lfo.frequency.value = 0.12; const lg = c.createGain(); lg.gain.value = 350; lfo.connect(lg).connect(f.frequency); lfo.start();
    } else { f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0; g.gain.setTargetAtTime(0.06, c.currentTime, 1); }
    src.connect(f).connect(g).connect(this.master); src.start();
    this.amb = { src, g, lfo, kind };
  }

  setMuted(m) { const k = this.amb?.kind || this.lastKind; this.lastKind = k; this.muted = m; this.ambience(m ? null : k); }
}
