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

// Detailed continent + island polygons [lon, lat] for globe earth texture.
// Enough vertices per landmass for recognisable shapes at globe scale.
const CONTINENT_POLYS = [
  // ── North America (Pacific → Central Am. → Caribbean/Gulf → East coast → Arctic) ──
  [[-168,71],[-165,68],[-163,62],[-160,58],[-153,57],[-148,59],[-143,60],
   [-138,59],[-134,57],[-130,54],[-126,50],[-124,47],[-122,37],[-118,33],
   [-116,30],[-110,24],[-104,20],[-96,16],[-92,16],[-88,14],[-84,10],
   [-80,8],[-78,9],[-76,10],[-82,16],[-88,17],[-90,20],[-90,22],[-97,26],
   [-97,30],[-94,30],[-90,30],[-86,30],[-84,30],[-82,28],[-80,26],[-80,24],
   [-80,28],[-80,30],[-78,33],[-76,36],[-74,40],[-72,42],[-70,43],[-66,44],
   [-60,47],[-56,50],[-54,52],[-58,54],[-64,58],[-66,63],[-72,62],[-76,64],
   [-80,62],[-86,58],[-90,68],[-96,72],[-104,74],[-118,74],[-130,72],
   [-142,71],[-152,70],[-160,68],[-168,71]],

  // ── South America ──
  [[-78,8],[-76,2],[-74,0],[-70,-4],[-70,-14],[-76,-14],[-80,-4],[-80,0],
   [-77,4],[-74,10],[-64,12],[-62,10],[-56,6],[-52,4],[-50,0],[-48,-4],
   [-38,-8],[-34,-6],[-34,-14],[-38,-18],[-40,-22],[-44,-22],[-44,-26],
   [-48,-28],[-52,-32],[-52,-34],[-56,-38],[-64,-42],[-65,-50],[-66,-54],
   [-70,-54],[-72,-46],[-72,-38],[-70,-28],[-72,-22],[-72,-16],[-76,-8],
   [-78,-2],[-78,4],[-78,8]],

  // ── Europe (Iberia → Atlantic coast → Scandinavia → Eastern Europe) ──
  [[-9,36],[-5,36],[-2,36],[0,36],[3,40],[2,43],[0,44],[-2,44],[-4,46],
   [-2,48],[2,51],[5,52],[6,53],[8,54],[10,55],[12,56],[10,58],[4,58],
   [0,58],[4,58],[6,60],[5,62],[7,64],[14,66],[16,69],[18,68],[22,70],
   [26,70],[28,71],[26,68],[22,69],[20,68],[16,68],[14,65],[12,63],[10,60],
   [12,60],[14,58],[16,56],[18,56],[20,54],[18,52],[16,50],[14,48],[12,46],
   [10,44],[8,44],[6,44],[4,42],[2,44],[0,44],[-2,44],[-4,44],[-4,48],
   [-4,50],[-6,50],[-6,44],[-4,38],[-5,36],[-9,36]],

  // ── Africa ──
  [[-6,34],[-2,36],[0,37],[4,37],[8,36],[12,34],[14,32],[22,31],[26,31],
   [30,30],[34,28],[36,24],[38,18],[42,14],[44,12],[50,12],[44,10],[40,8],
   [40,0],[38,-4],[36,-10],[34,-18],[32,-22],[30,-26],[28,-30],[26,-34],
   [18,-34],[14,-34],[12,-30],[8,-20],[4,-8],[0,-2],[0,4],[2,6],[-2,5],
   [-6,5],[-14,4],[-16,4],[-18,8],[-16,12],[-14,16],[-16,20],[-16,28],
   [-14,28],[-8,28],[-4,30],[-2,32],[-4,34],[-6,34]],

  // ── Asia (Turkey → Red Sea / Arabian Peninsula → India → SE Asia → Siberia) ──
  [[26,40],[28,42],[32,42],[36,38],[40,36],[36,30],[37,24],[43,12],[44,12],
   [50,14],[58,22],[60,22],[55,24],[52,26],[50,30],[48,30],[44,32],[42,36],
   [48,34],[52,30],[60,24],[64,24],[68,24],[70,22],[72,20],[76,10],[78,8],
   [80,10],[80,14],[78,20],[82,24],[88,28],[90,22],[92,22],[96,20],[100,24],
   [104,22],[108,18],[110,18],[112,16],[116,22],[120,24],[120,28],[122,32],
   [122,36],[120,36],[120,40],[126,34],[128,36],[128,38],[130,40],[132,42],
   [134,46],[138,46],[140,44],[140,40],[140,36],[138,36],[136,34],[132,36],
   [130,38],[128,48],[132,48],[136,54],[140,52],[142,56],[144,58],[142,62],
   [138,64],[134,68],[130,70],[132,72],[136,72],[142,72],[148,70],[156,68],
   [162,64],[166,60],[168,56],[164,56],[160,60],[156,54],[154,50],[148,44],
   [144,42],[140,44],[136,52],[132,52],[128,50],[122,48],[116,48],[108,50],
   [100,50],[94,52],[88,50],[82,52],[76,54],[70,54],[64,56],[58,54],[54,54],
   [50,52],[46,50],[44,46],[40,42],[38,44],[36,44],[34,44],[30,46],[26,48],
   [22,48],[20,50],[18,52],[16,50],[14,48]],

  // ── Australia ──
  [[114,-22],[116,-20],[120,-18],[124,-14],[128,-14],[132,-12],[136,-12],
   [138,-14],[140,-18],[144,-18],[148,-20],[150,-24],[154,-26],[154,-28],
   [152,-30],[152,-36],[150,-38],[148,-38],[146,-38],[142,-34],[140,-32],
   [136,-32],[130,-32],[126,-30],[122,-28],[118,-26],[114,-26],[112,-24],
   [112,-22],[114,-22]],

  // ── Greenland ──
  [[-52,82],[-40,82],[-24,78],[-18,76],[-16,72],[-18,72],[-22,72],
   [-24,68],[-28,70],[-34,70],[-40,70],[-46,70],[-50,66],[-52,68],
   [-54,74],[-52,76],[-48,78],[-52,82]],

  // ── Great Britain ──
  [[-6,50],[-4,50],[-2,50],[0,51],[0,53],[-2,55],[-4,56],[-4,58],
   [-2,58],[0,58],[-2,60],[0,60],[-2,60],[-4,58],[-2,53],[-4,52],[-6,50]],

  // ── Ireland ──
  [[-10,52],[-8,52],[-6,52],[-6,54],[-8,55],[-10,54],[-10,52]],

  // ── Iceland ──
  [[-14,63],[-18,64],[-22,65],[-24,65],[-22,66],[-18,66],[-14,64],[-14,63]],

  // ── Japan (Honshu) ──
  [[130,32],[132,34],[134,34],[136,36],[138,36],[140,40],[141,43],
   [140,44],[138,44],[136,40],[134,38],[132,36],[130,34],[130,32]],

  // ── Japan (Hokkaido) ──
  [[140,44],[142,44],[144,44],[144,42],[142,42],[140,44]],

  // ── Borneo ──
  [[108,2],[110,4],[114,6],[118,6],[118,4],[114,0],[110,-2],[108,0],[108,2]],

  // ── Sumatra ──
  [[96,4],[100,4],[104,2],[106,0],[106,-4],[104,-4],[100,-2],[96,2],[96,4]],

  // ── New Guinea ──
  [[132,-4],[136,-4],[140,-6],[144,-6],[146,-8],[144,-8],[140,-8],[136,-6],[132,-6],[132,-4]],

  // ── Madagascar ──
  [[44,-12],[48,-12],[50,-14],[50,-20],[48,-24],[44,-22],[42,-18],[44,-12]],

  // ── New Zealand (South Island) ──
  [[166,-46],[168,-46],[170,-44],[172,-42],[174,-40],[172,-38],[168,-44],[166,-46]],

  // ── Cuba ──
  [[-82,22],[-80,22],[-76,20],[-74,20],[-76,18],[-82,20],[-82,22]],

  // ── Philippines ──
  [[118,6],[120,8],[122,10],[124,12],[126,8],[122,6],[120,6],[118,6]],

  // ── Java ──
  [[106,-6],[108,-7],[110,-8],[112,-8],[114,-8],[108,-8],[106,-6]],

  // ── Taiwan ──
  [[120,22],[122,24],[122,22],[120,22]],

  // ── Sri Lanka ──
  [[80,6],[80,10],[82,10],[82,6],[80,6]],

  // ── Svalbard ──
  [[14,78],[18,78],[22,78],[22,80],[18,80],[14,78]],
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

    scene.add(new THREE.AmbientLight(0x112244, 0.55));
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.9);
    sun.position.set(5, 3, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x1133aa, 0.22);
    fill.position.set(-4, -2, -3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x3366cc, 0.14);
    rim.position.set(-1, 0, -5);
    scene.add(rim);

    const group = new THREE.Group();
    this._globeGroup = group;
    scene.add(group);

    const earthTex = this._makeEarthTexture();
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({ map: earthTex, shininess: 8, specular: new THREE.Color(0x223344) })
    );
    group.add(globe);

    // Atmosphere — back-face sphere gives rim-glow effect
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x2255cc,
        transparent: true,
        opacity: 0.10,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    group.add(atm);
    // Inner thin haze
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(1.018, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.04,
        side: THREE.FrontSide,
        depthWrite: false
      })
    );
    group.add(haze);

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

    // Deep ocean — subtle vertical gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
    oceanGrad.addColorStop(0,   '#010810');
    oceanGrad.addColorStop(0.5, '#030e1c');
    oceanGrad.addColorStop(1,   '#010810');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, H);

    const X = lon => (lon + 180) / 360 * W;
    const Y = lat => (90 - lat) / 180 * H;

    // Draw all landmasses with fill + subtle coastline stroke
    CONTINENT_POLYS.forEach(poly => {
      ctx.beginPath();
      poly.forEach(([lon, lat], i) => {
        i === 0 ? ctx.moveTo(X(lon), Y(lat)) : ctx.lineTo(X(lon), Y(lat));
      });
      ctx.closePath();
      ctx.fillStyle = '#18304a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(50,120,200,0.22)';
      ctx.lineWidth = 0.85;
      ctx.stroke();
    });

    // Very faint graticule grid
    ctx.strokeStyle = 'rgba(60,100,180,0.05)';
    ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 30) {
      ctx.beginPath(); ctx.moveTo(X(lon), 0); ctx.lineTo(X(lon), H); ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      ctx.beginPath(); ctx.moveTo(0, Y(lat)); ctx.lineTo(W, Y(lat)); ctx.stroke();
    }

    // Subtle equatorial warmth
    const eqGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.38);
    eqGrad.addColorStop(0,   'rgba(10,40,80,0.06)');
    eqGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = eqGrad;
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
