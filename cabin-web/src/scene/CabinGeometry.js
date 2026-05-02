import * as THREE from 'three';

function makeMarbleTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d4cfc8';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(150,145,138,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    const x1 = Math.random() * 256, y1 = Math.random() * 256;
    const x2 = x1 + (Math.random() - 0.5) * 200, y2 = y1 + (Math.random() - 0.5) * 200;
    const cpx = (x1 + x2) / 2 + (Math.random() - 0.5) * 80;
    const cpy = (y1 + y2) / 2 + (Math.random() - 0.5) * 80;
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < 256; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
    }
    ctx.strokeStyle = `rgba(${80 + Math.random() * 30},${40 + Math.random() * 20},${20 + Math.random() * 10},0.25)`;
    ctx.lineWidth = 1 + Math.random();
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeSeatbeltCanvas(active) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a20';
  ctx.fillRect(0, 0, 128, 48);
  if (active) {
    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FASTEN', 64, 20);
    ctx.fillText('SEAT BELT', 64, 36);
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 8;
    ctx.fillText('SEAT BELT', 64, 36);
    ctx.shadowBlur = 0;
  }
  return new THREE.CanvasTexture(c);
}

export class CabinGeometry {
  constructor(scene, windowView, seatId = '1A') {
    this.scene = scene;
    this.windowView = windowView;
    this.seatId = seatId;
    this.meshes = {};
    this.hotspotMeshes = [];
    this.trayDeployed = false;
    this.trayAnimating = false;
    this.trayProgress = 0;
    this.cubbyOpen = false;
    this.mealCard = null;
    this.seatbeltActive = false;
    this.seatbeltTex = null;
    this._build();
  }

