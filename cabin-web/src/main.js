import { SeatSelector } from './ui/SeatSelector.js';
import { CabinScene } from './scene/CabinScene.js';
import { Hotspots } from './scene/Hotspots.js';
import { SessionEngine, PHASES } from './session/SessionEngine.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { PanelManager } from './ui/PanelManager.js';
import { MealService } from './session/MealService.js';

class CabinApp {
  constructor() {
    this.session = new SessionEngine();
    this.audio = new AudioEngine();
    this.scene = null;
    this.hotspots = null;
    this.panels = null;
    this.mealService = null;
    this._unsubPhase = null;
    this._unsubTick = null;
    this._unsubSprint = null;
    this._unsubBreak = null;
    this._unsubMeal = null;
    this._hud = null;
    this._phaseEl = null;
    this._takeoffTimeout = null;
  }

  init() {
    this._showSeatSelector();

    window.addEventListener('cabin:deplane', () => this._deplane());
  }

  _showSeatSelector() {
    const seatScreen = document.getElementById('seat-selector-screen');
    const selector = new SeatSelector(seatScreen);
    selector.onBoard((config) => {
      selector.destroy();
      this._boardFlight(config);
    });
    selector.render();
  }

  _boardFlight(config) {
    const seatScreen = document.getElementById('seat-selector-screen');
    const cabinContainer = document.getElementById('cabin-container');
    seatScreen.style.display = 'none';
    cabinContainer.style.display = 'block';

    this.session.configure(config);

    const canvas = document.getElementById('cabin-canvas');
    this.scene = new CabinScene(canvas, config.seat);
    this.scene.init();
    this.scene.startRender();

    this.panels = new PanelManager(
      document.getElementById('panel-layer'),
      this.session
    );

    this.hotspots = new Hotspots(
      this.scene.camera,
      this.scene.cabinGeometry,
      canvas
    );

    this._setupHotspots();
    this._setupSessionListeners();

    this.mealService = new MealService(this.scene, this.session, this.audio);
    this.mealService.init();

    const audioPrompt = document.getElementById('audio-start-prompt');
    const audioBtn = document.getElementById('audio-start-btn');
    audioBtn.addEventListener('click', () => {
      this.audio.init();
      audioPrompt.style.display = 'none';
      this.session.start();
    });

    this._buildHUD();
  }

  _setupHotspots() {
    const hs = this.hotspots;
    const geo = this.scene.cabinGeometry;
    const panels = this.panels;
    const audio = this.audio;

    hs.on('ife', () => {
      panels.openIFE();
    });

    hs.on('tray', () => {
      if (!geo.trayDeployed) {
        geo.deployTray();
        audio.playTrayClunk();
        this._showToast('Tray table deployed');
      } else {
        panels.openTaskBoard();
      }
    });

    hs.on('notebook', () => {
      panels.openNotebook();
    });

    hs.on('seatBtn', (mesh) => {
      audio.playButtonClick();
      const idx = mesh.userData.btnIndex || 0;
      const label = mesh.userData.btnLabel || ['Upright','Lounge','Bed','Lumbar'][idx];
      geo.animateSeatBtn(idx);
      this._showToast(label + ' mode');
      if (label === 'Bed' && this.scene && this.scene.ambLight) {
        this.scene.ambLight.intensity = 0.28;
        this.scene.consoleLamp.intensity = 0.35;
      }
    });

    hs.on('cubbyDoor', () => {
      if (!geo.cubbyOpen) {
        geo.openCubby();
        audio.playCubbySlide();
        this._showToast('Storage cubby open');
      } else {
        geo.closeCubby();
        audio.playCubbySlide();
      }
    });

    hs.on('headphones', () => {
      const on = audio.toggleMute();
      this._showToast(on ? 'Audio on' : 'Audio muted');
    });

    hs.on('bottle', () => {
      audio.playPourSound();
      this._showToast('Bon appétit 💧');
    });

    hs.on('gasper', () => {
      audio.playHissSound();
    });

    hs.on('meal', () => {
      this.mealService.eatMeal();
      this._showToast('Bon appétit');
    });
  }

  _setupSessionListeners() {
    this._unsubPhase = this.session.on('phaseChange', ({ phase }) => {
      this._onPhaseChange(phase);
    });

    this._unsubTick = this.session.on('tick', (data) => {
      this._updateHUD(data);
    });

    this._unsubSprint = this.session.on('sprintEnd', ({ sprint }) => {
      this._onSprintEnd(sprint);
    });

    this._unsubBreak = this.session.on('breakStart', ({ type, durationSec }) => {
      this._onBreakStart(type, durationSec);
    });

    this._unsubMeal = this.session.on('mealService', (meal) => {
      this._showToast('Meal service: ' + meal.label);
    });
  }

