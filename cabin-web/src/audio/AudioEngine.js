export class AudioEngine {
  constructor() {
    this.ctx          = null;
    this.masterGain   = null;
    this.engineGain   = null;
    this._rumbleFilter = null;
    this._hissFilter   = null;
    this._whineFilter  = null;
    this._rumbleGain   = null;
    this._hissGain     = null;
    this._whineGain    = null;
    this.ambientGain  = null;
    this.enabled      = true;
    this.initialized  = false;
    this.walkInterval = null;
    this._voiceInitialized = false;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);
    this._buildEngine();
    this._buildAmbient();
    this.initialized = true;
    // Pre-load voices
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => { this._voiceInitialized = true; };
    }
  }

  // ── NOISE BUFFER (pink noise via Paul Kellet's algorithm) ─────────────────
  _makePinkNoiseBuffer(seconds = 4) {
    const sr  = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < len; i++) {
        const w = Math.random()*2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  // ── JET ENGINE (3-layer noise synthesis) ─────────────────────────────────
  _buildEngine() {
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    const noiseBuf = this._makePinkNoiseBuffer(5);

    const makeLayer = (freq, Q, vol) => {
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = freq; flt.Q.value = Q;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(flt); flt.connect(g); g.connect(this.engineGain);
      src.start();
      return { src, flt, g };
    };

    // 1. Low structural rumble (60-180 Hz — frame vibration felt in seat)
    const rumble = makeLayer(110, 1.6, 0.85);
    this._rumbleFilter = rumble.flt; this._rumbleGain = rumble.g;

    // 2. Mid broadband rush (400-1600 Hz — air flowing over fuselage)
    const hiss = makeLayer(700, 0.75, 0.50);
    this._hissFilter = hiss.flt; this._hissGain = hiss.g;

    // 3. High fan/turbine whine (2500-5000 Hz — high bypass turbofan)
    const whine = makeLayer(3200, 2.8, 0.22);
    this._whineFilter = whine.flt; this._whineGain = whine.g;

    // Slow LFO on rumble freq (subtle engine breathing)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 14;
    lfo.connect(lfoGain); lfoGain.connect(this._rumbleFilter.frequency);
    lfo.start();

    // Compressor for smooth dynamics
    const comp = this.ctx.createDynamicsCompressor();
    comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.06; comp.release.value = 0.28;
    this.engineGain.connect(comp);
    comp.connect(this.masterGain);
  }

  // ── CABIN AMBIANCE (pressurisation hum + gentle air) ──────────────────────
  _buildAmbient() {
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0;

    const noiseBuf = this._makePinkNoiseBuffer(3);

    // Pressurisation hum — low sine with very soft noise
    const hum = this.ctx.createOscillator();
    hum.type = 'sine'; hum.frequency.value = 58;
    const humGain = this.ctx.createGain(); humGain.gain.value = 0.35;
    hum.connect(humGain); humGain.connect(this.ambientGain);
    hum.start();

    // Gentle air circulation noise
    const airSrc = this.ctx.createBufferSource();
    airSrc.buffer = noiseBuf; airSrc.loop = true;
    const airFlt = this.ctx.createBiquadFilter();
    airFlt.type = 'bandpass'; airFlt.frequency.value = 320; airFlt.Q.value = 0.55;
    const airG = this.ctx.createGain(); airG.gain.value = 0.18;
    airSrc.connect(airFlt); airFlt.connect(airG); airG.connect(this.ambientGain);
    airSrc.start();

    this.ambientGain.connect(this.masterGain);
  }

  // ── PHASE TRANSITIONS ─────────────────────────────────────────────────────
  setPhase(phase) {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const ramp = 3.5;

    const setEngine = (gain, rumble, hiss, whine) => {
      this.engineGain.gain.linearRampToValueAtTime(gain,  t + ramp);
      this._rumbleFilter.frequency.linearRampToValueAtTime(rumble, t + ramp);
      this._hissFilter.frequency.linearRampToValueAtTime(hiss,   t + ramp);
      this._whineFilter.frequency.linearRampToValueAtTime(whine,  t + ramp);
    };

    switch (phase) {
      case 'BOARDING':
        setEngine(0, 90, 500, 2200);
        this.ambientGain.gain.linearRampToValueAtTime(0.09, t + ramp);
        break;
      case 'TAXI':
        setEngine(0.07, 105, 560, 2400);
        this.ambientGain.gain.linearRampToValueAtTime(0.04, t + ramp);
        break;
      case 'TAKEOFF':
        this._spoolUp();
        this.ambientGain.gain.linearRampToValueAtTime(0, t + 5);
        break;
      case 'CRUISE':
        setEngine(0.26, 118, 720, 3300);
        this.ambientGain.gain.linearRampToValueAtTime(0, t + ramp);
        break;
      case 'BREAK':
        setEngine(0.24, 115, 700, 3100);
        break;
      case 'DESCENT':
        setEngine(0.17, 102, 620, 2800);
        break;
      case 'LANDING':
        setEngine(0.09, 92, 530, 2400);
        break;
      case 'ARRIVED':
        this.engineGain.gain.linearRampToValueAtTime(0, t + 5);
        this.ambientGain.gain.linearRampToValueAtTime(0.07, t + 5);
        break;
    }
  }

  _spoolUp() {
    const t = this.ctx.currentTime;
    // Gradual 20-second spool from taxi idle to cruise power
    this.engineGain.gain.setValueAtTime(0.07, t);
    this.engineGain.gain.linearRampToValueAtTime(0.14, t + 5);
    this.engineGain.gain.linearRampToValueAtTime(0.30, t + 20);
    this._rumbleFilter.frequency.linearRampToValueAtTime(80,  t + 2);
    this._rumbleFilter.frequency.linearRampToValueAtTime(130, t + 20);
    this._hissFilter.frequency.linearRampToValueAtTime(400, t + 2);
    this._hissFilter.frequency.linearRampToValueAtTime(900, t + 20);
    this._whineFilter.frequency.linearRampToValueAtTime(1800, t + 2);
    this._whineFilter.frequency.linearRampToValueAtTime(4000, t + 20);
  }

  // ── ONE-SHOT SOUNDS ───────────────────────────────────────────────────────
  _noiseBuffer(duration) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random()*2 - 1;
    return buf;
  }

  _playNoise(duration, freq, Q = 1, gain = 0.3, type = 'bandpass') {
    if (!this.initialized || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(duration);
    const flt = this.ctx.createBiquadFilter();
    flt.type = type; flt.frequency.value = freq; flt.Q.value = Q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    src.connect(flt); flt.connect(g); g.connect(this.masterGain);
    src.start(); src.stop(this.ctx.currentTime + duration);
  }

  playChime() {
    if (!this.initialized || !this.enabled) return;
    // Warm cabin chime (two-tone, sine with natural decay)
    [[880, 0, 0.28], [1108, 0.34, 0.22]].forEach(([freq, delay, vol]) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, this.ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + delay + 0.018);
      g.gain.setValueAtTime(vol, this.ctx.currentTime + delay + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + delay + 0.90);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + 0.95);
    });
  }

  playTrayClunk() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.12, 280, 1.2, 0.38);
    setTimeout(() => this._playNoise(0.06, 420, 1.0, 0.20), 55);
  }

  playButtonClick() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.018, 3500, 0.8, 0.14, 'highpass');
  }

  playCubbySlide() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.28, 180, 1.1, 0.18);
  }

  playMealClink() {
    if (!this.initialized || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 1240;
    g.gain.setValueAtTime(0.22, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.55);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(); osc.stop(this.ctx.currentTime + 0.60);
  }

  playPourSound() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.55, 500, 0.7, 0.14);
  }

  playHissSound() {
    if (!this.initialized || !this.enabled) return;
    this._playNoise(0.35, 3000, 0.6, 0.09, 'highpass');
  }

  startFootsteps() {
    if (this.walkInterval) return;
    this.walkInterval = setInterval(() => {
      if (this.initialized && this.enabled) this._playNoise(0.07, 120, 1.2, 0.18);
    }, 520);
  }

  stopFootsteps() {
    if (this.walkInterval) { clearInterval(this.walkInterval); this.walkInterval = null; }
  }

  // ── PA ANNOUNCEMENT (picks the best available voice) ─────────────────────
  playPA(text) {
    if (!this.enabled) return;
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();

    const doSpeak = () => {
      const utter = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();

      // Prefer natural-sounding voices (Google, premium OS voices)
      const preferred = voices.find(v =>
        /Google UK English Female|Google US English|Samantha|Karen|Moira|Fiona|Daniel|Serena|Ava/.test(v.name)
      ) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang === 'en-US') || voices[0];

      if (preferred) utter.voice = preferred;
      utter.rate   = 0.86;
      utter.pitch  = 1.02;
      utter.volume = 0.78;
      speechSynthesis.speak(utter);
    };

    // Play chime first, then speak
    this.playChime();
    setTimeout(doSpeak, 680);
  }

  playSprintEnd() {
    this.playChime();
    setTimeout(() => this.playChime(), 700);
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? 0.85 : 0;
    return this.enabled;
  }
}
