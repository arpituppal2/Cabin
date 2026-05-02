import * as THREE from 'three';

export class WindowView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 384;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.time = 0;
    this.cloudOffset = 0;
    this.phase = 'BOARDING';
    this.stars = this._generateStars(120);
    this.clouds = this._generateClouds(18);
    this.parallaxX = 0;
    this.groundPatches = this._generateGroundPatches(30);
    this.phaseProgress = 0;
  }

  _generateStars(n) {
    return Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random() * 0.7,
      r: Math.random() * 1.2 + 0.3,
      twinkle: Math.random() * Math.PI * 2
    }));
  }

  _generateClouds(n) {
    return Array.from({ length: n }, () => ({
      x: Math.random(),
      y: 0.3 + Math.random() * 0.5,
      rx: 60 + Math.random() * 100,
      ry: 18 + Math.random() * 28,
      opacity: 0.4 + Math.random() * 0.4,
      speed: 0.00004 + Math.random() * 0.00008,
      layer: Math.floor(Math.random() * 3)
    }));
  }

  _generateGroundPatches(n) {
    return Array.from({ length: n }, () => ({
      x: Math.random(),
      y: 0.65 + Math.random() * 0.35,
      w: 0.03 + Math.random() * 0.08,
      h: 0.02 + Math.random() * 0.04,
      color: Math.random() > 0.4 ? '#4a7c40' : '#8a7050'
    }));
  }

  setPhase(phase) {
    this.phase = phase;
  }

  setParallax(x) {
    this.parallaxX = x;
  }

  update(dt) {
    this.time += dt;
    this.cloudOffset += dt * 0.012;
    this._draw();
    this.texture.needsUpdate = true;
  }

  _getSkyColors() {
    const p = this.phase;
    if (p === 'BOARDING') return {
      top: '#0a0820', mid: '#2a1040', bottom: '#c84020'
    };
    if (p === 'TAXI') return {
      top: '#0a1428', mid: '#1a3060', bottom: '#4080c0'
    };
    if (p === 'TAKEOFF') return {
      top: '#0a1e40', mid: '#1a4080', bottom: '#60a0e0'
    };
    if (p === 'CRUISE') {
      const hour = (this.time * 0.0015) % 24;
      if (hour < 6) return { top: '#050510', mid: '#0a0a30', bottom: '#0a1040', isNight: true };
      if (hour < 8) return { top: '#1a0830', mid: '#601040', bottom: '#e05020' };
      if (hour < 17) return { top: '#0a2a6e', mid: '#1a4a9e', bottom: '#87ceeb' };
      if (hour < 19) return { top: '#1a0820', mid: '#a03010', bottom: '#f08020' };
      return { top: '#050510', mid: '#0a0a30', bottom: '#0a1040', isNight: true };
    }
    if (p === 'BREAK') return { top: '#0a2a6e', mid: '#1a4a9e', bottom: '#87ceeb' };
    if (p === 'DESCENT') return { top: '#0a2040', mid: '#2060a0', bottom: '#c07040' };
    if (p === 'LANDING') return { top: '#1a3020', mid: '#3a6040', bottom: '#80a060' };
    return { top: '#1a2030', mid: '#2a3848', bottom: '#c0b090' };
  }

  _draw() {
    const W = this.canvas.width, H = this.canvas.height;
    const ctx = this.ctx;
    const colors = this._getSkyColors();
    const parallax = this.parallaxX * 30;

    ctx.clearRect(0, 0, W, H);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.85);
    skyGrad.addColorStop(0, colors.top);
    skyGrad.addColorStop(0.55, colors.mid);
    skyGrad.addColorStop(1, colors.bottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    if (colors.isNight) {
      this.stars.forEach(s => {
        const twinkle = 0.6 + 0.4 * Math.sin(this.time * 1.5 + s.twinkle);
        ctx.beginPath();
        ctx.arc(s.x * W + parallax * 0.1, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.6 * twinkle})`;
        ctx.fill();
      });
    }

    if (this.phase === 'DESCENT' || this.phase === 'LANDING') {
      const groundY = this.phase === 'LANDING' ? H * 0.45 : H * 0.65;
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
      groundGrad.addColorStop(0, 'rgba(80,100,60,0)');
      groundGrad.addColorStop(0.15, 'rgba(80,100,60,0.8)');
      groundGrad.addColorStop(1, '#607040');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, W, H - groundY);

      this.groundPatches.forEach(patch => {
        const px = ((patch.x + this.time * 0.02) % 1.2 - 0.1) * W + parallax * 0.3;
        const py = groundY + patch.y * (H - groundY) * 0.6;
        ctx.fillStyle = patch.color;
        ctx.beginPath();
        ctx.ellipse(px, py, patch.w * W, patch.h * H * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    this.clouds.forEach(cloud => {
      const speed = cloud.speed * (cloud.layer + 1);
      const offsetFactor = 1 + cloud.layer * 0.5;
      const cx = ((cloud.x + this.cloudOffset * speed * 10 + parallax * 0.001 * offsetFactor) % 1.2 - 0.1) * W;
      const cy = cloud.y * H;
      const alpha = this.phase === 'LANDING' || this.phase === 'DESCENT'
        ? cloud.opacity * 0.5
        : cloud.opacity;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cloud.rx);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(230,235,245,0.5)');
      grad.addColorStop(1, 'rgba(200,210,230,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - cloud.rx * 0.3, cy - cloud.ry * 0.3, cloud.rx * 0.6, cloud.ry * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (this.phase === 'BOARDING') {
      ctx.fillStyle = 'rgba(80,80,90,0.7)';
      const bridgeX = W * 0.15 + parallax * 0.2;
      ctx.fillRect(bridgeX, H * 0.2, W * 0.35, H * 0.65);
      ctx.fillStyle = 'rgba(60,60,70,0.8)';
      ctx.fillRect(bridgeX + W * 0.05, H * 0.15, W * 0.04, H * 0.05);
      ctx.fillRect(bridgeX + W * 0.12, H * 0.15, W * 0.04, H * 0.05);
      ctx.fillStyle = 'rgba(100,100,110,0.5)';
      ctx.fillRect(bridgeX + W * 0.35, H * 0.35, W * 0.2, H * 0.5);

      ctx.fillStyle = 'rgba(20,20,30,0.7)';
      ctx.fillRect(0, H * 0.82, W, H * 0.18);
    }

    if (this.phase === 'TAXI') {
      const tarmacGrad = ctx.createLinearGradient(0, H * 0.7, 0, H);
      tarmacGrad.addColorStop(0, 'rgba(40,40,50,0)');
      tarmacGrad.addColorStop(0.2, '#282830');
      tarmacGrad.addColorStop(1, '#1e1e26');
      ctx.fillStyle = tarmacGrad;
      ctx.fillRect(0, H * 0.7, W, H * 0.3);

      for (let i = 0; i < 4; i++) {
        const lineX = ((i / 4 + this.time * 0.05) % 1.0) * W + parallax * 0.1;
        ctx.strokeStyle = 'rgba(255,220,0,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 40]);
        ctx.beginPath();
        ctx.moveTo(lineX, H * 0.82);
        ctx.lineTo(lineX + 30, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const vigGrad = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.8);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);
  }
}