  _onPhaseChange(phase) {
    this.scene.setPhase(phase);
    this.audio.setPhase(phase);
    this._updatePhaseBadge(phase);

    const rig = this.scene.cameraRig;
    const geo = this.scene.cabinGeometry;

    if (phase === PHASES.BOARDING) {
      this.audio.playPA('Ladies and gentlemen, welcome aboard. Flight attendants, doors to automatic and crosscheck.');
    } else if (phase === PHASES.TAXI) {
      geo.setSeatbeltSign(true);
    } else if (phase === PHASES.TAKEOFF) {
      this.audio.playPA('Cabin crew, please prepare for takeoff.');
      this.audio.playChime();
      this._takeoffTimeout = setTimeout(() => {
        if (rig) rig.setTakeoffTilt(12);
        setTimeout(() => { if (rig) rig.setTakeoffTilt(0); }, 30000);
      }, 3000);
    } else if (phase === PHASES.CRUISE) {
      geo.setSeatbeltSign(false);
      this.audio.playChime();
      setTimeout(() => {
        this.audio.playPA('Ladies and gentlemen, the captain has turned off the fasten seatbelt sign. You are free to move about the cabin.');
      }, 3000);
      if (!this.panels.isOpen) this.panels.openIFE('clock');
    } else if (phase === PHASES.BREAK) {
    } else if (phase === PHASES.DESCENT) {
      this.audio.playChime();
      this.audio.playPA('Ladies and gentlemen, we are beginning our descent. Please return to your seats and fasten your seatbelts.');
      geo.setSeatbeltSign(true);
    } else if (phase === PHASES.LANDING) {
      const dest = this.session.state.route.destinationCity;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.audio.playPA(`Ladies and gentlemen, welcome to ${dest}. Local time is ${timeStr}. Thank you for flying with us.`);
      if (rig) {
        rig.setTakeoffTilt(-4);
        setTimeout(() => rig.setTakeoffTilt(0), 5000);
        rig.setTurbulence(0.8);
        setTimeout(() => rig.setTurbulence(0), 10000);
      }
    } else if (phase === PHASES.ARRIVED) {
      geo.setSeatbeltSign(false);
      this.panels.showArrived();
    }
  }

  _onSprintEnd(sprint) {
    this.audio.playSprintEnd();
    this.panels.showBreakPrompt((choice) => {
      this.session.resumeFromBreak(choice);
    });
  }

  _onBreakStart(type, durationSec) {
    const rig = this.scene.cameraRig;
    if (type === 'walk' && rig) {
      rig.startWalk();
      this.audio.startFootsteps();
      setTimeout(() => {
        rig.stopWalk();
        this.audio.stopFootsteps();
      }, durationSec * 1000);
    } else {
      this.scene.cabinGeometry.deployTray();
      this._showToast('Tea service arriving…');
    }
  }

  _buildHUD() {
    this._hud = document.getElementById('hud');
    this._hud.innerHTML = `
      <div class="phase-badge" id="phase-badge">BOARDING</div>
      <div class="hint-label" id="hint-label">Drag to look · Click objects to interact</div>
    `;
    this._phaseEl = document.getElementById('phase-badge');
  }

  _updateHUD(data) {
    if (!this._phaseEl) return;
    const s = this.session.state;
    if (s.phase === PHASES.CRUISE && !s.isOnBreak) {
      const m = Math.floor(s.sprintSecondsLeft / 60);
      const sec = Math.floor(s.sprintSecondsLeft % 60);
      this._phaseEl.textContent = `SPRINT ${s.currentSprint} · ${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
    }
  }

  _updatePhaseBadge(phase) {
    if (!this._phaseEl) return;
    const labels = {
      BOARDING: 'BOARDING', TAXI: 'TAXIING', TAKEOFF: 'TAKEOFF',
      CRUISE: 'CRUISE', BREAK: 'BREAK', DESCENT: 'DESCENT',
      LANDING: 'LANDING', ARRIVED: 'ARRIVED'
    };
    this._phaseEl.textContent = labels[phase] || phase;
  }

  _animateSeatBtn(mesh) {
    if (!mesh.material) return;
    mesh.material.emissiveIntensity = 0.6;
    setTimeout(() => { mesh.material.emissiveIntensity = 0.15; }, 200);
  }

  _showToast(msg) {
    const layer = document.getElementById('toast-layer');
    if (!layer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    layer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  _deplane() {
    if (this._unsubPhase) this._unsubPhase();
    if (this._unsubTick) this._unsubTick();
    if (this._unsubSprint) this._unsubSprint();
    if (this._unsubBreak) this._unsubBreak();
    if (this._unsubMeal) this._unsubMeal();
    if (this._takeoffTimeout) clearTimeout(this._takeoffTimeout);
    if (this.scene) this.scene.destroy();
    if (this.audio && this.audio.ctx) this.audio.ctx.close();

    this.session.reset();
    this.scene = null;
    this.audio = new AudioEngine();
    this.panels = null;
    this.hotspots = null;
    this.mealService = null;

    const cabinContainer = document.getElementById('cabin-container');
    const seatScreen = document.getElementById('seat-selector-screen');
    cabinContainer.style.display = 'none';
    cabinContainer.querySelector('#hud').innerHTML = '';
    cabinContainer.querySelector('#panel-layer').innerHTML = '';
    cabinContainer.querySelector('#toast-layer').innerHTML = '';
    cabinContainer.querySelector('#audio-start-prompt').style.display = 'flex';
    seatScreen.style.display = 'block';

    this._showSeatSelector();
  }
}

const app = new CabinApp();
app.init();
