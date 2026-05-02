import * as THREE from 'three';

// ── Texture helpers ──────────────────────────────────────────────────────────

function hexRGB(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function makePanelTex(base = '#d4d0c8') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const [r,g,b] = hexRGB(base);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const x = Math.random()*512, y = Math.random()*512, v = (Math.random()-0.5)*20;
    ctx.fillStyle = `rgba(${clamp255(r+v)},${clamp255(g+v)},${clamp255(b+v)},0.055)`;
    ctx.fillRect(x, y, 2, 2);
  }
  // Subtle horizontal panel lines
  ctx.strokeStyle = `rgba(${clamp255(r-12)},${clamp255(g-12)},${clamp255(b-12)},0.08)`;
  ctx.lineWidth = 1;
  for (let y = 0; y < 512; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(512,y); ctx.stroke(); }
  return new THREE.CanvasTexture(c);
}

function makeFabricTex(base = '#181c2c') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const [r,g,b] = hexRGB(base);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const warp = Math.sin(y * 1.2) * 0.5 + 0.5;
      const weft = Math.sin(x * 1.2) * 0.5 + 0.5;
      const v = (warp * weft - 0.5) * 16;
      if (Math.abs(v) > 2.5) {
        ctx.fillStyle = `rgba(${clamp255(r+v)},${clamp255(g+v)},${clamp255(b+v)},0.38)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return new THREE.CanvasTexture(c);
}

function makeCarpetTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0e18'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random()*256, y = Math.random()*256, v = Math.random()*22;
    ctx.fillStyle = `rgba(${v},${v},${v+10},${0.22+Math.random()*0.3})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = 'rgba(28,32,58,0.22)'; ctx.lineWidth = 2.5;
  for (let x = 0; x < 256; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,256); ctx.stroke(); }
  return new THREE.CanvasTexture(c);
}

function makeSeatbeltCanvas(active) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a20'; ctx.fillRect(0, 0, 128, 48);
  if (active) {
    ctx.fillStyle = '#ff8800'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8;
    ctx.fillText('FASTEN', 64, 19); ctx.fillText('SEAT BELT', 64, 34); ctx.shadowBlur = 0;
  }
  return new THREE.CanvasTexture(c);
}

// ── Shape helpers ─────────────────────────────────────────────────────────────

function rrShape(w, h, r) {
  r = Math.min(r, w * 0.499, h * 0.499);
  const s = new THREE.Shape();
  s.moveTo(-w/2+r, -h/2);
  s.lineTo( w/2-r, -h/2);  s.absarc( w/2-r, -h/2+r, r, -Math.PI/2, 0, false);
  s.lineTo( w/2,   h/2-r); s.absarc( w/2-r,  h/2-r, r, 0, Math.PI/2, false);
  s.lineTo(-w/2+r, h/2);   s.absarc(-w/2+r,  h/2-r, r, Math.PI/2, Math.PI, false);
  s.lineTo(-w/2,  -h/2+r); s.absarc(-w/2+r, -h/2+r, r, Math.PI, Math.PI*1.5, false);
  return s;
}

function ellipseShape(rx, ry, segs = 72) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, ry, 0, Math.PI*2, false, 0);
  return s;
}

// ── CabinGeometry ─────────────────────────────────────────────────────────────

export class CabinGeometry {
  constructor(scene, windowView, seatId = '1A') {
    this.scene         = scene;
    this.windowView    = windowView;
    this.seatId        = seatId;
    this.meshes        = {};
    this.hotspotMeshes = [];
    this.trayDeployed   = false;
    this.trayAnimating  = false;
    this.cubbyOpen      = false;
    this.seatbeltActive = false;
    this.seatbeltTex    = null;
    this.mealCard       = null;
    this._build();
  }

