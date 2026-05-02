import * as THREE from 'three';

const DEG = Math.PI / 180;
const MAX_YAW = 60 * DEG;
const MAX_PITCH = 30 * DEG;
const MIN_PITCH = -25 * DEG;
const LERP_SPEED = 0.08;
const AUTO_CENTER_DELAY = 8000;

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.basePosition = new THREE.Vector3(0, 0, 0);
    this.turbulenceIntensity = 0;
    this.turbulenceTime = 0;
    this.takeoffTilt = 0;
    this.isWalking = false;
    this.walkProgress = 0;
    this.walkDirection = 1;
    this.walkSpline = null;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._lastInteraction = Date.now();
    this._pointerIds = new Map();
    this._reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._bind();
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', e => this._onDown(e), { passive: true });
    el.addEventListener('pointermove', e => this._onMove(e), { passive: true });
    el.addEventListener('pointerup', e => this._onUp(e), { passive: true });
    el.addEventListener('pointercancel', e => this._onUp(e), { passive: true });
  }

  _onDown(e) {
    this._pointerIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointerIds.size === 1) {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    }
  }

  _onMove(e) {
    if (!this._dragging || this._pointerIds.size !== 1) return;
    if (!this._pointerIds.has(e.pointerId)) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this.targetYaw -= dx * 0.003;
    this.targetPitch -= dy * 0.003;
    this.targetYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, this.targetYaw));
    this.targetPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.targetPitch));
    this._lastInteraction = Date.now();
    this._pointerIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  _onUp(e) {
    this._pointerIds.delete(e.pointerId);
    if (this._pointerIds.size === 0) this._dragging = false;
  }

  startWalk() {
    if (this._reduceMotion) return;
    this.isWalking = true;
    this.walkProgress = 0;
    this.walkDirection = 1;
  }

  stopWalk() {
    this.isWalking = false;
    this.walkProgress = 0;
  }

  setTurbulence(intensity) {
    this.turbulenceIntensity = intensity;
  }

  setTakeoffTilt(angle) {
    this.takeoffTilt = angle;
  }

  update(dt) {
    if (this._reduceMotion) {
      this.currentYaw += (this.targetYaw - this.currentYaw) * LERP_SPEED;
      this.currentPitch += (this.targetPitch - this.currentPitch) * LERP_SPEED;
    } else {
      const autoCenterFactor = Date.now() - this._lastInteraction > AUTO_CENTER_DELAY ? 0.015 : 0;
      this.targetYaw += (0 - this.targetYaw) * autoCenterFactor;
      this.targetPitch += (0 - this.targetPitch) * autoCenterFactor;
      this.currentYaw += (this.targetYaw - this.currentYaw) * LERP_SPEED;
      this.currentPitch += (this.targetPitch - this.currentPitch) * LERP_SPEED;
    }

    this.turbulenceTime += dt;
    let turbYaw = 0, turbPitch = 0;
    if (!this._reduceMotion && this.turbulenceIntensity > 0) {
      const t = this.turbulenceTime;
      turbYaw = (Math.sin(t * 1.7) * 0.4 + Math.sin(t * 3.1) * 0.2) * this.turbulenceIntensity * 0.5 * DEG;
      turbPitch = (Math.sin(t * 2.3) * 0.4 + Math.sin(t * 1.1) * 0.2) * this.turbulenceIntensity * 0.5 * DEG;
    }

    let posX = this.basePosition.x;
    let posY = this.basePosition.y;
    let posZ = this.basePosition.z;
    let extraPitch = this.takeoffTilt * DEG;

    if (!this._reduceMotion && this.isWalking) {
      this.walkProgress = Math.min(1, this.walkProgress + dt / 20);
      const walkT = Math.sin(this.walkProgress * Math.PI);
      posZ = this.basePosition.z - walkT * 2.5;
      posY = this.basePosition.y + Math.sin(this.walkProgress * Math.PI * 4) * 0.04;
    }

    this.camera.position.set(posX, posY, posZ);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.currentYaw + turbYaw;
    this.camera.rotation.x = this.currentPitch + extraPitch + turbPitch;
    this.camera.rotation.z = turbYaw * 0.15;
  }

  getYawFraction() {
    return this.currentYaw / MAX_YAW;
  }
}
