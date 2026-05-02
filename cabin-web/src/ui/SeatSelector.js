import * as THREE from 'three';
import { AIRPORTS, buildRoute, formatFlightTime, haversineNm, computeFlightTimeMin } from '../session/RouteData.js';

const SEATS = [
  { id: '1A', label: '1A — Left Window', desc: 'Maximum privacy. Cocooned beside the window.', window: true, row: 1 },
  { id: '1D', label: '1D — Left Aisle', desc: 'Aisle-facing. Spacious. Console at center.', window: false, row: 1 },
  { id: '1G', label: '1G — Right Aisle', desc: 'Mirror of 1D. Aisle to your left.', window: false, row: 1 },
  { id: '1L', label: '1L — Right Window', desc: 'Maximum privacy on the right side.', window: true, row: 1 },
  { id: '2B', label: '2B — Left Aisle', desc: 'Open and airy. Best for less enclosed focus.', window: false, row: 2 },
  { id: '2D', label: '2D — Center Left', desc: 'Tucked inward. Intimate and sheltered.', window: false, row: 2 },
  { id: '2G', label: '2G — Center Right', desc: 'Mirror of 2D. Enclosed. Private.', window: false, row: 2 },
  { id: '2J', label: '2J — Right Aisle', desc: 'Open feel, right-side aisle.', window: false, row: 2 }
];

const CONTINENT_POLYS = [
  [[-168,71],[-140,59],[-133,54],[-124,48],[-120,34],[-88,26],[-80,10],[-60,14],[-52,47],[-66,44],[-82,42],[-86,46],[-95,48],[-104,49],[-110,54],[-132,56],[-148,60],[-165,68]],
  [[-80,12],[-63,11],[-48,-4],[-34,-6],[-34,-24],[-52,-34],[-66,-54],[-72,-50],[-80,-40],[-78,-10]],
  [[-10,36],[0,36],[8,36],[14,36],[20,37],[26,38],[30,44],[28,49],[22,54],[14,54],[10,55],[8,57],[2,52],[-2,44],[-6,36]],
  [[-18,15],[-18,30],[0,37],[10,37],[26,31],[32,31],[42,12],[52,11],[44,-12],[34,-26],[18,-35],[8,-35],[0,-28],[-18,-18]],
  [[26,10],[26,38],[28,44],[38,68],[60,72],[100,72],[130,70],[145,44],[130,32],[120,24],[100,4],[96,-6],[50,4],[42,14],[32,31],[26,38]],
  [[114,-22],[118,-20],[122,-18],[130,-12],[136,-12],[148,-18],[154,-26],[150,-38],[136,-38],[126,-32],[114,-28]],
  [[-20,62],[-12,68],[-18,76],[-36,76],[-50,72],[-44,64]],
];

export class SeatSelector {
  constructor(container) {
    this.container = container;
    this.selectedSeat = '1A';
    this.origin = null;
    this.destination = null;
    this.sprintMin = 25;
    this.breakMin = 5;
    this.taxiMin = 8;
    this.totalMin = 620;
    this._onBoardCb = null;
    this._tooltip = null;
    this._globeAnimId = null;
    this._markers = {};
    this._globeGroup = null;
    this._arcLine = null;
    this._hoveredCode = null;
    this._globeMouse = new THREE.Vector2(-9999, -9999);
    this._globeRenderer = null;
    this._globeCamera = null;
    this._globeScene = null;
  }

  onBoard(fn) { this._onBoardCb = fn; }

