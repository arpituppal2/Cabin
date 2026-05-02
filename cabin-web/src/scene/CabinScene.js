import * as THREE from 'three';
import { CabinGeometry } from './CabinGeometry.js';
import { WindowView } from './WindowView.js';
import { CameraRig } from './CameraRig.js';

const PHASE_LIGHTING = {
  BOARDING: { ambColor: 0x1e1e30, ambInt: 0.72, dirInt: 0.95 },
  TAXI:     { ambColor: 0x1c1c2e, ambInt: 0.76, dirInt: 1.00 },
  TAKEOFF:  { ambColor: 0x181828, ambInt: 0.82, dirInt: 1.10 },
  CRUISE:   { ambColor: 0x141420, ambInt: 0.60, dirInt: 1.20 },
  BREAK:    { ambColor: 0x141420, ambInt: 0.60, dirInt: 1.20 },
  DESCENT:  { ambColor: 0x181828, ambInt: 0.66, dirInt: 1.10 },
  LANDING:  { ambColor: 0x1c1c2e, ambInt: 0.74, dirInt: 0.98 },
  ARRIVED:  { ambColor: 0x202030, ambInt: 0.85, dirInt: 0.90 },
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
    this.renderer.toneMappingExposure = 1.25;

    this.scene  = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x08081a, 0.11);

    // Wide-angle immersive FOV — shows the full cabin, windows clearly on each side
    this.camera = new THREE.PerspectiveCamera(110, 1, 0.01, 30);
    this.camera.position.set(0, 0.88, 0);
    this.camera.lookAt(0, 0.76, -2.5);

    this._buildLighting();

    this.windowView   = new WindowView(this.seatId);
    this.cabinGeometry = new CabinGeometry(this.scene, this.windowView, this.seatId);
    this.cameraRig    = new CameraRig(this.camera, this.canvas);
    this.cameraRig.basePosition.set(0, 0.88, 0);
    // Cached colour objects — avoids per-frame GC pressure
    this._lerpAmbColor = new THREE.Color();

    const lp = PHASE_LIGHTING.BOARDING;
    this._curLighting = { ...lp };
    this._tgtLighting = { ...lp };
    this._applyLighting(lp);

    window.addEventListener('resize', this._onResize, { passive: true });
  }

  _buildLighting() {
    // Ambient — neutral dark (cabin LEDs provide character lighting)
    this.ambLight = new THREE.AmbientLight(0x1e1e30, 0.72);
    this.scene.add(this.ambLight);

    // Main directional — warm daylight from window side (left/above)
    this.dirLight = new THREE.DirectionalLight(0xfff8f0, 1.0);
    this.dirLight.position.set(-2.5, 3.5, 1.5);
    this.scene.add(this.dirLight);

    // Overhead LED strip light — warm amber, runs along ceiling centreline
    this.ceilLamp = new THREE.PointLight(0xffd880, 0.55, 5.5);
    this.ceilLamp.position.set(0, 2.0, -1.5);
    this.scene.add(this.ceilLamp);

    // Console under-light glow — signature amber LED strip
    this.consoleLamp = new THREE.PointLight(0xff9820, 0.80, 2.8);
    this.consoleLamp.position.set(0.72, 0.60, -0.55);
    this.scene.add(this.consoleLamp);

    // IFE screen glow (blue-white)
    this.ifeGlow = new THREE.PointLight(0xc8d8ff, 0.30, 2.8);
    this.ifeGlow.position.set(0.04, 1.30, -1.52);
    this.scene.add(this.ifeGlow);

    // Window fill — cool blue-white light from left (daylight through windows)
    const winFill = new THREE.PointLight(0xb8d0f0, 0.22, 4.5);
    winFill.position.set(-1.35, 1.1, -1.0);
    this.scene.add(winFill);

    // Soft warm fill from below seat (uplight from footwell LED)
    const footFill = new THREE.PointLight(0xffa030, 0.06, 1.8);
    footFill.position.set(-0.55, 0.08, -1.8);
    this.scene.add(footFill);
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
        // Reuse cached colour — no GC churn every frame
        this._lerpAmbColor.setHex(tg.ambColor);
        this.ambLight.color.lerp(this._lerpAmbColor, t * 0.1);
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