  _mat(color, roughness = 0.7, metalness = 0.0, map = null, emissive = 0, emissiveColor = '#000000') {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness, metalness,
      map: map || null,
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity: emissive
    });
  }

  _build() {
    const scene = this.scene;
    const isWindow = ['1A','1L'].includes(this.seatId);
    const windowSide = ['1A','2B','1D','2D'].includes(this.seatId) ? -1 : 1;

    this._buildFloor();
    this._buildSeat();
    this._buildIFE();
    this._buildConsole(windowSide);
    this._buildTrayTable();
    this._buildOverheadBin();
    this._buildWindow(windowSide);
    this._buildCubby(windowSide);
    this._buildAisle(windowSide);
    this._buildDuvet();
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(6, 8);
    const mat = this._mat('#1e1e2a', 1.0, 0.0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.9, 0);
    this.scene.add(mesh);
    this.meshes.floor = mesh;
  }

  _buildSeat() {
    const seatMat = this._mat('#1a1a20', 0.7, 0.1);
    const g = new THREE.Group();

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.1), seatMat);
    back.position.set(0, 0.25, -0.7);
    g.add(back);

    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.55), seatMat);
    pan.position.set(0, -0.32, -0.42);
    g.add(pan);

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.12), seatMat);
    headrest.position.set(0, 0.82, -0.67);
    g.add(headrest);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.5), seatMat);
    armL.position.set(-0.42, -0.12, -0.42);
    g.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.5), seatMat);
    armR.position.set(0.42, -0.12, -0.42);
    g.add(armR);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.4, 0.08), this._mat('#141418', 0.8, 0.05));
    shell.position.set(0, 0.2, -0.77);
    g.add(shell);

    g.position.set(0, -0.1, -0.3);
    this.scene.add(g);
    this.meshes.seatGroup = g;
  }

  _buildIFE() {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.6, 0.12),
      this._mat('#0d0d0f', 0.9)
    );
    column.position.set(0, 0.2, -1.4);
    this.scene.add(column);

    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.57, 0.06),
      this._mat('#0d0d0f', 0.9)
    );
    bezel.position.set(0, 0.55, -1.38);
    this.scene.add(bezel);
    this.meshes.ifeBezel = bezel;

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 480; screenCanvas.height = 300;
    const sctx = screenCanvas.getContext('2d');
    sctx.fillStyle = '#0a0a18';
    sctx.fillRect(0, 0, 480, 300);
    sctx.fillStyle = '#f0c040';
    sctx.font = 'bold 22px sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('CABIN', 240, 150);
    const screenTex = new THREE.CanvasTexture(screenCanvas);

    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: new THREE.Color('#102040'),
      emissiveIntensity: 0.5,
      roughness: 0.2
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.52), screenMat);
    screen.position.set(0, 0.55, -1.348);
    this.scene.add(screen);
    this.meshes.ifeScreen = screen;
    this.meshes.ifeScreenTex = screenTex;
    screen.userData.hotspot = 'ife';
    this.hotspotMeshes.push(screen);
    this.hotspotMeshes.push(bezel);
    bezel.userData.hotspot = 'ife';
  }

  _buildConsole(windowSide) {
    const consoleMat = new THREE.MeshStandardMaterial({
      map: makeMarbleTexture(),
      roughness: 0.3, metalness: 0.05
    });
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.7), consoleMat);
    console_.position.set(-windowSide * 0.62, -0.45, -0.5);
    this.scene.add(console_);
    this.meshes.console = console_;

    const kitMat = this._mat('#e8e0d5', 0.8, 0.0);
    const kit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.1), kitMat);
    kit.position.set(-windowSide * 0.62, -0.16, -0.4);
    this.scene.add(kit);
    this.meshes.amenityKit = kit;

    const labels = ['UP', 'LG', 'BD', 'LB'];
    labels.forEach((lbl, i) => {
      const btn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12),
        this._mat('#2a2a30', 0.5, 0.3, null, 0.15, '#6080ff')
      );
      btn.position.set(-windowSide * 0.62, -0.14, -0.62 + i * 0.065);
      btn.rotation.x = Math.PI / 2;
      this.scene.add(btn);
      btn.userData.hotspot = 'seatBtn';
      btn.userData.btnIndex = i;
      this.hotspotMeshes.push(btn);
      this.meshes[`seatBtn${i}`] = btn;
    });
  }

  _buildTrayTable() {
    const woodTex = makeWoodTexture();
    const trayMat = new THREE.MeshStandardMaterial({
      map: woodTex, roughness: 0.8, metalness: 0.0
    });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.42), trayMat);
    tray.position.set(0, -0.32, -1.15);
    tray.rotation.x = -Math.PI / 2;
    this.scene.add(tray);
    this.meshes.tray = tray;
    tray.userData.hotspot = 'tray';
    this.hotspotMeshes.push(tray);

    const notebook = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.005, 0.16),
      this._mat('#f5f0e8', 0.9, 0.0)
    );
    notebook.position.set(-0.12, -0.305, -1.1);
    notebook.visible = false;
    this.scene.add(notebook);
    this.meshes.notebook = notebook;
    notebook.userData.hotspot = 'notebook';
    this.hotspotMeshes.push(notebook);
  }

  _buildOverheadBin() {
    const binMat = this._mat('#b0adb8', 0.6, 0.0);
    const bin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5), binMat);
    bin.position.set(0, 1.3, -0.6);
    this.scene.add(bin);
    this.meshes.overheadBin = bin;

    const gasper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.04, 10),
      this._mat('#8a8a9a', 0.5, 0.5)
    );
    gasper.position.set(-0.2, 1.16, -0.5);
    this.scene.add(gasper);
    this.meshes.gasper = gasper;
    gasper.userData.hotspot = 'gasper';
    this.hotspotMeshes.push(gasper);

    this.seatbeltTex = makeSeatbeltCanvas(false);
    const sbSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.09),
      new THREE.MeshStandardMaterial({
        map: this.seatbeltTex,
        emissive: new THREE.Color('#ff8800'),
        emissiveIntensity: 0,
        roughness: 0.3
      })
    );
    sbSign.position.set(0.1, 1.16, -0.5);
    this.scene.add(sbSign);
    this.meshes.seatbeltSign = sbSign;
  }

  _buildWindow(windowSide) {
    const frameGeo = new THREE.BoxGeometry(0.08, 0.42, 0.06);
    const frameMat = this._mat('#8a8a9a', 0.4, 0.7);
    const frameGroup = new THREE.Group();

    [[-0.22, 0], [0.22, 0], [0, 0.22], [0, -0.22]].forEach(([dx, dy]) => {
      const frame = new THREE.Mesh(
        dx !== 0 ? new THREE.BoxGeometry(0.06, 0.48, 0.06) : new THREE.BoxGeometry(0.5, 0.06, 0.06),
        frameMat
      );
      frame.position.set(dx, dy, 0);
      frameGroup.add(frame);
    });

    const glassGeo = new THREE.PlaneGeometry(0.38, 0.38);
    const glassMat = new THREE.MeshStandardMaterial({
      map: this.windowView.texture,
      roughness: 0.1, metalness: 0.0,
      transparent: true, opacity: 0.95
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0, 0.02);
    frameGroup.add(glass);
    this.meshes.windowGlass = glass;

    const wallGeo = new THREE.BoxGeometry(0.08, 1.6, 0.5);
    const wallMat = this._mat('#1a1a22', 0.8, 0.0);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(-windowSide * 1.05, 0.3, -0.3);
    this.scene.add(wall);

    frameGroup.position.set(-windowSide * 1.01, 0.4, -0.45);
    this.scene.add(frameGroup);
    this.meshes.windowGroup = frameGroup;
    this.meshes.windowWall = wall;
  }

  _buildCubby(windowSide) {
    const cubbyBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.26, 0.22),
      this._mat('#161618', 0.8, 0.0)
    );
    cubbyBody.position.set(-windowSide * 0.62, 0.06, -0.62);
    this.scene.add(cubbyBody);
    this.meshes.cubbyBody = cubbyBody;

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.24, 0.02),
      this._mat('#1e1e24', 0.7, 0.1)
    );
    door.position.set(-windowSide * 0.62, 0.06, -0.5);
    this.scene.add(door);
    this.meshes.cubbyDoor = door;
    door.userData.hotspot = 'cubbyDoor';
    this.hotspotMeshes.push(door);

    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.1, 10),
      this._mat('#c8e6f5', 0.2, 0.0, null, 0.1, '#a0c8e0')
    );
    bottle.position.set(-windowSide * 0.66, 0.05, -0.61);
    bottle.visible = false;
    this.scene.add(bottle);
    this.meshes.bottle = bottle;
    bottle.userData.hotspot = 'bottle';
    this.hotspotMeshes.push(bottle);

    const hpRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.008, 8, 16),
      this._mat('#2a2a30', 0.5, 0.4)
    );
    hpRing.position.set(-windowSide * 0.56, 0.1, -0.61);
    hpRing.rotation.y = Math.PI / 2;
    hpRing.visible = false;
    this.scene.add(hpRing);
    this.meshes.headphones = hpRing;
    hpRing.userData.hotspot = 'headphones';
    this.hotspotMeshes.push(hpRing);
  }

  _buildAisle(windowSide) {
    const aisleMat = this._mat('#1e1e2a', 1.0, 0.0);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 8), aisleMat);
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(windowSide * 1.2, -0.9, -2);
    this.scene.add(aisle);
    this.meshes.aisle = aisle;

    const wallR = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2.4),
      this._mat('#1a1a22', 0.8, 0.0)
    );
    wallR.position.set(windowSide * 2.0, 0.3, -2);
    wallR.rotation.y = windowSide > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(wallR);
    this.meshes.wallR = wallR;

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 8),
      this._mat('#1a1a22', 0.7, 0.0)
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 1.5, -2);
    this.scene.add(ceiling);
    this.meshes.ceiling = ceiling;

    const ceilStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 6),
      this._mat('#e0d8c0', 0.4, 0.1, null, 0.3, '#fff5cc')
    );
    ceilStrip.rotation.x = Math.PI / 2;
    ceilStrip.position.set(0, 1.48, -2);
    this.scene.add(ceilStrip);
  }

  _buildDuvet() {
    const duvetMat = this._mat('#2a2a30', 0.9, 0.0);
    const duvet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.4), duvetMat);
    duvet.position.set(0.3, -0.88, -0.1);
    this.scene.add(duvet);
    this.meshes.duvet = duvet;
  }

  deployTray(instant = false) {
    if (this.trayDeployed || this.trayAnimating) return;
    this.trayAnimating = true;
    if (instant) {
      this.trayDeployed = true;
      this.trayAnimating = false;
      this.meshes.tray.rotation.x = 0;
      this.meshes.tray.position.set(0, -0.6, -1.1);
      if (this.meshes.notebook) this.meshes.notebook.visible = true;
      return;
    }
    const duration = 0.4;
    const start = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / (duration * 1000));
      const ease = 1 - Math.pow(1 - t, 3);
      this.meshes.tray.rotation.x = -Math.PI / 2 * (1 - ease);
      this.meshes.tray.position.y = -0.32 - ease * 0.28;
      this.meshes.tray.position.z = -1.15 + ease * 0.05;
      if (t < 1) requestAnimationFrame(animate);
      else {
        this.trayDeployed = true;
        this.trayAnimating = false;
        if (this.meshes.notebook) this.meshes.notebook.visible = true;
      }
    };
    requestAnimationFrame(animate);
  }

  stowTray() {
    if (!this.trayDeployed || this.trayAnimating) return;
    this.trayAnimating = true;
    if (this.meshes.notebook) this.meshes.notebook.visible = false;
    const duration = 0.35;
    const start = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / (duration * 1000));
      const ease = 1 - Math.pow(1 - t, 3);
      this.meshes.tray.rotation.x = -Math.PI / 2 * ease;
      this.meshes.tray.position.y = -0.6 + ease * 0.28;
      this.meshes.tray.position.z = -1.1 - ease * 0.05;
      if (t < 1) requestAnimationFrame(animate);
      else {
        this.trayDeployed = false;
        this.trayAnimating = false;
      }
    };
    requestAnimationFrame(animate);
  }

  openCubby() {
    if (this.cubbyOpen) return;
    this.cubbyOpen = true;
    const door = this.meshes.cubbyDoor;
    const start = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / 350);
      const ease = 1 - Math.pow(1 - t, 3);
      door.position.y = 0.06 + ease * 0.28;
      if (t < 1) requestAnimationFrame(animate);
      else {
        door.visible = false;
        if (this.meshes.bottle) this.meshes.bottle.visible = true;
        if (this.meshes.headphones) this.meshes.headphones.visible = true;
      }
    };
    requestAnimationFrame(animate);
  }

  closeCubby() {
    if (!this.cubbyOpen) return;
    this.cubbyOpen = false;
    const door = this.meshes.cubbyDoor;
    door.visible = true;
    door.position.y = 0.34;
    if (this.meshes.bottle) this.meshes.bottle.visible = false;
    if (this.meshes.headphones) this.meshes.headphones.visible = false;
    const start = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / 350);
      const ease = 1 - Math.pow(1 - t, 3);
      door.position.y = 0.34 - ease * 0.28;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  setSeatbeltSign(active) {
    if (this.seatbeltActive === active) return;
    this.seatbeltActive = active;
    const newTex = makeSeatbeltCanvas(active);
    const sign = this.meshes.seatbeltSign;
    if (sign) {
      sign.material.map = newTex;
      sign.material.emissiveIntensity = active ? 0.8 : 0;
      sign.material.needsUpdate = true;
    }
    this.seatbeltTex = newTex;
  }

  showMealCard(meal) {
    if (this.mealCard) this.hideMealCard();
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, 200, 200);
    ctx.beginPath();
    ctx.arc(100, 100, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e0d0';
    ctx.fill();
    ctx.strokeStyle = '#ccc0a8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8B6040';
    ctx.beginPath(); ctx.ellipse(85, 90, 22, 14, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6B8A50';
    ctx.beginPath(); ctx.ellipse(115, 100, 12, 18, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C04030';
    ctx.beginPath(); ctx.ellipse(100, 115, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#334';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(meal.label || 'Meal service', 100, 185);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(0.28, 0.28);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, opacity: 0,
      roughness: 0.8
    });
    this.mealCard = new THREE.Mesh(geo, mat);
    this.mealCard.position.set(0.1, -0.585, -1.08);
    this.mealCard.rotation.x = -Math.PI / 2;
    this.scene.add(this.mealCard);
    this.mealCard.userData.hotspot = 'meal';
    this.hotspotMeshes.push(this.mealCard);
    const start = performance.now();
    const fade = () => {
      const t = Math.min(1, (performance.now() - start) / 1200);
      this.mealCard.material.opacity = t * 0.95;
      if (t < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  hideMealCard() {
    if (!this.mealCard) return;
    const card = this.mealCard;
    this.hotspotMeshes = this.hotspotMeshes.filter(m => m !== card);
    this.mealCard = null;
    const start = performance.now();
    const fade = () => {
      const t = Math.min(1, (performance.now() - start) / 600);
      card.material.opacity = (1 - t) * 0.95;
      if (t < 1) requestAnimationFrame(fade);
      else this.scene.remove(card);
    };
    requestAnimationFrame(fade);
  }

  update(dt) {
  }
}