  render() {
    this.container.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'seat-selector';
    el.innerHTML = `
      <canvas class="stars-bg" id="stars-canvas"></canvas>
      <div class="seat-selector-logo">CABIN</div>
      <div class="seat-selector-tagline">Business Class · Gate to Gate Productivity</div>

      <div class="globe-card">
        <div class="globe-card-title">SELECT ROUTE</div>
        <div class="globe-wrap" id="globe-wrap" style="position:relative;">
          <canvas id="globe-canvas" style="display:block;cursor:grab;border-radius:4px;"></canvas>
          <div id="globe-tooltip" style="position:absolute;background:#16161a;border:1px solid rgba(240,192,64,0.4);color:#e8e6f0;padding:10px 14px;border-radius:6px;pointer-events:none;font-family:'Inter',sans-serif;font-size:13px;display:none;z-index:100;white-space:nowrap;">
            <div id="gtip-code" style="font-size:18px;font-weight:600;color:#f0c040;"></div>
            <div id="gtip-city" style="margin-top:2px;"></div>
            <div id="gtip-time" style="color:#7a7888;margin-top:4px;font-size:12px;"></div>
          </div>
        </div>
        <div id="route-display" class="route-display">Click an airport dot to set your departure</div>
      </div>

      <div class="seat-map-container">
        <div class="seat-map-label">Select Your Seat</div>
        <div class="seat-map-svg-wrap">
          <svg id="seat-map" viewBox="0 0 680 210" style="width:100%;max-width:660px;overflow:visible;">
            ${this._buildSeatSVG()}
          </svg>
        </div>
      </div>

      <div class="config-section">
        <div class="config-section-title">Session Configuration</div>
        <div class="config-row">
          <div class="config-label">
            <span class="config-label-text">Session Length</span>
            <span class="config-label-value" id="session-time-val">${formatFlightTime(this.totalMin)}</span>
          </div>
          <input type="range" class="config-slider" id="session-slider" min="30" max="720" step="5" value="${this.totalMin}">
        </div>
        <div class="config-row">
          <div class="config-label">
            <span class="config-label-text">Taxi Warm-up Time</span>
            <span class="config-label-value" id="taxi-val">${this.taxiMin} min</span>
          </div>
          <input type="range" class="config-slider" id="taxi-slider" min="0" max="15" step="1" value="${this.taxiMin}">
        </div>
        <div class="config-row">
          <div class="config-label">
            <span class="config-label-text">Sprint Length</span>
            <span class="config-label-value" id="sprint-val">${this.sprintMin} min</span>
          </div>
          <input type="range" class="config-slider" id="sprint-slider" min="15" max="50" step="5" value="${this.sprintMin}">
        </div>
        <div class="config-row">
          <div class="config-label">
            <span class="config-label-text">Break Length</span>
            <span class="config-label-value" id="break-val">${this.breakMin} min</span>
          </div>
          <input type="range" class="config-slider" id="break-slider" min="3" max="10" step="1" value="${this.breakMin}">
        </div>
      </div>

      <button class="board-btn" id="board-btn" disabled>Select a Route to Board →</button>
    `;
    this.container.appendChild(el);

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'seat-tooltip';
    document.body.appendChild(this._tooltip);

    this._drawStars();
    this._bindEvents(el);
    this._updateSeatSelection(this.selectedSeat);

    requestAnimationFrame(() => this._initGlobe(
      el.querySelector('#globe-canvas'),
      el.querySelector('#globe-tooltip'),
      el.querySelector('#globe-wrap')
    ));
  }

