import * as THREE from 'three';

const W = 1024, H = 768;

export class WindowView {
  constructor(seatId = '1A') {
    this.seatId     = seatId || '1A';
    this.canvas     = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx        = this.canvas.getContext('2d');
    this.texture    = new THREE.CanvasTexture(this.canvas);
    this.time       = 0;
    this.cloudOff   = 0;
    this.phase      = 'BOARDING';
    this.parallaxX  = 0;
    this._frame     = 0;

    // Determine view type from seat
    const letter  = (seatId || '1A').replace(/[0-9]/g, '').toUpperCase();
    const row     = parseInt(seatId) || 1;
    this.isWindow = ['A', 'K', 'L', 'H'].includes(letter);
    // Business class is rows 1-8, typically AHEAD of wing on most wide-bodies
    // Seat 1-6: clear view (no wing), 7-14: wing visible, 15+: wing trailing
    this.wingMode = row <= 6 ? 'clear' : row <= 14 ? 'wing' : 'wing_trail';

    this._clouds = this._genClouds(14);
    this._stars  = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random() * 0.45,
      r: 0.4 + Math.random() * 1.8, tw: Math.random() * Math.PI * 2
    }));

    // Pre-draw initial frame immediately
    this._draw();
  }

  _genClouds(n) {
    return Array.from({ length: n }, () => ({
      x:      Math.random(),
      baseY:  0.52 + Math.random() * 0.30,
      scale:  0.6  + Math.random() * 2.2,
      speed:  0.00002 + Math.random() * 0.00005,
      op:     0.50 + Math.random() * 0.42,
      lobes:  Array.from({ length: 5 + Math.floor(Math.random() * 7) }, () => ({
        dx: (Math.random() - 0.5) * 180,
        dy: (Math.random() - 0.5) * 55,
        rx: 38 + Math.random() * 110,
        ry: 22 + Math.random() * 55,
        b:  0.78 + Math.random() * 0.22   // brightness
      }))
    }));
  }

  setPhase(p) { this.phase = p; }
  setParallax(x) { this.parallaxX = x; }

  update(dt) {
    this.time    += dt;
    this.cloudOff += dt * 0.007;
    this._frame++;
    if (this._frame % 2 === 0) {   // 30fps canvas redraw is plenty
      this._draw();
      this.texture.needsUpdate = true;
    }
  }

  // ── SKY COLOUR ─────────────────────────────────────────────────────────────
  _skyGrad(ctx) {
    const p = this.phase;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.48);
    if (p === 'BOARDING') {
      g.addColorStop(0, '#07050d'); g.addColorStop(0.6, '#18102a'); g.addColorStop(1, '#3c1c0e');
    } else if (p === 'TAXI') {
      g.addColorStop(0, '#050e1c'); g.addColorStop(0.5, '#0c2242'); g.addColorStop(1, '#1a5898');
    } else if (p === 'TAKEOFF') {
      g.addColorStop(0, '#04091c'); g.addColorStop(0.4, '#0e1e4e'); g.addColorStop(1, '#3880c4');
    } else if (p === 'CRUISE' || p === 'BREAK') {
      const hr = (this.time * 0.0008) % 24;
      if (hr < 5.5 || hr > 20.5) {
        g.addColorStop(0, '#010204'); g.addColorStop(0.5, '#030812'); g.addColorStop(1, '#060c20');
      } else if (hr < 7.5 || hr > 18.5) {
        g.addColorStop(0, '#0e0618'); g.addColorStop(0.45, '#8e2808'); g.addColorStop(1, '#f06420');
      } else {
        g.addColorStop(0, '#040e26'); g.addColorStop(0.35, '#0a2660'); g.addColorStop(1, '#3888d4');
      }
    } else if (p === 'DESCENT') {
      g.addColorStop(0, '#060a16'); g.addColorStop(0.4, '#163462'); g.addColorStop(1, '#5888aa');
    } else {
      g.addColorStop(0, '#0c1018'); g.addColorStop(0.4, '#243c2c'); g.addColorStop(1, '#607850');
    }
    return g;
  }

  _isNight() {
    if (this.phase === 'BOARDING') return true;
    if (this.phase !== 'CRUISE' && this.phase !== 'BREAK') return false;
    const hr = (this.time * 0.0008) % 24;
    return hr < 5.5 || hr > 20.5;
  }

  // ── CLOUD ──────────────────────────────────────────────────────────────────
  _drawCloud(ctx, cx, cy, cloud) {
    ctx.save();
    ctx.globalAlpha = cloud.op;
    // Draw from back (dark bottom lobes) to front (bright top lobes)
    const sorted = [...cloud.lobes].sort((a, b) => b.dy - a.dy);
    sorted.forEach(lobe => {
      const isTop  = lobe.dy <= 0;
      const bright = isTop ? lobe.b : lobe.b * 0.62;
      const bv     = Math.round(255 * bright);
      ctx.beginPath();
      ctx.ellipse(
        cx + lobe.dx, cy + lobe.dy,
        lobe.rx * cloud.scale, lobe.ry * cloud.scale * 0.42,
        0, 0, Math.PI * 2
      );
      const cg = ctx.createRadialGradient(
        cx + lobe.dx, cy + lobe.dy - lobe.ry * cloud.scale * 0.18, 0,
        cx + lobe.dx, cy + lobe.dy, lobe.rx * cloud.scale
      );
      cg.addColorStop(0,   `rgba(${bv},${bv},${Math.min(255,bv+4)},0.88)`);
      cg.addColorStop(0.45,`rgba(${Math.round(bv*0.87)},${Math.round(bv*0.89)},${Math.round(bv*0.94)},0.62)`);
      cg.addColorStop(1,   `rgba(${Math.round(bv*0.65)},${Math.round(bv*0.68)},${Math.round(bv*0.78)},0.0)`);
      ctx.fillStyle = cg;
      ctx.fill();
    });
    ctx.restore();
  }

  // ── WING ───────────────────────────────────────────────────────────────────
  _drawWing(ctx) {
    if (!this.isWindow) return;
    if (this.phase === 'BOARDING' || this.phase === 'TAXI') return;
    if (this.wingMode === 'clear') return;

    ctx.save();

    const wTop    = H * 0.68;
    const wBottom = H * 0.88;

    // Wing surface — angled perspective view (left = root/inboard, right = tip)
    const wingPath = () => {
      ctx.beginPath();
      ctx.moveTo(-30,  wBottom + 10);            // root, trailing
      ctx.lineTo(-30,  wTop + 22);               // root, leading
      ctx.lineTo(W * 0.50, wTop - 12);           // mid leading
      ctx.lineTo(W * 1.08, wTop + 2);            // tip leading
      ctx.lineTo(W * 1.08, wBottom + 14);        // tip trailing
      ctx.lineTo(W * 0.38, wBottom + 18);        // mid trailing
      ctx.closePath();
    };

    const wGrad = ctx.createLinearGradient(0, wTop - 10, 0, wBottom + 20);
    wGrad.addColorStop(0,   'rgba(188,192,198,0.97)');
    wGrad.addColorStop(0.38,'rgba(160,165,170,0.94)');
    wGrad.addColorStop(0.72,'rgba(130,135,140,0.90)');
    wGrad.addColorStop(1,   'rgba(100,104,108,0.78)');
    wingPath();
    ctx.fillStyle = wGrad;
    ctx.fill();

    // Leading-edge specular
    const speGrad = ctx.createLinearGradient(0, wTop-12, 0, wTop+28);
    speGrad.addColorStop(0,  'rgba(215,220,228,0.55)');
    speGrad.addColorStop(1,  'rgba(215,220,228,0)');
    wingPath();
    ctx.fillStyle = speGrad;
    ctx.fill();

    // Panel / rivet lines
    ctx.strokeStyle = 'rgba(105,110,115,0.28)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i <= 6; i++) {
      const lx = W * i * 0.16;
      const yt = wTop - 12 + i * 2.8;
      const yb = wBottom + 14 - i * 0.5;
      ctx.beginPath(); ctx.moveTo(lx, yt); ctx.lineTo(lx, yb); ctx.stroke();
    }

    // Engine (only for wing-row seats)
    if (this.wingMode === 'wing' || this.wingMode === 'wing_trail') {
      const engX = this.wingMode === 'wing' ? W * 0.28 : W * 0.42;
      this._drawEngine(ctx, engX, wTop - 18);
    }

    // Winglet (swept vertical fin at tip)
    ctx.fillStyle = 'rgba(178,182,188,0.92)';
    ctx.beginPath();
    ctx.moveTo(W * 0.93, wTop - 6);
    ctx.lineTo(W * 0.965, wTop - 52);
    ctx.lineTo(W * 0.980, wTop - 56);
    ctx.lineTo(W * 0.998, wTop - 28);
    ctx.lineTo(W * 0.998, wTop + 2);
    ctx.closePath();
    ctx.fill();
    // winglet highlight
    ctx.strokeStyle = 'rgba(210,215,222,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W*0.93, wTop - 6);
    ctx.lineTo(W*0.965, wTop - 52);
    ctx.stroke();

    ctx.restore();
  }

  _drawEngine(ctx, cx, wingTopY) {
    const eY = wingTopY + 18;
    const eH  = 60, eW = 78;

    // Pylon
    ctx.fillStyle = 'rgba(148,152,158,0.88)';
    ctx.beginPath();
    ctx.moveTo(cx - 9, wingTopY + 4);
    ctx.lineTo(cx + 9, wingTopY + 4);
    ctx.lineTo(cx + 7, eY);
    ctx.lineTo(cx - 7, eY);
    ctx.closePath(); ctx.fill();

    // Nacelle body
    const ng = ctx.createRadialGradient(cx - eW*0.14, eY + eH*0.38, 4, cx, eY + eH*0.5, eH);
    ng.addColorStop(0, 'rgba(94,98,104,1)');
    ng.addColorStop(0.5,'rgba(62,66,72,1)');
    ng.addColorStop(1,  'rgba(38,40,46,1)');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.ellipse(cx, eY + eH/2, eW/2, eH/2, 0, 0, Math.PI*2);
    ctx.fill();

    // Intake ring
    ctx.strokeStyle = 'rgba(118,122,128,0.82)';
    ctx.lineWidth = 3.5;
    const ix = cx - eW * 0.36;
    ctx.beginPath();
    ctx.ellipse(ix, eY + eH/2, eW*0.185, eH*0.44, 0, 0, Math.PI*2);
    ctx.stroke();

    // Intake dark centre
    const ig = ctx.createRadialGradient(ix, eY+eH/2, 0, ix, eY+eH/2, eH*0.40);
    ig.addColorStop(0,   'rgba(8,8,10,1)');
    ig.addColorStop(0.55,'rgba(22,24,28,1)');
    ig.addColorStop(1,   'rgba(55,58,64,0)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(ix, eY+eH/2, eW*0.185, eH*0.44, 0, 0, Math.PI*2);
    ctx.fill();

    // Fan blade motion blur
    ctx.save();
    ctx.translate(ix, eY + eH/2);
    ctx.globalAlpha = 0.18;
    const ba = this.time * 4.0;
    for (let b = 0; b < 14; b++) {
      ctx.save();
      ctx.rotate(ba + b * Math.PI / 7);
      ctx.fillStyle = 'rgba(75,80,86,1)';
      ctx.beginPath();
      ctx.ellipse(0, -eH*0.17, eH*0.038, eH*0.17, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Nacelle top highlight
    const nh = ctx.createLinearGradient(cx - eW/2, eY, cx + eW/2, eY + 18);
    nh.addColorStop(0, 'rgba(118,124,130,0.52)');
    nh.addColorStop(1, 'rgba(118,124,130,0)');
    ctx.fillStyle = nh;
    ctx.beginPath();
    ctx.ellipse(cx, eY + eH*0.18, eW*0.47, eH*0.18, 0, 0, Math.PI*2);
    ctx.fill();

    // Exhaust nozzle (rear)
    ctx.strokeStyle = 'rgba(52,55,60,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx + eW*0.38, eY + eH/2, eW*0.14, eH*0.30, 0, 0, Math.PI*2);
    ctx.stroke();
  }

  // ── MAIN DRAW ──────────────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // Sky
    ctx.fillStyle = this._skyGrad(ctx);
    ctx.fillRect(0, 0, W, H);

    const night = this._isNight();

    // Stars
    if (night) {
      this._stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 2.1 + s.tw);
        ctx.beginPath();
        ctx.arc(s.x * W + this.parallaxX * 12, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.70 * tw})`;
        ctx.fill();
      });
    }

    // ── Boarding: terminal/gate view ──
    if (this.phase === 'BOARDING') {
      // Tarmac
      ctx.fillStyle = 'rgba(30,30,38,0.88)';
      ctx.fillRect(0, H*0.38, W, H*0.62);
      // Terminal building
      ctx.fillStyle = 'rgba(50,52,62,0.92)';
      ctx.fillRect(W*0.06, H*0.14, W*0.50, H*0.28);
      // Jetway
      ctx.fillStyle = 'rgba(44,46,54,0.95)';
      ctx.fillRect(W*0.12, H*0.36, W*0.22, H*0.16);
      // Terminal windows (warm light)
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 10; col++) {
          const alpha = 0.35 + 0.28 * Math.sin(this.time * 0.4 + row * 1.8 + col);
          ctx.fillStyle = `rgba(240,200,80,${alpha})`;
          ctx.fillRect(W*(0.09 + col*0.049), H*(0.17 + row*0.072), W*0.032, H*0.044);
        }
      }
      // Ground
      ctx.fillStyle = 'rgba(26,26,34,0.92)';
      ctx.fillRect(0, H*0.76, W, H*0.24);
      // Runway markers
      ctx.strokeStyle = 'rgba(255,220,50,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const mx = W * (0.1 + i * 0.16);
        ctx.beginPath(); ctx.moveTo(mx, H*0.80); ctx.lineTo(mx + W*0.08, H*0.98); ctx.stroke();
      }
      this._vignette(ctx); return;
    }

    // ── Taxi: runway view ──
    if (this.phase === 'TAXI') {
      const tGrad = ctx.createLinearGradient(0, H*0.52, 0, H);
      tGrad.addColorStop(0, 'rgba(32,32,42,0.94)'); tGrad.addColorStop(1, '#1a1a24');
      ctx.fillStyle = tGrad; ctx.fillRect(0, H*0.52, W, H*0.48);
      ctx.strokeStyle = 'rgba(255,220,0,0.75)'; ctx.lineWidth = 2.5;
      ctx.setLineDash([28, 56]);
      for (let i = 0; i < 5; i++) {
        const lx = ((i / 5 + this.time * 0.07) % 1.0) * W;
        ctx.beginPath(); ctx.moveTo(lx, H*0.70); ctx.lineTo(lx + 38, H); ctx.stroke();
      }
      ctx.setLineDash([]);
      this._vignette(ctx); return;
    }

    // ── Horizon glow ──
    const horizY = H * 0.41;
    if (!night) {
      const hg = ctx.createLinearGradient(0, horizY - 50, 0, horizY + 100);
      hg.addColorStop(0,   'rgba(140,190,240,0)');
      hg.addColorStop(0.38,'rgba(168,212,255,0.32)');
      hg.addColorStop(0.68,'rgba(120,178,228,0.12)');
      hg.addColorStop(1,   'rgba(80,134,190,0)');
      ctx.fillStyle = hg; ctx.fillRect(0, horizY - 50, W, 150);
    }

    // ── Clouds (below horizon) ──
    const cloudBaseY = horizY + 14;
    this._clouds.forEach(cloud => {
      const cx = ((cloud.x + this.cloudOff * cloud.speed * 100) % 1.2 - 0.1) * W + this.parallaxX * 18;
      const cy = cloudBaseY + cloud.baseY * (H - cloudBaseY) * 0.82;
      if (cy < H * 0.98) this._drawCloud(ctx, cx, cy, cloud);
    });

    // ── Ground (descent / landing) ──
    if (this.phase === 'DESCENT' || this.phase === 'LANDING') {
      const gy = this.phase === 'LANDING' ? H * 0.52 : H * 0.66;
      const gg = ctx.createLinearGradient(0, gy, 0, H);
      gg.addColorStop(0,   'rgba(68,88,52,0)');
      gg.addColorStop(0.18,'rgba(72,92,56,0.90)');
      gg.addColorStop(1,   '#526040');
      ctx.fillStyle = gg; ctx.fillRect(0, gy, W, H - gy);
      ctx.fillStyle = 'rgba(80,102,65,0.45)';
      for (let f = 0; f < 14; f++) {
        const fx = ((f / 14 + this.time * 0.016) % 1.1 - 0.05) * W;
        const fy = gy + (0.08 + (f % 4) * 0.11) * (H - gy);
        ctx.beginPath(); ctx.ellipse(fx, fy, 52, 16, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Wing ──
    this._drawWing(ctx);

    // ── Horizon line ──
    if (!night) {
      ctx.strokeStyle = 'rgba(155,200,248,0.30)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, horizY); ctx.lineTo(W, horizY); ctx.stroke();
    }

    this._vignette(ctx);
  }

  _vignette(ctx) {
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.16, W/2, H/2, H*0.80);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
}
