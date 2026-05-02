import * as THREE from 'three';

function makeWoodTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3520'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 48; i++) {
    const y = (i / 48) * 256;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x < 256; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + i * 1.3) * 2.2);
    ctx.strokeStyle = `rgba(${70+Math.random()*25},${28+Math.random()*18},${10+Math.random()*8},0.28)`;
    ctx.lineWidth = 0.9 + Math.random();
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeMarbleTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8c0b8'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(150,145,138,0.3)'; ctx.lineWidth = 1.1;
  for (let i = 0; i < 20; i++) {
    const x1 = Math.random()*256, y1 = Math.random()*256;
    const x2 = x1+(Math.random()-0.5)*200, y2 = y1+(Math.random()-0.5)*200;
    const cpx = (x1+x2)/2+(Math.random()-0.5)*80, cpy = (y1+y2)/2+(Math.random()-0.5)*80;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cpx,cpy,x2,y2); ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeSeatbeltCanvas(active) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a20'; ctx.fillRect(0, 0, 128, 48);
  if (active) {
    ctx.fillStyle = '#ff8800'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8;
    ctx.fillText('FASTEN', 64, 19); ctx.fillText('SEAT BELT', 64, 34);
    ctx.shadowBlur = 0;
  }
  return new THREE.CanvasTexture(c);
}