  _buildSeatSVG() {
    const pods = [
      { id: '1A', x: 18,  y: 12, flip: false, window: true,  windowLeft: true },
      { id: '1D', x: 162, y: 12, flip: false, window: false },
      { id: '1G', x: 340, y: 12, flip: true,  window: false },
      { id: '1L', x: 484, y: 12, flip: true,  window: true,  windowLeft: false },
      { id: '2B', x: 80,  y: 112, flip: false, window: false },
      { id: '2D', x: 190, y: 112, flip: false, window: false },
      { id: '2G', x: 316, y: 112, flip: true,  window: false },
      { id: '2J', x: 426, y: 112, flip: true,  window: false },
    ];
    const rowLabels = `
      <text x="618" y="58" fill="rgba(255,255,255,0.18)" font-family="Inter,sans-serif" font-size="9" letter-spacing="1">ROW 1</text>
      <text x="618" y="158" fill="rgba(255,255,255,0.18)" font-family="Inter,sans-serif" font-size="9" letter-spacing="1">ROW 2</text>
      <line x1="152" y1="0" x2="152" y2="210" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4,8"/>
      <line x1="330" y1="0" x2="330" y2="210" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4,8"/>
      <line x1="474" y1="0" x2="474" y2="210" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4,8"/>
    `;
    const seatSVGs = pods.map(p => {
      const W = 90, H = 80;
      const consoleW = 10;
      const footW = W - 14, footH = 18;
      return `
        <g class="seat-pod-group" data-seat="${p.id}" style="cursor:pointer;" transform="translate(${p.x},${p.y})">
          <rect class="seat-bg" data-seat="${p.id}" x="0" y="0" width="${W}" height="${H}" rx="5"
            fill="#191922" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
          <rect data-seat="${p.id}" x="7" y="10" width="${W - consoleW - 14}" height="${H - 22}" rx="3"
            fill="#212130" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
          <rect data-seat="${p.id}" x="${p.flip ? 7 : W - consoleW - 7}" y="10" width="${consoleW}" height="${H - 22}"
            rx="2" fill="#1a1a28" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          <rect data-seat="${p.id}" x="14" y="${H - footH - 4}" width="${footW}" height="${footH}"
            rx="2" fill="#141420"/>
          <rect data-seat="${p.id}" x="18" y="0" width="52" height="14" rx="3"
            fill="#16161e" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
          ${p.window ? `<ellipse data-seat="${p.id}" cx="${p.windowLeft ? 12 : W - 12}" cy="${H / 2 - 5}" rx="5" ry="7" fill="rgba(100,180,255,0.25)" stroke="rgba(100,180,255,0.5)" stroke-width="1"/>` : ''}
          <text data-seat="${p.id}" x="${W / 2}" y="${H / 2 + 2}" text-anchor="middle"
            fill="rgba(255,255,255,0.35)" font-family="Inter,sans-serif" font-size="11" font-weight="500"
            letter-spacing="0.5">${p.id}</text>
        </g>`;
    }).join('');
    return rowLabels + seatSVGs;
  }

  _initGlobe(canvas, tooltip, wrap) {
    const W = wrap.offsetWidth || 600;
    const H = 460;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    wrap.style.height = H + 'px';

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    this._globeRenderer = renderer;

    const scene = new THREE.Scene();
    this._globeScene = scene;

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 2.85);
    this._globeCamera = camera;

