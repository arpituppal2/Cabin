export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.ambientGain = null;
    this.enabled = true;
    this.initialized = false;
    this.walkInterval = null;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this._buildEngine();
    this._buildAmbient();
    this.initialized = true;
  }

  _buildEngine() {
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineFilter.Q.value = 1.2;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 90;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 183;

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = 0.5;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(osc2Gain);
    osc2Gain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  _buildAmbient() {
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0;

    const ambientOsc = this.ctx.createOscillator();
    ambientOsc.type = 'sine';
    ambientOsc.frequency.value = 55;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(ambientOsc.frequency);

    const ambFilter = this.ctx.createBiquadFilter();
    ambFilter.type = 'lowpass';
    ambFilter.frequency.value = 200;

    ambientOsc.connect(ambFilter);
    ambFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    ambientOsc.start();
    lfo.start();
  }

  _noiseBuffer(duration) {
    const sampleRate = this.ctx.sampleRate;
    const bufLen = Math.floor(sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bufLen, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _playNoise(duration, freqLow, freqHigh, gain = 0.3, filterType = 'bandpass') {
    if (!this.initialized || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = (freqLow + freqHigh) / 2;
    filter.Q.value = 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start();
    src.stop(this.ctx.currentTime + duration);
  }

  setPhase(phase) {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const ramp = 3;

    switch (phase) {
      case 'BOARDING':
        this.engineGain.gain.linearRampToValueAtTime(0, t + ramp);
        this.ambientGain.gain.linearRampToValueAtTime(0.08, t + ramp);
        break;
      case 'TAXI':
        this.engineGain.gain.linearRampToValueAtTime(0.06, t + ramp);
        this.ambientGain.gain.linearRampToValueAtTime(0.04, t + ramp);
        this.engineOsc1.frequency.linearRampToValueAtTime(75, t + ramp);
        this.engineOsc2.frequency.linearRampToValueAtTime(150, t + ramp);
        break;
      case 'TAKEOFF':
        this._spoolUp();
        this.ambientGain.gain.linearRampToValueAtTime(0, t + 5);
        break;
      case 'CRUISE':
        this.engineGain.gain.linearRampToValueAtTime(0.22, t + ramp);
        this.engineOsc1.frequency.linearRampToValueAtTime(92, t + ramp);
        this.engineOsc2.frequency.linearRampToValueAtTime(186, t + ramp);
        this.engineFilter.frequency.linearRampToValueAtTime(420, t + ramp);
        break;
      case 'DESCENT':
        this.engineGain.gain.linearRampToValueAtTime(0.15, t + ramp);
        this.engineOsc1.frequency.linearRampToValueAtTime(82, t + ramp);
        this.engineFilter.frequency.linearRampToValueAtTime(350, t + ramp);
        break;
      case 'LANDING':
        this.engineGain.gain.linearRampToValueAtTime(0.06, t + ramp);
        this.engineOsc1.frequency.linearRampToValueAtTime(65, t + ramp);
        this.engineOsc2.frequency.linearRampToValueAtTime(130, t + ramp);
        this.engineFilter.frequency.linearRampToValueAtTime(250, t + ramp);
        break;
      case 'ARRIVED':
        this.engineGain.gain.linearRampToValueAtTime(0, t + 4);
        this.ambientGain.gain.linearRampToValueAtTime(0.05, t + 4);
        break;
    }
  }

  _spoolUp() {
    const t = this.ctx.currentTime;
    this.engineGain.gain.linearRampToValueAtTime(0.08, t + 2);
    this.engineGain.gain.linearRampToValueAtTime(0.25, t + 20);
    this.engineOsc1.frequency.linearRampToValueAtTime(60, t + 1);
    this.engineOsc1.frequency.linearRampToValueAtTime(152, t + 20);
    this.engineOsc2.frequency.linearRampToValueAtTime(120, t + 1);
    this.engineOsc2.frequency.linearRampToValueAtTime(304, t + 20);
    this.engineFilter.frequency.linearRampToValueAtTime(500, t + 20);
  }

  playChime() {
    if (!this.initialized || !this.enabled) return;
    const freqs = [880, 1108];
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.32);
      g.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + i * 0.32 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + i * 0.32 + 0.7);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(this.ctx.currentTime + i * 0.32);
      osc.stop(this.ctx.currentTime + i * 0.32 + 0.75);
    });
  }

  playTrayClunk() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.15, 200, 800, 0.4, 'bandpass');
    setTimeout(() => this._playNoise(0.08, 300, 600, 0.2, 'bandpass'), 60);
  }

  playButtonClick() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.02, 2000, 8000, 0.15, 'highpass');
  }

  playCubbySlide() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.3, 100, 600, 0.2, 'bandpass');
  }

  playMealClink() {
    if (!this.initialized || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  playPourSound() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.5, 300, 2000, 0.15, 'bandpass');
  }

  playHissSound() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.4, 2000, 8000, 0.1, 'highpass');
  }

  startFootsteps() {
    if (this.walkInterval) return;
    this.walkInterval = setInterval(() => {
      if (this.initialized && this.enabled) {
        this._playNoise(0.08, 80, 400, 0.2, 'bandpass');
      }
    }, 500);
  }

  stopFootsteps() {
    if (this.walkInterval) {
      clearInterval(this.walkInterval);
      this.walkInterval = null;
    }
  }

  playPA(text) {
    if (!this.enabled) return;
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.92;
      utter.pitch = 0.9;
      utter.volume = 0.7;
      speechSynthesis.speak(utter);
    }
  }

  playSprintEnd() {
    this.playChime();
    setTimeout(() => this.playChime(), 600);
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? 0.8 : 0;
    }
    return this.enabled;
  }
}
