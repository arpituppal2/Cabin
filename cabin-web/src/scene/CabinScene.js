import * as THREE from 'three';
import { CabinGeometry } from './CabinGeometry.js';
import { WindowView } from './WindowView.js';
import { CameraRig } from './CameraRig.js';

const PHASE_LIGHTING = {
  ONBOARDING: { dirColor: 0xfff5e0, dirIntensity: 1.2, ambColor: 0xd0d8e8, ambIntensity: 0.5 },
  BOARDING:   { dirColor: 0xfff5f0, dirIntensity: 1.2, ambColor: 0xd0d8e8, ambIntensity: 0.5 },
  TAXI:       { dirColor: 0x8090d0, dirIntensity: 0.9, ambColor: 0x303860, ambIntensity: 0.4 },
  TAKEOFF:    { dirColor: 0x9090e0, dirIntensity: 1.0, ambColor: 0x404870, ambIntensity: 0.4 },
  CRUISE:     { dirColor: 0xfff5e0, dirIntensity: 0.6, ambColor: 0x202840, ambIntensity: 0.3 },
  BREAK:      { dirColor: 0xfff5e0, dirIntensity: 0.6, ambColor: 0x202840, ambIntensity: 0.3 },
  DESCENT:    { dirColor: 0xffa860, dirIntensity: 1.0, ambColor: 0x503020, ambIntensity: 0.4 },
  LANDING:    { dirColor: 0xffe8c0, dirIntensity: 1.1, ambColor: 0x604030, ambIntensity: 0.45 },
  ARRIVED:    { dirColor: 0xfff5f0, dirIntensity: 1.2, ambColor: 0xd0d8e8, ambIntensity: 0.5 }
};

export class CabinScene {
  constructor(canvas, seatId) {
    this.canvas = canvas;
    this.seatId = seatId || '1A';
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cameraRig = null;
    this.cabinGeometry = null;
    this.windowView = null;
    this.dirLight = null;
    this.ambLight = null;
    this.ifeLight = null;
    this.cubbyLight = null;
    this.hemiLight = null;
    this._targetLighting = null;
    this._currentLighting = null;
    this._lerpT = 1;
    this._animId = null;
    this._lastTime = 0;
    this._onResize = this._onResize.bind(this);
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d0d10, 5, 14);

    this.camera = new THREE.PerspectiveCamera(
      65,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.01,
      30
    );
    this.camera.position.set(0, 0.05, 0);

    this._buildLighting();

    this.windowView = new WindowView();
    this.cabinGeometry = new CabinGeometry(this.scene, this.windowView, this.seatId);
    this.cameraRig = new CameraRig(this.camera, this.canvas);
    this.cameraRig.basePosition.set(0, 0.05, 0);

    this._currentLighting = { ...PHASE_LIGHTING.BOARDING };
    this._targetLighting = { ...PHASE_LIGHTING.BOARDING };
    this._applyLighting(this._currentLighting);

    window.addEventListener('resize', this._onResize, { passive: true });
  }

  _buildLighting() {
    this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    this.dirLight.position.set(2, 4, 2);
    this.scene.add(this.dirLight);

    this.ambLight = new THREE.AmbientLight(0xd0d8e8, 0.5);
    this.scene.add(this.ambLight);

    this.ifeLight = new THREE.PointLight(0x2040c0, 0.2, 2);
    this.ifeLight.position.set(0, 0.55, -1.1);
    this.scene.add(this.ifeLight);

    this.cubbyLight = new THREE.PointLight(0xffe4a0, 0.4, 0.8);
    this.cubbyLight.position.set(-0.62, 0.06, -0.5);
    this.scene.add(this.cubbyLight);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a1a20, 0.15);
    this.scene.add(this.hemiLight);
  }

  _applyLighting(config) {
    if (this.dirLight) {
      this.dirLight.color.set(config.dirColor);
      this.dirLight.intensity = config.dirIntensity;
    }
    if (this.ambLight) {
      this.ambLight.color.set(config.ambColor);
      this.ambLight.intensity = config.ambIntensity;
    }
  }

  setPhase(phase) {
    const target = PHASE_LIGHTING[phase] || PHASE_LIGHTING.BOARDING;
    this._targetLighting = { ...target };
    this._lerpT = 0;

    const seatbeltPhases = ['TAXI', 'TAKEOFF', 'DESCENT', 'LANDING'];
    if (this.cabinGeometry) {
      this.cabinGeometry.setSeatbeltSign(seatbeltPhases.includes(phase));
    }
    if (this.windowView) {
      this.windowView.setPhase(phase);
    }
  }

  startRender() {
    this._lastTime = performance.now();
    const loop = (time) => {
      this._animId = requestAnimationFrame(loop);
      const dt = Math.min((time - this._lastTime) / 1000, 0.05);
      this._lastTime = time;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  _update(dt) {
    if (this._lerpT < 1) {
      this._lerpT = Math.min(1, this._lerpT + dt / 2.0);
      const t = this._lerpT;
      const cur = this._currentLighting;
      const tgt = this._targetLighting;

      const lerpedDir = new THREE.Color(cur.dirColor).lerp(new THREE.Color(tgt.dirColor), t);
      const lerpedAmb = new THREE.Color(cur.ambColor).lerp(new THREE.Color(tgt.ambColor), t);

      if (this.dirLight) {
        this.dirLight.color.copy(lerpedDir);
        this.dirLight.intensity = cur.dirIntensity + (tgt.dirIntensity - cur.dirIntensity) * t;
      }
      if (this.ambLight) {
        this.ambLight.color.copy(lerpedAmb);
        this.ambLight.intensity = cur.ambIntensity + (tgt.ambIntensity - cur.ambIntensity) * t;
      }
      if (t >= 1) {
        this._currentLighting = { ...this._targetLighting };
      }
    }

    if (this.windowView) {
      this.windowView.update(dt);
      const yaw = this.cameraRig ? this.cameraRig.getYawFraction() : 0;
      this.windowView.setParallax(yaw);
    }

    if (this.cameraRig) this.cameraRig.update(dt);
    if (this.cabinGeometry) this.cabinGeometry.update(dt);
  }

  _onResize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setIFEEmissive(color) {
    if (this.ifeLight) this.ifeLight.color.set(color);
  }

  destroy() {
    if (this._animId) cancelAnimationFrame(this._animId);
    window.removeEventListener('resize', this._onResize);
    if (this.renderer) this.renderer.dispose();
  }
}
