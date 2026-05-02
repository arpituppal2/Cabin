import * as THREE from 'three';
import { CabinGeometry } from './CabinGeometry.js';
import { WindowView } from './WindowView.js';
import { CameraRig } from './CameraRig.js';

const PHASE_LIGHTING = {
  BOARDING: { ambColor: 0x2a2860, ambInt: 0.55, dirInt: 1.0 },
  TAXI:     { ambColor: 0x2a2860, ambInt: 0.58, dirInt: 1.05 },
  TAKEOFF:  { ambColor: 0x202060, ambInt: 0.60, dirInt: 1.15 },
  CRUISE:   { ambColor: 0x181840, ambInt: 0.45, dirInt: 1.2  },
  BREAK:    { ambColor: 0x181840, ambInt: 0.45, dirInt: 1.2  },
  DESCENT:  { ambColor: 0x1a1a40, ambInt: 0.50, dirInt: 1.1  },
  LANDING:  { ambColor: 0x2a2860, ambInt: 0.60, dirInt: 1.05 },
  ARRIVED:  { ambColor: 0x303060, ambInt: 0.70, dirInt: 0.95 },
};

export class CabinScene {
  constructor(canvas, seatId) {
    this.canvas  = canvas;
    this.seatId  = seatId || '1A';
    this._animId = null;
    this._phase  = 'BOARDING';
    this._lerpT  = 1;
    this._curLighting = null;
    this._tgtLighting = null;
    this._onResize = this._onResize.bind(this);
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene  = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05050f, 0.16);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.01, 30);
    this.camera.position.set(0, 0.9, 0);
    this.camera.lookAt(0, 0.85, -2.5);

    this._buildLighting();

    this.windowView   = new WindowView();
    this.cabinGeometry = new CabinGeometry(this.scene, this.windowView, this.seatId);
    this.cameraRig    = new CameraRig(this.camera, this.canvas);
    this.cameraRig.basePosition.set(0, 0.9, 0);

    const lp = PHASE_LIGHTING.BOARDING;
    this._curLighting = { ...lp };
    this._tgtLighting = { ...lp };
    this._applyLighting(lp);

    window.addEventListener('resize', this._onResize, { passive: true });
  }

  _buildLighting() {
    this.ambLight = new THREE.AmbientLight(0x2a2860, 0.55);
    this.scene.add(this.ambLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
    this.dirLight.position.set(2, 4, 3);
    this.scene.add(this.dirLight);

    this.consoleLamp = new THREE.PointLight(0xffe4a0, 0.75, 3.5);
    this.consoleLamp.position.set(0.88, 1.08, -0.3);
    this.scene.add(this.consoleLamp);

    this.overheadMood = new THREE.PointLight(0x4060ff, 0.2, 4.5);
    this.overheadMood.position.set(0, 1.88, -0.5);
    this.scene.add(this.overheadMood);

    this.ifeGlow = new THREE.PointLight(0xf0c040, 0.25, 3.0);
    this.ifeGlow.position.set(0, 0.9, -1.6);
    this.scene.add(this.ifeGlow);

    const fill = new THREE.PointLight(0xa0b8ff, 0.14, 5);
    fill.position.set(-1.0, 1.2, -1.0);
    this.scene.add(fill);
  }

  _applyLighting(p) {
    if (this.ambLight) {
      this.ambLight.color.setHex(p.ambColor);
      this.ambLight.intensity = p.ambInt;
    }
    if (this.dirLight) this.dirLight.intensity = p.dirInt;
  }

  setPhase(phase) {
    const tgt = PHASE_LIGHTING[phase] || PHASE_LIGHTING.CRUISE;
    this._tgtLighting = { ...tgt };
    this._curLighting = {
      ambColor: this.ambLight ? this.ambLight.color.getHex() : tgt.ambColor,
      ambInt:   this.ambLight ? this.ambLight.intensity : tgt.ambInt,
      dirInt:   this.dirLight ? this.dirLight.intensity : tgt.dirInt,
    };
    this._lerpT = 0;
    this._phase = phase;

    const sbOn = ['TAXI','TAKEOFF','DESCENT','LANDING'].includes(phase);
    if (this.cabinGeometry) this.cabinGeometry.setSeatbeltSign(sbOn);
    if (this.windowView)    this.windowView.setPhase(phase);

    if (phase === 'LANDING' || phase === 'ARRIVED') {
      this.consoleLamp.intensity = 0.45;
    } else {
      this.consoleLamp.intensity = 0.75;
    }
  }

  startRender() {
    this._onResize();
    let last = performance.now();
    const loop = (now) => {
      this._animId = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this._animId = requestAnimationFrame(loop);
  }

  _update(dt) {
    if (this._lerpT < 1) {
      this._lerpT = Math.min(1, this._lerpT + dt / 2.5);
      const t  = this._lerpT;
      const c  = this._curLighting, tg = this._tgtLighting;
      if (this.ambLight) {
        this.ambLight.color.lerp(new THREE.Color(tg.ambColor), t * 0.1);
        this.ambLight.intensity = c.ambInt + (tg.ambInt - c.ambInt) * t;
      }
      if (this.dirLight) {
        this.dirLight.intensity = c.dirInt + (tg.dirInt - c.dirInt) * t;
      }
    }
    if (this.windowView) {
      this.windowView.update(dt);
      if (this.cameraRig) this.windowView.setParallax(this.cameraRig.getYawFraction());
    }
    if (this.cameraRig)    this.cameraRig.update(dt);
    if (this.cabinGeometry) this.cabinGeometry.update(dt);
  }

  _onResize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    if (this._animId) cancelAnimationFrame(this._animId);
    window.removeEventListener('resize', this._onResize);
    if (this.renderer) this.renderer.dispose();
  }

  get hotspotMeshes()  { return this.cabinGeometry ? this.cabinGeometry.hotspotMeshes : []; }
  get cameraObject()   { return this.camera; }
}