export class CabinGeometry {
  constructor(scene, windowView, seatId = '1A') {
    this.scene      = scene;
    this.windowView = windowView;
    this.seatId     = seatId;
    this.meshes     = {};
    this.hotspotMeshes  = [];
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
      color: new THREE.Color(color),
      roughness, metalness,
      side: THREE.DoubleSide,
      ...opts
    });
  }

  _build() {
    this._buildStructure();
    this._buildIFE();
    this._buildTrayTable();
    this._buildConsole();
    this._buildWindow();
    this._buildCubby();
    this._buildOverhead();
    this._buildSeatHints();
  }

  _buildStructure() {
    const wallMat  = this._mat('#1c1c24', 0.75, 0.03);
    const floorMat = this._mat('#1e1e2a', 1.0, 0.0);
    const ceilMat  = this._mat('#1a1a22', 0.70, 0.02);
    const partMat  = this._mat('#161620', 0.80, 0.02);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 6.0), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -1.5);
    this.scene.add(floor); this.meshes.floor = floor;

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 6.0), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 2.05, -1.5);
    this.scene.add(ceil); this.meshes.ceiling = ceil;

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 2.4), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(1.35, 1.1, -1.5);
    this.scene.add(rightWall); this.meshes.rightWall = rightWall;

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 2.4), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-1.0, 1.1, -1.5);
    this.scene.add(leftWall); this.meshes.leftWall = leftWall;

    const partition = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.6), partMat);
    partition.position.set(0, 1.1, -2.08);
    this.scene.add(partition); this.meshes.partition = partition;

    const ceilStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 4.5),
      this._mat('#e8e0c0', 0.35, 0.1, { emissive: new THREE.Color('#fff8e0'), emissiveIntensity: 0.28 })
    );
    ceilStrip.rotation.x = Math.PI / 2;
    ceilStrip.position.set(0, 2.04, -1.5);
    this.scene.add(ceilStrip);

    const footwellMat = this._mat('#141418', 0.9, 0.0);
    const footwell = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.7), footwellMat);
    footwell.position.set(0, 0.07, -1.05);
    this.scene.add(footwell); this.meshes.footwell = footwell;
  }

  _buildIFE() {
    const bezelMat = this._mat('#0d0d0f', 0.9, 0.05);

    const column = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), bezelMat);
    column.position.set(0, 0.45, -1.9);
    this.scene.add(column); this.meshes.ifeColumn = column;

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.66, 0.07), bezelMat);
    bezel.position.set(0, 0.88, -1.91);
    this.scene.add(bezel);
    this.meshes.ifeBezel = bezel;
    bezel.userData.hotspot = 'ife';
    this.hotspotMeshes.push(bezel);

    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.008, 0.04),
      this._mat('#c8a030', 0.4, 0.6, { emissive: new THREE.Color('#f0c040'), emissiveIntensity: 0.8 })
    );
    ledStrip.position.set(0, 0.57, -1.88);
    this.scene.add(ledStrip);

    const sw = 480, sh = 300;
    const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    const sctx = sc.getContext('2d');
    const grad = sctx.createLinearGradient(0, 0, 0, sh);
    grad.addColorStop(0, '#020818'); grad.addColorStop(1, '#050614');
    sctx.fillStyle = grad; sctx.fillRect(0, 0, sw, sh);

    sctx.strokeStyle = 'rgba(240,192,64,0.45)'; sctx.lineWidth = 2;
    sctx.strokeRect(12, 12, sw - 24, sh - 24);
    sctx.strokeStyle = 'rgba(240,192,64,0.12)'; sctx.lineWidth = 1;
    sctx.strokeRect(18, 18, sw - 36, sh - 36);

    sctx.fillStyle = '#f0c040';
    sctx.font = 'bold 52px sans-serif'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
    sctx.shadowColor = '#f0c040'; sctx.shadowBlur = 24;
    sctx.fillText('CABIN', sw/2, 100); sctx.shadowBlur = 0;

    sctx.fillStyle = 'rgba(240,192,64,0.55)';
    sctx.font = '500 14px sans-serif';
    sctx.fillText('CLICK TO OPEN IFE', sw/2, 170);

    sctx.fillStyle = 'rgba(255,255,255,0.18)';
    sctx.font = '12px sans-serif';
    sctx.fillText('MAP  ·  TASKS  ·  CLOCK  ·  TAIL CAM', sw/2, 212);

    sctx.strokeStyle = 'rgba(255,255,255,0.04)';
    sctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      sctx.beginPath(); sctx.moveTo(i * sw/4, sh/2); sctx.lineTo(i * sw/4, sh - 30); sctx.stroke();
    }
    sctx.fillStyle = 'rgba(240,192,64,0.3)'; sctx.font = '10px sans-serif';
    ['MAP','CLOCK','TASKS','TAIL CAM'].forEach((t, i) => {
      sctx.fillText(t, (i + 0.5) * sw/4, sh - 16);
    });

    const screenTex = new THREE.CanvasTexture(sc);
    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: new THREE.Color('#1a3060'),
      emissiveIntensity: 1.3,
      roughness: 0.04,
      side: THREE.DoubleSide
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 0.58), screenMat);
    screen.position.set(0, 0.88, -1.877);
    this.scene.add(screen);
    this.meshes.ifeScreen = screen;
    screen.userData.hotspot = 'ife';
    this.hotspotMeshes.push(screen);
  }

  _buildTrayTable() {
    const woodTex = makeWoodTexture();
    const trayTopMat = new THREE.MeshStandardMaterial({
      map: woodTex, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide
    });
    const trayBotMat = this._mat('#1a1a1e', 0.9, 0.0);

    const trayGroup = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.025, 0.42), trayTopMat);
    top.position.set(0, 0.012, 0);
    trayGroup.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.012, 0.42), trayBotMat);
    bot.position.set(0, -0.006, 0);
    trayGroup.add(bot);

    trayGroup.position.set(0, 0.80, -1.68);
    trayGroup.rotation.x = -Math.PI / 2;
    this.scene.add(trayGroup);
    this.meshes.tray = trayGroup;
    trayGroup.userData.hotspot = 'tray';
    this.hotspotMeshes.push(trayGroup.children[0]);
    trayGroup.children[0].userData.hotspot = 'tray';

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

    this._trayStowedPos  = new THREE.Vector3(0, 0.80, -1.68);
    this._trayStowedRotX = -Math.PI / 2;
    this._trayDeployedPos  = new THREE.Vector3(0, 0.64, -0.88);
    this._trayDeployedRotX = 0;
  }

  _buildConsole() {
    const consoleMat = new THREE.MeshStandardMaterial({
      map: makeMarbleTexture(), roughness: 0.28, metalness: 0.06, side: THREE.DoubleSide
    });
    const darkMat = this._mat('#111115', 0.85, 0.0);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.78, 1.0), consoleMat);
    body.position.set(0.86, 0.39, -0.52);
    this.scene.add(body); this.meshes.consoleBody = body;

    const surface = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.0), consoleMat);
    surface.position.set(0.86, 0.79, -0.52);
    this.scene.add(surface); this.meshes.consoleSurface = surface;

    const innerBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.06), darkMat);
    innerBack.position.set(0.86, 0.39, -1.01);
    this.scene.add(innerBack);

    const labels = ['Upright', 'Lounge', 'Bed', 'Lumbar'];
    const btnColors = ['#2a2a3a','#252535','#222230','#202030'];
    labels.forEach((lbl, i) => {
      const btn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.016, 16),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(btnColors[i]),
          roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide
        })
      );
      btn.position.set(0.8, 0.815, -0.22 - i * 0.115);
      btn.rotation.x = Math.PI / 2;
      this.scene.add(btn);
      btn.userData.hotspot = 'seatBtn';
      btn.userData.btnIndex = i;
      btn.userData.btnLabel = lbl;
      btn.userData.baseY = btn.position.y;
      this.hotspotMeshes.push(btn);
      this.meshes[`seatBtn${i}`] = btn;
    });
  }

  _buildWindow() {
    const frameMat = this._mat('#8a8a9a', 0.35, 0.75);

    const frameGroup = new THREE.Group();
    const frameH = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.055, 0.055), frameMat);
    frameH.position.y =  0.265; frameGroup.add(frameH.clone());
    frameH.position.y = -0.265; frameGroup.add(frameH);
    const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.585, 0.055), frameMat);
    frameV.position.x =  0.38; frameGroup.add(frameV.clone());
    frameV.position.x = -0.38; frameGroup.add(frameV);

    const glassMat = new THREE.MeshBasicMaterial({
      map: this.windowView.texture,
      side: THREE.FrontSide
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 0.50), glassMat);
    glass.position.set(0, 0, 0.02);
    frameGroup.add(glass);
    this.meshes.windowPane = glass;

    frameGroup.position.set(-0.70, 0.88, -0.62);
    frameGroup.rotation.y = 0.22;
    this.scene.add(frameGroup);
    this.meshes.windowGroup = frameGroup;

    const innerReveal = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.62, 0.55),
      this._mat('#222228', 0.7, 0.05)
    );
    innerReveal.position.set(-0.75, 0.88, -0.35);
    innerReveal.rotation.y = 0.22;
    this.scene.add(innerReveal);
  }

  _buildCubby() {
    const cubbyMat = this._mat('#161618', 0.85, 0.0);
    const doorMat  = this._mat('#1e1e26', 0.72, 0.08);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.28), cubbyMat);
    body.position.set(0.86, 0.52, -0.90);
    this.scene.add(body); this.meshes.cubbyBody = body;

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.03), doorMat);
    door.position.set(0.86, 0.52, -0.765);
    this.scene.add(door);
    this.meshes.cubbyDoor = door;
    door.userData.hotspot = 'cubbyDoor';
    this.hotspotMeshes.push(door);
    this._cubbyDoorClosedY = door.position.y;

    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.12, 10),
      this._mat('#c8e6f5', 0.2, 0.0, { emissive: new THREE.Color('#a0c8e0'), emissiveIntensity: 0.12 })
    );
    bottle.position.set(0.80, 0.51, -0.90);
    bottle.visible = false;
    this.scene.add(bottle);
    this.meshes.bottle = bottle;
    bottle.userData.hotspot = 'bottle';
    this.hotspotMeshes.push(bottle);

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.008, 8, 20),
      this._mat('#2a2a32', 0.5, 0.4)
    );
    band.position.set(0.93, 0.55, -0.90);
    band.rotation.y = Math.PI / 2;
    band.visible = false;
    this.scene.add(band);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.078, 6), this._mat('#2a2a32', 0.5, 0.4));
    bar.rotation.z = Math.PI / 2;
    bar.position.copy(band.position);
    bar.visible = false;
    this.scene.add(bar);
    this.meshes.headphones = { visible: false,
      set visible(v) { band.visible = v; bar.visible = v; },
      get visible() { return band.visible; }
    };
    band.userData.hotspot = 'headphones';
    bar.userData.hotspot  = 'headphones';
    this.hotspotMeshes.push(band); this.hotspotMeshes.push(bar);
  }

  _buildOverhead() {
    const binMat = this._mat('#b0adb8', 0.58, 0.08);
    const bin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.32, 0.65), binMat);
    bin.position.set(0, 1.70, -0.65);
    this.scene.add(bin); this.meshes.overheadBin = bin;

    const binFront = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 0.32), this._mat('#9a97a2', 0.6, 0.06));
    binFront.position.set(0, 1.70, -0.325);
    this.scene.add(binFront);

    const gasper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.04, 10),
      this._mat('#8a8a9a', 0.45, 0.55)
    );
    gasper.position.set(-0.18, 1.546, -0.65);
    this.scene.add(gasper);
    this.meshes.gasper = gasper;
    gasper.userData.hotspot = 'gasper';
    this.hotspotMeshes.push(gasper);

    this.seatbeltTex = makeSeatbeltCanvas(false);
    const sbSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.09),
      new THREE.MeshStandardMaterial({
        map: this.seatbeltTex,
        emissive: new THREE.Color('#ff8800'),
        emissiveIntensity: 0,
        roughness: 0.3, side: THREE.DoubleSide
      })
    );
    sbSign.position.set(0.12, 1.546, -0.65);
    this.scene.add(sbSign);
    this.meshes.seatbeltSign = sbSign;
  }

  _buildSeatHints() {
    const seatMat = this._mat('#1a1a20', 0.65, 0.08);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.38), seatMat);
    leftArm.position.set(-0.36, 0.68, 0.08);
    this.scene.add(leftArm); this.meshes.leftArm = leftArm;

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.38), seatMat);
    rightArm.position.set(0.36, 0.68, 0.08);
    this.scene.add(rightArm); this.meshes.rightArm = rightArm;

    const headPad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.04), seatMat);
    headPad.position.set(0, 0.90, 0.22);
    this.scene.add(headPad); this.meshes.headPad = headPad;
  }

  deployTray(instant = false) {
    if (this.trayDeployed || this.trayAnimating) return;
    this.trayAnimating = true;
    const tray = this.meshes.tray;
    if (instant) {
      tray.position.copy(this._trayDeployedPos);
      tray.rotation.x = this._trayDeployedRotX;
      this.trayDeployed  = true;
      this.trayAnimating = false;
      if (this.meshes.notebook) this.meshes.notebook.visible = true;
      return;
    }
    const dur = 400, t0 = performance.now();
    const spX = this._trayStowedPos.x, spY = this._trayStowedPos.y, spZ = this._trayStowedPos.z;
    const epX = this._trayDeployedPos.x, epY = this._trayDeployedPos.y, epZ = this._trayDeployedPos.z;
    const srX = this._trayStowedRotX, erX = this._trayDeployedRotX;
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      tray.position.set(spX + (epX-spX)*e, spY + (epY-spY)*e, spZ + (epZ-spZ)*e);
      tray.rotation.x = srX + (erX - srX) * e;
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
    const dur = 350, t0 = performance.now();
    const spX = this._trayDeployedPos.x, spY = this._trayDeployedPos.y, spZ = this._trayDeployedPos.z;
    const epX = this._trayStowedPos.x, epY = this._trayStowedPos.y, epZ = this._trayStowedPos.z;
    const srX = this._trayDeployedRotX, erX = this._trayStowedRotX;
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      tray.position.set(spX + (epX-spX)*e, spY + (epY-spY)*e, spZ + (epZ-spZ)*e);
      tray.rotation.x = srX + (erX - srX) * e;
      if (t < 1) { requestAnimationFrame(anim); } else {
        this.trayDeployed = false; this.trayAnimating = false;
      }
    };
    requestAnimationFrame(anim);
  }

  openCubby() {
    if (this.cubbyOpen) return;
    this.cubbyOpen = true;
    const door = this.meshes.cubbyDoor;
    const startY = door.position.y, t0 = performance.now();
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / 280);
      const e = 1 - Math.pow(1 - t, 3);
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
      const t = Math.min(1, (performance.now() - t0) / 280);
      const e = 1 - Math.pow(1 - t, 3);
      door.position.y = (this._cubbyDoorClosedY + 0.22) - e * 0.22;
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
    setTimeout(() => {
      btn.position.y = baseY;
      btn._animating = false;
    }, 120);
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
    ctx.beginPath(); ctx.arc(100, 100, 70, 0, Math.PI*2);
    ctx.fillStyle = '#e8e0d0'; ctx.fill();
    ctx.strokeStyle = '#ccc0a8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8B6040';
    ctx.beginPath(); ctx.ellipse(85, 90, 22, 14, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#6B8A50';
    ctx.beginPath(); ctx.ellipse(115, 100, 12, 18, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#C04030';
    ctx.beginPath(); ctx.ellipse(100, 115, 14, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#334'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(meal.label || 'Meal service', 100, 186);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0, roughness: 0.8 });
    this.mealCard = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat);
    this.mealCard.position.set(0.05, 0.658, -0.88);
    this.mealCard.rotation.x = -Math.PI / 2;
    this.scene.add(this.mealCard);
    this.mealCard.userData.hotspot = 'meal';
    this.hotspotMeshes.push(this.mealCard);
    const t0 = performance.now();
    const fade = () => {
      const t = Math.min(1, (performance.now() - t0) / 1200);
      mat.opacity = t * 0.9;
      if (t < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  hideMealCard() {
    if (!this.mealCard) return;
    const idx = this.hotspotMeshes.indexOf(this.mealCard);
    if (idx >= 0) this.hotspotMeshes.splice(idx, 1);
    this.scene.remove(this.mealCard);
    this.mealCard = null;
  }

  update(dt) {
    // per-frame updates if needed
  }
}