  _mat(color, roughness = 0.7, metalness = 0.0, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), roughness, metalness, side: THREE.DoubleSide, ...opts
    });
  }

  _build() {
    this._buildFuselage();
    this._buildWindows();
    this._buildSeatBack();
    this._buildIFE();
    this._buildTrayTable();
    this._buildConsole();
    this._buildCubby();
    this._buildOverhead();
    this._buildSeatHints();
  }

  // ── FUSELAGE ──────────────────────────────────────────────────────────────
  _buildFuselage() {
    const panelTex = makePanelTex('#d2cec6');
    panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping;
    panelTex.repeat.set(3, 2);

    // Curved cabin shell — open cylinder, BackSide = seen from inside
    const fusMat = new THREE.MeshStandardMaterial({
      map: panelTex, roughness: 0.80, metalness: 0.03, side: THREE.BackSide
    });
    const fus = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 2.55, 8.5, 96, 5, true, -Math.PI*0.53, Math.PI*1.06),
      fusMat
    );
    fus.position.set(0, -0.35, -1.8);
    this.scene.add(fus);
    this.meshes.fuselage = fus;

    // Dark navy carpet floor
    const carpetTex = makeCarpetTex();
    carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(2, 5);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 9, 1, 1),
      new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1.0, metalness: 0.0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.0, -2.0);
    this.scene.add(floor); this.meshes.floor = floor;

    // Ceiling panel — off-white matte composite
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.86, metalness: 0.0 });
    const ceilGeo = new THREE.ExtrudeGeometry(rrShape(2.9, 7.2, 0.30), {
      depth: 0.04, bevelEnabled: false, curveSegments: 40
    });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 2.05, -2.0);
    this.scene.add(ceil); this.meshes.ceiling = ceil;

    // Warm LED mood strips on ceiling (left and right edge)
    [-1.12, 1.12].forEach(side => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, 0.010, 6.2),
        new THREE.MeshStandardMaterial({
          color: 0xffe8c8, emissive: new THREE.Color('#ffd080'),
          emissiveIntensity: 0.80, roughness: 0.08, metalness: 0.22
        })
      );
      strip.position.set(side, 2.038, -2.0);
      this.scene.add(strip);
    });

    // Forward bulkhead (wall between suites — cream, rounded)
    const bulkGeo = new THREE.ExtrudeGeometry(rrShape(2.95, 2.15, 0.16), {
      depth: 0.055, bevelEnabled: false, curveSegments: 28
    });
    const bulkhead = new THREE.Mesh(bulkGeo, new THREE.MeshStandardMaterial({ color: 0xc2beb6, roughness: 0.88, metalness: 0.02 }));
    bulkhead.position.set(0, 1.04, -3.18);
    this.scene.add(bulkhead); this.meshes.bulkhead = bulkhead;

    // Footwell recess at base of seat-back in front
    const footwellMat = this._mat('#0c0c14', 0.95, 0.0);
    const footwell = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.90), footwellMat);
    footwell.position.set(0.05, 0.12, -1.42);
    this.scene.add(footwell); this.meshes.footwell = footwell;

    // Aisle floor glow strip (floor-level amber LED)
    const aisleGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.006, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x2a1400, emissive: new THREE.Color('#c04808'), emissiveIntensity: 0.28, roughness: 0.9 })
    );
    aisleGlow.position.set(-0.62, 0.003, -2.0);
    this.scene.add(aisleGlow);
  }

  // ── WINDOWS ───────────────────────────────────────────────────────────────
  _buildWindows() {
    [{ z: -0.44, y: 1.07 }, { z: -1.40, y: 1.07 }, { z: -2.22, y: 1.07 }].forEach((wp, i) => {
      this._buildSingleWindow(wp.z, wp.y, i);
    });
  }

  _buildSingleWindow(z, y, idx) {
    const WW = 0.55, WH = 0.44;
    const REVEAL = 0.28;
    const TILT_Y = Math.PI / 2 - 0.14;

    // Sky/view glass (uses WindowView canvas texture)
    const glassMat = new THREE.MeshBasicMaterial({ map: this.windowView.texture });
    const glassGeo = new THREE.ShapeGeometry(ellipseShape(WW/2, WH/2, 80), 80);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.rotation.y = TILT_Y;
    glass.position.set(-1.43, y, z);
    this.scene.add(glass);
    if (idx === 1) this.meshes.windowPane = glass;

    // Frame — cream panel with oval cutout, extruded for depth/reveal
    const outerShape = rrShape(WW + 0.20, WH + 0.20, 0.09);
    const holePath = new THREE.Path();
    holePath.absellipse(0, 0, WW/2 + 0.006, WH/2 + 0.006, 0, Math.PI*2, true);
    outerShape.holes.push(holePath);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xcecac2, roughness: 0.74, metalness: 0.05 });
    const frameGeo = new THREE.ExtrudeGeometry(outerShape, {
      depth: REVEAL + 0.02, bevelEnabled: false, curveSegments: 80
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.rotation.y = TILT_Y;
    frame.position.set(-1.29, y, z);
    this.scene.add(frame);

    // Reveal inner face (bright white) — the flat elliptical ring at the glass depth
    const revealRing = rrShape(WW + 0.19, WH + 0.19, 0.09);
    const revealHole = new THREE.Path();
    revealHole.absellipse(0, 0, WW/2, WH/2, 0, Math.PI*2, true);
    revealRing.holes.push(revealHole);
    const revGeo = new THREE.ShapeGeometry(revealRing, 64);
    const rev = new THREE.Mesh(revGeo, new THREE.MeshStandardMaterial({ color: 0xe0dcd4, roughness: 0.85, metalness: 0.0 }));
    rev.rotation.y = TILT_Y;
    rev.position.set(-1.285, y, z);
    this.scene.add(rev);

    // Window ambient bloom (subtle light glow around glass)
    const bloomGeo = new THREE.ShapeGeometry(ellipseShape((WW+0.18)/2, (WH+0.18)/2, 56));
    const bloom = new THREE.Mesh(bloomGeo, new THREE.MeshBasicMaterial({ color: 0x90b4d0, transparent: true, opacity: 0.10 }));
    bloom.rotation.y = TILT_Y;
    bloom.position.set(-1.26, y, z);
    this.scene.add(bloom);
  }

  // ── SEAT BACK ─────────────────────────────────────────────────────────────
  _buildSeatBack() {
    const fabricTex = makeFabricTex('#161a2a');
    fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
    fabricTex.repeat.set(2, 3);
    const fabricMat = new THREE.MeshStandardMaterial({ map: fabricTex, color: 0x141828, roughness: 0.93, metalness: 0.0 });
    const shellMat  = new THREE.MeshStandardMaterial({ color: 0x0c0e18, roughness: 0.40, metalness: 0.16 });
    const trimMat   = new THREE.MeshStandardMaterial({ color: 0x807868, roughness: 0.26, metalness: 0.72 });

    // Outer curved shell — rounded rect, extruded with bevel
    const shellGeo = new THREE.ExtrudeGeometry(rrShape(0.62, 1.12, 0.092), {
      depth: 0.115, bevelEnabled: true,
      bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 18, curveSegments: 56
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.rotation.x = Math.PI / 2;
    shell.position.set(0.04, 0.88, -1.92);
    this.scene.add(shell); this.meshes.seatShell = shell;

    // Upholstered front face
    const padGeo = new THREE.ExtrudeGeometry(rrShape(0.54, 0.98, 0.075), {
      depth: 0.046, bevelEnabled: true,
      bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 14, curveSegments: 48
    });
    const pad = new THREE.Mesh(padGeo, fabricMat);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(0.04, 0.89, -1.876);
    this.scene.add(pad);

    // Headrest — central cylinder
    const hrMat = new THREE.MeshStandardMaterial({ map: fabricTex, color: 0x141828, roughness: 0.93, metalness: 0.0 });
    const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.165, 56, 2), hrMat);
    hr.rotation.z = Math.PI / 2;
    hr.position.set(0.04, 1.42, -1.86);
    this.scene.add(hr);

    // Headrest wings (curved bolsters left and right)
    [-1, 1].forEach(side => {
      const wGeo = new THREE.ExtrudeGeometry(rrShape(0.12, 0.28, 0.04), {
        depth: 0.10, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 10, curveSegments: 40
      });
      const wing = new THREE.Mesh(wGeo, fabricMat);
      wing.rotation.set(Math.PI/2, 0, side > 0 ? -0.35 : 0.35);
      wing.position.set(0.04 + side * 0.265, 1.42, -1.89);
      this.scene.add(wing);
    });

    // Shell trim strip (silver edge around seat shell)
    const trimGeo = new THREE.TorusGeometry(0.316, 0.0065, 12, 120, Math.PI * 2);
    // Use a pair of silver horizontal bars at top & bottom instead
    [-0.555, 0.555].forEach(dy => {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.62, 16),
        trimMat
      );
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0.04, 0.88 + dy, -1.985);
      this.scene.add(bar);
    });

    // Privacy shell — left-side vertical divider
    const privGeo = new THREE.ExtrudeGeometry(rrShape(0.07, 1.18, 0.025), {
      depth: 0.92, bevelEnabled: false, curveSegments: 28
    });
    const priv = new THREE.Mesh(privGeo, new THREE.MeshStandardMaterial({ color: 0x0c0e18, roughness: 0.43, metalness: 0.14 }));
    priv.position.set(-0.37, 0.32, -2.36);
    this.scene.add(priv); this.meshes.privShell = priv;

    // Seat-number badge (like "1A" LED label in reference photos)
    const bc = document.createElement('canvas'); bc.width = 128; bc.height = 56;
    const bx = bc.getContext('2d');
    bx.fillStyle = '#060810'; bx.beginPath(); bx.roundRect(3,3,122,50,10); bx.fill();
    bx.fillStyle = '#4090ff'; bx.shadowColor = '#3080ff'; bx.shadowBlur = 18;
    bx.font = 'bold 26px Inter, sans-serif'; bx.textAlign = 'center'; bx.fillText(this.seatId, 64, 36);
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.044),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true })
    );
    badge.rotation.y = Math.PI;
    badge.position.set(0.04, 0.24, -1.86);
    this.scene.add(badge);
  }

  // ── IFE SCREEN ────────────────────────────────────────────────────────────
  _buildIFE() {
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x060610, roughness: 0.26, metalness: 0.45 });
    const armMat   = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.38, metalness: 0.58 });

    // Articulating arm — two segments like real IFE mount
    const armLow = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.32, 28), armMat);
    armLow.rotation.z = Math.PI / 5;
    armLow.position.set(-0.09, 1.10, -1.78);
    this.scene.add(armLow);

    const armHi = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.20, 24), armMat);
    armHi.rotation.z = -Math.PI / 14;
    armHi.position.set(0.02, 1.30, -1.70);
    this.scene.add(armHi);

    // IFE bezel — rounded rect housing
    const bezelShape = rrShape(0.66, 0.43, 0.038);
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.030, bevelEnabled: true,
      bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 10, curveSegments: 40
    });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.rotation.set(Math.PI/2, 0, 0.07);
    bezel.position.set(0.04, 1.315, -1.652);
    this.scene.add(bezel); this.meshes.ifeBezel = bezel;
    bezel.userData.hotspot = 'ife'; this.hotspotMeshes.push(bezel);

    // Screen canvas
    const sw = 1024, sh = 640;
    const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    this._drawIFECanvas(sc.getContext('2d'), sw, sh);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.59, 0.375),
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(sc),
        emissive: new THREE.Color('#0c1e4a'),
        emissiveIntensity: 1.15, roughness: 0.04
      })
    );
    screen.rotation.set(0, 0, 0.07);
    screen.position.set(0.04, 1.315, -1.638);
    this.scene.add(screen);
    this.meshes.ifeScreen = screen;
    screen.userData.hotspot = 'ife'; this.hotspotMeshes.push(screen);

    // Seatbelt sign (overhead panel)
    this.seatbeltTex = makeSeatbeltCanvas(false);
    const sbSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.068),
      new THREE.MeshStandardMaterial({
        map: this.seatbeltTex, emissive: 0xff8800,
        emissiveIntensity: 0, roughness: 0.3, side: THREE.DoubleSide
      })
    );
    sbSign.position.set(0.12, 1.982, -0.54);
    this.scene.add(sbSign); this.meshes.seatbeltSign = sbSign;
  }

  _drawIFECanvas(ctx, W, H) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#010c1e'); bg.addColorStop(1, '#020810');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // Status bar
    ctx.fillStyle = '#08162a'; ctx.fillRect(0, 0, W, 52);
    ctx.strokeStyle = 'rgba(240,192,64,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0,52); ctx.lineTo(W,52); ctx.stroke();
    ctx.fillStyle = '#f0c040'; ctx.font = '600 18px Inter,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('CABIN AIR', 22, 34);
    ctx.fillStyle = 'rgba(200,180,120,0.65)'; ctx.font = '500 14px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BUSINESS CLASS · GATE-TO-GATE', W/2, 34);
    ctx.fillStyle = 'rgba(180,190,220,0.40)'; ctx.font = '13px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('TAP TO OPEN  ▶', W-22, 34);
    // Logo
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0c040'; ctx.shadowColor = '#f0c040'; ctx.shadowBlur = 32;
    ctx.font = 'bold 100px "Instrument Serif",serif';
    ctx.fillText('CABIN', W/2, H/2 + 24); ctx.shadowBlur = 0;
    // Tagline
    ctx.fillStyle = 'rgba(200,178,100,0.55)'; ctx.font = '500 16px Inter,sans-serif';
    ctx.fillText('GATE · TO · GATE  PRODUCTIVITY', W/2, H/2 + 70);
    // Flight-path dots
    const dotY = H * 0.81;
    for (let i = 0; i < 11; i++) {
      const x = W*0.15 + i*(W*0.70/10);
      ctx.beginPath(); ctx.arc(x, dotY, i===5 ? 7 : 3.5, 0, Math.PI*2);
      ctx.fillStyle = `rgba(240,192,64,${i<=5?0.92:0.26})`; ctx.fill();
    }
    // Tab bar
    ctx.fillStyle = '#060e1e'; ctx.fillRect(0, H-62, W, 62);
    ctx.strokeStyle = 'rgba(240,192,64,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H-62); ctx.lineTo(W, H-62); ctx.stroke();
    ['MAP','CLOCK','TASKS','TAIL CAM'].forEach((t, i) => {
      ctx.fillStyle = 'rgba(240,192,64,0.55)'; ctx.font = '600 15px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(t, W*(i+0.5)/4, H-22);
    });
  }

  // ── TRAY TABLE ────────────────────────────────────────────────────────────
  _buildTrayTable() {
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x222018, roughness: 0.30, metalness: 0.30 });
    const trayGroup = new THREE.Group();
    const trayShape = rrShape(0.58, 0.42, 0.042);
    const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
      depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 10, curveSegments: 40
    });
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.rotation.x = Math.PI / 2;
    trayGroup.add(trayMesh);
    trayMesh.userData.hotspot = 'tray';

    trayGroup.position.set(0.0, 0.80, -1.72);
    trayGroup.rotation.x = -Math.PI / 2;
    this.scene.add(trayGroup);
    this.meshes.tray = trayGroup;
    trayGroup.userData.hotspot = 'tray';
    this.hotspotMeshes.push(trayMesh);

    // Notebook (hidden by default)
    const notebook = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.008, 0.16),
      this._mat('#f5f0e8', 0.88, 0.0)
    );
    notebook.position.set(-0.1, 0.654, -0.85);
    notebook.visible = false;
    this.scene.add(notebook);
    this.meshes.notebook = notebook;
    notebook.userData.hotspot = 'notebook';
    this.hotspotMeshes.push(notebook);

    this._trayStowedPos   = new THREE.Vector3(0, 0.80, -1.72);
    this._trayStowedRotX  = -Math.PI / 2;
    this._trayDeployedPos = new THREE.Vector3(0, 0.64, -0.88);
    this._trayDeployedRotX = 0;
  }

  // ── CONSOLE ───────────────────────────────────────────────────────────────
  _buildConsole() {
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x0e0e16, roughness: 0.50, metalness: 0.22 });
    const surfMat    = new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.26, metalness: 0.34 });
    const trimMat    = new THREE.MeshStandardMaterial({ color: 0x848070, roughness: 0.25, metalness: 0.75 });

    // Main console body — dark rounded block
    const bodyGeo = new THREE.ExtrudeGeometry(rrShape(0.46, 0.94, 0.058), {
      depth: 0.94, bevelEnabled: false, curveSegments: 48
    });
    const body = new THREE.Mesh(bodyGeo, consoleMat);
    body.rotation.set(0, 0, Math.PI/2);
    body.position.set(1.10, 0.46, -0.72);
    this.scene.add(body); this.meshes.consoleBody = body;

    // Console top surface (slightly glossy)
    const topGeo = new THREE.ExtrudeGeometry(rrShape(0.48, 0.96, 0.058), {
      depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 10, curveSegments: 40
    });
    const topSurf = new THREE.Mesh(topGeo, surfMat);
    topSurf.rotation.x = Math.PI/2;
    topSurf.position.set(0.89, 0.876, -0.72);
    this.scene.add(topSurf); this.meshes.consoleSurface = topSurf;

    // Silver trim rail (front edge)
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.95, 20), trimMat);
    rail.position.set(1.075, 0.46, -0.245);
    this.scene.add(rail);

    // Seat-control buttons — 4 rounded-square buttons with coloured LED
    const labels = ['Upright', 'Lounge', 'Bed', 'Lumbar'];
    const ledColors = [0xf0c040, 0x40cc80, 0x4090f0, 0xff5828];
    labels.forEach((lbl, i) => {
      const bGeo = new THREE.ExtrudeGeometry(rrShape(0.054, 0.054, 0.011), {
        depth: 0.014, bevelEnabled: true,
        bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 8, curveSegments: 24
      });
      const btn = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({
        color: 0x1c1c2c, roughness: 0.30, metalness: 0.80,
        emissive: 0x080812, emissiveIntensity: 0.3
      }));
      btn.rotation.set(Math.PI/2, 0, 0);
      btn.position.set(0.79, 0.83, -0.24 - i*0.115);
      this.scene.add(btn);
      btn.userData.hotspot = 'seatBtn'; btn.userData.btnIndex = i;
      btn.userData.btnLabel = lbl; btn.userData.baseY = btn.position.y;
      this.hotspotMeshes.push(btn); this.meshes[`seatBtn${i}`] = btn;

      // LED pip
      const led = new THREE.Mesh(
        new THREE.CircleGeometry(0.0085, 22),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(ledColors[i]),
          emissive: new THREE.Color(ledColors[i]),
          emissiveIntensity: 0.72, roughness: 0.18, metalness: 0.10
        })
      );
      led.position.set(0.788, 0.833, -0.24 - i*0.115);
      this.scene.add(led); this.meshes[`seatLed${i}`] = led;
    });

    // Amber under-light strip (like photos — warm LED under tray lip)
    const underLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.010, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x3a1600, emissive: new THREE.Color('#ff8c18'), emissiveIntensity: 0.52, roughness: 0.18 })
    );
    underLight.position.set(0.65, 0.46, -0.72);
    this.scene.add(underLight);
  }

  // ── CUBBY / STORAGE ───────────────────────────────────────────────────────
  _buildCubby() {
    const cubbyMat = this._mat('#121216', 0.88, 0.0);
    const doorMat  = new THREE.MeshStandardMaterial({ color: 0x1c1c28, roughness: 0.50, metalness: 0.20 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.27), cubbyMat);
    body.position.set(0.86, 0.53, -0.95);
    this.scene.add(body); this.meshes.cubbyBody = body;

    // Rounded door
    const doorGeo = new THREE.ExtrudeGeometry(rrShape(0.31, 0.23, 0.032), {
      depth: 0.025, bevelEnabled: false, curveSegments: 28
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.rotation.x = Math.PI/2;
    door.position.set(0.86, 0.53, -0.80);
    this.scene.add(door); this.meshes.cubbyDoor = door;
    door.userData.hotspot = 'cubbyDoor'; this.hotspotMeshes.push(door);
    this._cubbyDoorClosedY = door.position.y;

    // Handle bar
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065, 0.0065, 0.09, 20),
      new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.26, metalness: 0.88 })
    );
    handle.rotation.x = Math.PI/2; handle.position.set(0.86, 0.532, -0.787);
    this.scene.add(handle);

    // Bottle (hidden)
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.020, 0.12, 26),
      this._mat('#c8e6f5', 0.2, 0.0, { emissive: new THREE.Color('#a0c8e0'), emissiveIntensity: 0.12 })
    );
    bottle.position.set(0.80, 0.52, -0.95); bottle.visible = false;
    this.scene.add(bottle); this.meshes.bottle = bottle;
    bottle.userData.hotspot = 'bottle'; this.hotspotMeshes.push(bottle);

    // Headphones (hidden)
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 14, 36), this._mat('#2a2a32', 0.5, 0.4));
    band.position.set(0.93, 0.56, -0.95); band.rotation.y = Math.PI/2; band.visible = false;
    this.scene.add(band);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.078, 12), this._mat('#2a2a32', 0.5, 0.4));
    bar.rotation.z = Math.PI/2; bar.position.copy(band.position); bar.visible = false;
    this.scene.add(bar);
    this.meshes.headphones = { visible: false,
      set visible(v) { band.visible = v; bar.visible = v; },
      get visible() { return band.visible; }
    };
    band.userData.hotspot = 'headphones'; bar.userData.hotspot = 'headphones';
    this.hotspotMeshes.push(band, bar);
  }

  // ── OVERHEAD PSU ──────────────────────────────────────────────────────────
  _buildOverhead() {
    const psuMat = new THREE.MeshStandardMaterial({ color: 0xc4c0b8, roughness: 0.86, metalness: 0.02 });
    const psuGeo = new THREE.ExtrudeGeometry(rrShape(0.58, 0.32, 0.028), { depth: 0.026, bevelEnabled: false, curveSegments: 28 });
    const psu = new THREE.Mesh(psuGeo, psuMat);
    psu.rotation.x = Math.PI/2; psu.position.set(0.0, 2.028, -0.54);
    this.scene.add(psu); this.meshes.overhead = psu;

    // Air gasper (circular vent nozzle)
    const gasper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.023, 0.027, 0.04, 30),
      new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.28, metalness: 0.85 })
    );
    gasper.position.set(-0.13, 1.990, -0.54);
    this.scene.add(gasper); this.meshes.gasper = gasper;
    gasper.userData.hotspot = 'gasper'; this.hotspotMeshes.push(gasper);

    // Reading light nozzle
    const lightNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.033, 22), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.26, metalness: 0.82 }));
    lightNozzle.position.set(0.15, 1.990, -0.54); this.scene.add(lightNozzle);

    // Call button (amber/red indicator)
    const callBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.010, 22),
      new THREE.MeshStandardMaterial({ color: 0xcc2020, emissive: 0x881010, emissiveIntensity: 0.45, roughness: 0.28 })
    );
    callBtn.position.set(0.0, 1.990, -0.36); this.scene.add(callBtn);
  }

  // ── SEAT HINTS (your own seat) ────────────────────────────────────────────
  _buildSeatHints() {
    const armMat = new THREE.MeshStandardMaterial({ color: 0x7a7060, roughness: 0.50, metalness: 0.35 });
    const fabricMat = new THREE.MeshStandardMaterial({
      map: makeFabricTex('#14182a'), color: 0x14182a, roughness: 0.95, metalness: 0.0
    });

    // Armrests — rounded extrusions
    const armGeo = new THREE.ExtrudeGeometry(rrShape(0.155, 0.82, 0.032), {
      depth: 0.050, bevelEnabled: true, bevelThickness: 0.011, bevelSize: 0.011, bevelSegments: 12, curveSegments: 40
    });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.rotation.x = Math.PI/2; leftArm.position.set(-0.54, 0.645, -0.42);
    this.scene.add(leftArm); this.meshes.leftArm = leftArm;

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.rotation.x = Math.PI/2; rightArm.position.set(0.54, 0.645, -0.42);
    this.scene.add(rightArm); this.meshes.rightArm = rightArm;

    // Seat cushion
    const cushGeo = new THREE.ExtrudeGeometry(rrShape(0.72, 0.60, 0.065), {
      depth: 0.065, bevelEnabled: true, bevelThickness: 0.020, bevelSize: 0.020, bevelSegments: 14, curveSegments: 48
    });
    const cushion = new THREE.Mesh(cushGeo, fabricMat);
    cushion.rotation.x = Math.PI/2; cushion.position.set(0, 0.47, -0.18);
    this.scene.add(cushion);

    // White pillow
    const pillowGeo = new THREE.ExtrudeGeometry(rrShape(0.34, 0.26, 0.045), {
      depth: 0.108, bevelEnabled: true, bevelThickness: 0.026, bevelSize: 0.026, bevelSegments: 14, curveSegments: 40
    });
    const pillow = new THREE.Mesh(pillowGeo, new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.96, metalness: 0.0 }));
    pillow.rotation.set(Math.PI/2, 0, 0.16); pillow.position.set(-0.04, 0.56, 0.04);
    this.scene.add(pillow);

    // Seatbelt strap
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.005, 0.54),
      new THREE.MeshStandardMaterial({ color: 0x262432, roughness: 0.82, metalness: 0.22 })
    );
    belt.position.set(0.16, 0.465, -0.11); belt.rotation.z = 0.12;
    this.scene.add(belt);

    // Seat number on armrest
    const nc = document.createElement('canvas'); nc.width = 128; nc.height = 58;
    const nx = nc.getContext('2d');
    nx.fillStyle = '#070910'; nx.beginPath(); nx.roundRect(3,3,122,52,10); nx.fill();
    nx.fillStyle = '#5090ff'; nx.shadowColor = '#3878ee'; nx.shadowBlur = 18;
    nx.font = 'bold 28px Inter,sans-serif'; nx.textAlign = 'center'; nx.fillText(this.seatId, 64, 38);
    const numBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.090, 0.042),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true })
    );
    numBadge.rotation.x = -Math.PI/2 + 0.26; numBadge.position.set(-0.54, 0.664, -0.22);
    this.scene.add(numBadge);
  }

  // ── INTERACTION METHODS ───────────────────────────────────────────────────

  deployTray(instant = false) {
    if (this.trayDeployed || this.trayAnimating) return;
    this.trayAnimating = true;
    const tray = this.meshes.tray;
    if (instant) {
      tray.position.copy(this._trayDeployedPos);
      tray.rotation.x = this._trayDeployedRotX;
      this.trayDeployed = true; this.trayAnimating = false;
      if (this.meshes.notebook) this.meshes.notebook.visible = true;
      return;
    }
    const dur = 420, t0 = performance.now();
    const { x: spX, y: spY, z: spZ } = this._trayStowedPos;
    const { x: epX, y: epY, z: epZ } = this._trayDeployedPos;
    const srX = this._trayStowedRotX, erX = this._trayDeployedRotX;
    const anim = () => {
      const t = Math.min(1, (performance.now()-t0)/dur);
      const e = 1-Math.pow(1-t, 3);
      tray.position.set(spX+(epX-spX)*e, spY+(epY-spY)*e, spZ+(epZ-spZ)*e);
      tray.rotation.x = srX+(erX-srX)*e;
      if (t < 1) { requestAnimationFrame(anim); } else {
        this.trayDeployed = true; this.trayAnimating = false;
        if (this.meshes.notebook) this.meshes.notebook.visible = true;
      }
    };
    requestAnimationFrame(anim);
  }

  stowTray() {
    if (!this.trayDeployed || this.trayAnimating) return;
    this.trayAnimating = true;
    if (this.meshes.notebook) this.meshes.notebook.visible = false;
    const tray = this.meshes.tray;
    const dur = 360, t0 = performance.now();
    const { x: spX, y: spY, z: spZ } = this._trayDeployedPos;
    const { x: epX, y: epY, z: epZ } = this._trayStowedPos;
    const srX = this._trayDeployedRotX, erX = this._trayStowedRotX;
    const anim = () => {
      const t = Math.min(1, (performance.now()-t0)/dur);
      const e = 1-Math.pow(1-t, 3);
      tray.position.set(spX+(epX-spX)*e, spY+(epY-spY)*e, spZ+(epZ-spZ)*e);
      tray.rotation.x = srX+(erX-srX)*e;
      if (t < 1) { requestAnimationFrame(anim); } else { this.trayDeployed = false; this.trayAnimating = false; }
    };
    requestAnimationFrame(anim);
  }

  openCubby() {
    if (this.cubbyOpen) return;
    this.cubbyOpen = true;
    const door = this.meshes.cubbyDoor;
    const startY = door.position.y, t0 = performance.now();
    const anim = () => {
      const t = Math.min(1, (performance.now()-t0)/280);
      const e = 1-Math.pow(1-t, 3);
      door.position.y = startY + e * 0.22;
      if (t < 1) { requestAnimationFrame(anim); } else {
        door.visible = false;
        if (this.meshes.bottle) this.meshes.bottle.visible = true;
        if (this.meshes.headphones) this.meshes.headphones.visible = true;
      }
    };
    requestAnimationFrame(anim);
  }

  closeCubby() {
    if (!this.cubbyOpen) return;
    this.cubbyOpen = false;
    const door = this.meshes.cubbyDoor;
    door.visible = true;
    door.position.y = this._cubbyDoorClosedY + 0.22;
    if (this.meshes.bottle) this.meshes.bottle.visible = false;
    if (this.meshes.headphones) this.meshes.headphones.visible = false;
    const t0 = performance.now();
    const anim = () => {
      const t = Math.min(1, (performance.now()-t0)/280);
      const e = 1-Math.pow(1-t, 3);
      door.position.y = (this._cubbyDoorClosedY + 0.22) - e*0.22;
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  animateSeatBtn(idx) {
    const btn = this.meshes[`seatBtn${idx}`];
    if (!btn || btn._animating) return;
    btn._animating = true;
    const baseY = btn.userData.baseY;
    btn.position.y = baseY - 0.004;
    setTimeout(() => { btn.position.y = baseY; btn._animating = false; }, 120);
  }

  setSeatbeltSign(active) {
    if (this.seatbeltActive === active) return;
    this.seatbeltActive = active;
    this.seatbeltTex = makeSeatbeltCanvas(active);
    const sign = this.meshes.seatbeltSign;
    if (sign) {
      sign.material.map = this.seatbeltTex;
      sign.material.emissiveIntensity = active ? 0.9 : 0;
      sign.material.needsUpdate = true;
    }
  }

  showMealCard(meal) {
    if (this.mealCard) this.hideMealCard();
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f5f0e8'; ctx.fillRect(0, 0, 200, 200);
    ctx.beginPath(); ctx.arc(100, 100, 70, 0, Math.PI*2); ctx.fillStyle = '#e8e0d0'; ctx.fill();
    ctx.strokeStyle = '#ccc0a8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8B6040'; ctx.beginPath(); ctx.ellipse(85, 90, 22, 14, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#6B8A50'; ctx.beginPath(); ctx.ellipse(115, 100, 12, 18, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#C04030'; ctx.beginPath(); ctx.ellipse(100, 115, 14, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#334'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(meal.label || 'Meal service', 100, 186);
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, roughness: 0.8 });
    this.mealCard = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat);
    this.mealCard.position.set(0.05, 0.658, -0.88);
    this.mealCard.rotation.x = -Math.PI/2;
    this.scene.add(this.mealCard);
    this.mealCard.userData.hotspot = 'meal'; this.hotspotMeshes.push(this.mealCard);
    const t0 = performance.now();
    const fade = () => { const t = Math.min(1,(performance.now()-t0)/1200); mat.opacity = t*0.9; if(t<1) requestAnimationFrame(fade); };
    requestAnimationFrame(fade);
  }

  hideMealCard() {
    if (!this.mealCard) return;
    const idx = this.hotspotMeshes.indexOf(this.mealCard);
    if (idx >= 0) this.hotspotMeshes.splice(idx, 1);
    this.scene.remove(this.mealCard);
    this.mealCard = null;
  }

  update(dt) { /* per-frame hook */ }
}