    scene.add(new THREE.AmbientLight(0x334488, 1.0));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x223366, 0.3);
    fill.position.set(-3, -2, -3);
    scene.add(fill);

    const group = new THREE.Group();
    this._globeGroup = group;
    scene.add(group);

    const earthTex = this._makeEarthTexture();
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({ map: earthTex, shininess: 8, specular: new THREE.Color(0x223344) })
    );
    group.add(globe);

    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0x4488ff, transparent: true, opacity: 0.06, side: THREE.FrontSide })
    );
    group.add(atm);

    const defaultTex = this._makeMarkerTexture(0xf0c040, false);
    const originTex  = this._makeMarkerTexture(0xf0c040, true);
    const destTex    = this._makeMarkerTexture(0x40e060, true);

    Object.entries(AIRPORTS).forEach(([code, ap]) => {
      const mat = new THREE.SpriteMaterial({ map: defaultTex, depthTest: false, sizeAttenuation: true });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(this._ll2xyz(ap.lat, ap.lon, 1.025));
      sprite.scale.set(0.045, 0.045, 0.045);
      sprite.userData = { code };
      group.add(sprite);
      this._markers[code] = { sprite, mat, defaultTex, originTex, destTex };
    });

    this._raycaster = new THREE.Raycaster();
    this._raycaster.params.Sprite = { threshold: 0.04 };

    let isDragging = false, prevX = 0, prevY = 0;
    this._rotX = 0.2;
    this._rotY = 0;

    const getXY = e => {
      const t = e.touches ? e.touches[0] : e;
      return [t.clientX, t.clientY];
    };

    canvas.addEventListener('pointerdown', e => {
      isDragging = false;
      prevX = e.clientX; prevY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', e => {
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
      if (e.buttons > 0) {
        this._rotY += dx * 0.006;
        this._rotX += dy * 0.006;
        this._rotX = Math.max(-1.2, Math.min(1.2, this._rotX));
      }
      prevX = e.clientX; prevY = e.clientY;
      const rect = canvas.getBoundingClientRect();
      this._globeMouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
      this._globeMouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
    });
    canvas.addEventListener('pointerup', e => {
      canvas.style.cursor = 'grab';
      if (!isDragging) this._handleGlobeClick(tooltip, wrap);
    });
    canvas.addEventListener('pointerleave', () => {
      canvas.style.cursor = 'grab';
      tooltip.style.display = 'none';
      this._hoveredCode = null;
      Object.values(this._markers).forEach(m => {
        if (m.sprite.scale.x > 0.046) m.sprite.scale.set(0.045, 0.045, 0.045);
      });
    });

    const allSprites = Object.values(this._markers).map(m => m.sprite);
    const loop = () => {
      this._globeAnimId = requestAnimationFrame(loop);
      if (!isDragging && !this.origin) this._rotY += 0.0008;
      group.rotation.x = this._rotX;
      group.rotation.y = this._rotY;

      this._raycaster.setFromCamera(this._globeMouse, camera);
      const hits = this._raycaster.intersectObjects(allSprites);
      const hit = hits[0]?.object;
      const hitCode = hit?.userData?.code || null;

      if (hitCode !== this._hoveredCode) {
        if (this._hoveredCode && this._markers[this._hoveredCode]) {
          const m = this._markers[this._hoveredCode];
          if (hitCode !== this.origin && hitCode !== this.destination)
            m.sprite.scale.set(0.045, 0.045, 0.045);
        }
        this._hoveredCode = hitCode;
        if (hitCode) {
          this._markers[hitCode].sprite.scale.set(0.072, 0.072, 0.072);
          this._showGlobeTooltip(hitCode, tooltip, wrap);
        } else {
          tooltip.style.display = 'none';
        }
      } else if (hitCode && tooltip.style.display !== 'none') {
        this._positionTooltip(hit, tooltip, wrap);
      }

      renderer.render(scene, camera);
    };
    loop();
  }

  _showGlobeTooltip(code, tooltip, wrap) {
    const ap = AIRPORTS[code];
    if (!ap) return;
    document.getElementById('gtip-code').textContent = code;
    document.getElementById('gtip-city').textContent = ap.city + ' — ' + ap.name;
    if (this.origin && code !== this.origin) {
      const nm = haversineNm(AIRPORTS[this.origin].lat, AIRPORTS[this.origin].lon, ap.lat, ap.lon);
      const min = computeFlightTimeMin(nm);
      document.getElementById('gtip-time').textContent = `${this.origin} → ${code}: ${formatFlightTime(min)} · ${nm.toLocaleString()} nm`;
    } else if (this.origin === code) {
      document.getElementById('gtip-time').textContent = 'Selected as ORIGIN';
    } else {
      document.getElementById('gtip-time').textContent = 'Click to set as departure';
    }
    tooltip.style.display = 'block';
    this._positionTooltip(this._markers[code].sprite, tooltip, wrap);
  }

  _positionTooltip(sprite, tooltip, wrap) {
    const wpos = sprite.getWorldPosition(new THREE.Vector3());
    const ndc  = wpos.clone().project(this._globeCamera);
    const wrapRect = wrap.getBoundingClientRect();
    const canvas = wrap.querySelector('#globe-canvas');
    const cRect = canvas.getBoundingClientRect();
    const x = (ndc.x + 1) / 2 * cRect.width;
    const y = (-ndc.y + 1) / 2 * cRect.height;
    const tx = Math.min(x + 12, cRect.width - 220);
    const ty = Math.max(y - 60, 4);
    tooltip.style.left = tx + 'px';
    tooltip.style.top  = ty + 'px';
  }

  _handleGlobeClick(tooltip, wrap) {
    if (!this._hoveredCode) return;
    const code = this._hoveredCode;
    if (!this.origin) {
      this.origin = code;
      this._updateMarkerColors();
      document.getElementById('route-display').textContent = `${code} selected as ORIGIN — now click your destination`;
      this._updateBoardBtn();
    } else if (code === this.origin) {
      this.origin = null;
      this.destination = null;
      this._removeArc();
      this._updateMarkerColors();
      document.getElementById('route-display').textContent = 'Click an airport dot to set your departure';
      this._updateBoardBtn();
    } else {
      this.destination = code;
      this._updateMarkerColors();
      this._buildArc();
      this._rotateGlobeToRoute();
      const nm = haversineNm(AIRPORTS[this.origin].lat, AIRPORTS[this.origin].lon,
                              AIRPORTS[this.destination].lat, AIRPORTS[this.destination].lon);
      const min = computeFlightTimeMin(nm);
      this.totalMin = min;
      const sl = document.getElementById('session-slider');
      if (sl) { sl.value = Math.min(720, Math.max(30, min)); }
      const sv = document.getElementById('session-time-val');
      if (sv) sv.textContent = formatFlightTime(min);
      document.getElementById('route-display').innerHTML =
        `<span style="color:#f0c040;font-weight:600;">${this.origin} → ${this.destination}</span>&nbsp;&nbsp;${formatFlightTime(min)} · ${nm.toLocaleString()} nm`;
      this._updateBoardBtn();
    }
    tooltip.style.display = 'none';
    this._hoveredCode = null;
  }

  _updateMarkerColors() {
    Object.entries(this._markers).forEach(([code, m]) => {
      if (code === this.origin) {
        m.mat.map = m.originTex;
        m.sprite.scale.set(0.065, 0.065, 0.065);
      } else if (code === this.destination) {
        m.mat.map = m.destTex;
        m.sprite.scale.set(0.065, 0.065, 0.065);
      } else {
        m.mat.map = m.defaultTex;
        m.sprite.scale.set(0.045, 0.045, 0.045);
      }
      m.mat.needsUpdate = true;
    });
  }

  _buildArc() {
    this._removeArc();
    const A = AIRPORTS[this.origin];
    const B = AIRPORTS[this.destination];
    const start = this._ll2xyz(A.lat, A.lon, 1.03);
    const end   = this._ll2xyz(B.lat, B.lon, 1.03);
    const points = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const v = start.clone().lerp(end, t).normalize().multiplyScalar(1.06 + Math.sin(Math.PI * t) * 0.12);
      points.push(v);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xf0c040, transparent: true, opacity: 0.85 });
    this._arcLine = new THREE.Line(geo, mat);
    this._globeGroup.add(this._arcLine);
  }

  _removeArc() {
    if (this._arcLine) {
      this._globeGroup.remove(this._arcLine);
      this._arcLine.geometry.dispose();
      this._arcLine.material.dispose();
      this._arcLine = null;
    }
  }

  _rotateGlobeToRoute() {
    const A = AIRPORTS[this.origin];
    const B = AIRPORTS[this.destination];
    const midLat = (A.lat + B.lat) / 2;
    const midLon = (A.lon + B.lon) / 2;
    const targetY = -(midLon + 180) * Math.PI / 180;
    const targetX = -midLat * Math.PI / 180 * 0.5;
    const startY = this._rotY, startX = this._rotX;
    const t0 = performance.now();
    const dur = 800;
    const ease = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const anim = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = ease(t);
      this._rotY = startY + (targetY - startY) * e;
      this._rotX = startX + (targetX - startX) * e;
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  _ll2xyz(lat, lon, r = 1) {
    const phi   = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  _makeEarthTexture() {
    const W = 2048, H = 1024;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);

    const lonToX = lon => (lon + 180) / 360 * W;
    const latToY = lat => (1 - (lat + 90) / 180) * H;

    ctx.fillStyle = '#1d3042';
    CONTINENT_POLYS.forEach(poly => {
      ctx.beginPath();
      poly.forEach(([lon, lat], i) => {
        const x = lonToX(lon), y = latToY(lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(120,180,220,0.08)';
    ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) {
      ctx.beginPath(); ctx.moveTo(lonToX(lon), 0); ctx.lineTo(lonToX(lon), H); ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      ctx.beginPath(); ctx.moveTo(0, latToY(lat)); ctx.lineTo(W, latToY(lat)); ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0,   'rgba(0,10,30,0.15)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1,   'rgba(0,10,30,0.15)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    return new THREE.CanvasTexture(c);
  }

  _makeMarkerTexture(colorHex, large) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const r = (colorHex >> 16) & 0xff;
    const g = (colorHex >> 8)  & 0xff;
    const b =  colorHex        & 0xff;
    const cx = size / 2, cy = size / 2;

    if (large) {
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, large ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();

    return new THREE.CanvasTexture(c);
  }

  _updateBoardBtn() {
    const btn = document.getElementById('board-btn');
    if (!btn) return;
    if (this.origin && this.destination) {
      btn.disabled = false;
      btn.textContent = `Board Flight ${this.origin} → ${this.destination} →`;
    } else {
      btn.disabled = true;
      btn.textContent = 'Select a Route to Board →';
    }
  }

  _bindEvents(el) {
    el.querySelectorAll('[data-seat]').forEach(node => {
      node.addEventListener('click', e => {
        const id = e.target.dataset.seat || e.currentTarget.dataset.seat;
        if (id) this._updateSeatSelection(id);
      });
      node.addEventListener('mouseenter', e => {
        const id = e.target.dataset.seat || e.currentTarget.dataset.seat;
        if (id) this._showTooltip(e, id);
      });
      node.addEventListener('mouseleave', () => this._hideTooltip());
      node.addEventListener('mousemove', e => {
        if (this._tooltip) {
          this._tooltip.style.left = (e.clientX + 14) + 'px';
          this._tooltip.style.top  = (e.clientY - 10) + 'px';
        }
      });
    });

    el.querySelector('#session-slider').addEventListener('input', e => {
      this.totalMin = parseInt(e.target.value);
      el.querySelector('#session-time-val').textContent = formatFlightTime(this.totalMin);
    });
    el.querySelector('#taxi-slider').addEventListener('input', e => {
      this.taxiMin = parseInt(e.target.value);
      el.querySelector('#taxi-val').textContent = this.taxiMin + ' min';
    });
    el.querySelector('#sprint-slider').addEventListener('input', e => {
      this.sprintMin = parseInt(e.target.value);
      el.querySelector('#sprint-val').textContent = this.sprintMin + ' min';
    });
    el.querySelector('#break-slider').addEventListener('input', e => {
      this.breakMin = parseInt(e.target.value);
      el.querySelector('#break-val').textContent = this.breakMin + ' min';
    });

    el.querySelector('#board-btn').addEventListener('click', () => {
      if (!this.origin || !this.destination) return;
      const route = buildRoute(this.origin, this.destination);
      if (route && this._onBoardCb) {
        this._onBoardCb({
          seat: this.selectedSeat,
          route,
          totalCruiseMin: this.totalMin,
          sprintDurationMin: this.sprintMin,
          breakDurationMin: this.breakMin,
          taxiDurationMin: this.taxiMin
        });
      }
    });
  }

  _updateSeatSelection(seatId) {
    this.selectedSeat = seatId;
    document.querySelectorAll('.seat-bg').forEach(r => {
      const id = r.dataset.seat;
      r.setAttribute('fill', id === seatId ? '#c8a96e' : '#191922');
      r.setAttribute('stroke', id === seatId ? 'rgba(240,192,64,0.6)' : 'rgba(255,255,255,0.08)');
    });
    document.querySelectorAll('.seat-pod-group text').forEach(t => {
      t.setAttribute('fill', t.dataset.seat === seatId ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.35)');
    });
  }

  _showTooltip(e, seatId) {
    const seat = SEATS.find(s => s.id === seatId);
    if (!seat || !this._tooltip) return;
    this._tooltip.innerHTML = `<strong>${seat.label}</strong>${seat.desc}`;
    this._tooltip.style.left = (e.clientX + 14) + 'px';
    this._tooltip.style.top  = (e.clientY - 10) + 'px';
    this._tooltip.classList.add('visible');
  }

  _hideTooltip() {
    if (this._tooltip) this._tooltip.classList.remove('visible');
  }

  _drawStars() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const W = window.innerWidth, H = Math.max(window.innerHeight, this.container.scrollHeight || 1200);
    canvas.width = W; canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 250; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const r = Math.random() * 1.1 + 0.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.35 + 0.06})`;
      ctx.fill();
    }
  }

  destroy() {
    if (this._globeAnimId) { cancelAnimationFrame(this._globeAnimId); this._globeAnimId = null; }
    if (this._globeRenderer) { this._globeRenderer.dispose(); this._globeRenderer = null; }
    if (this._tooltip && this._tooltip.parentNode) this._tooltip.parentNode.removeChild(this._tooltip);
    this.container.innerHTML = '';
  }
}
