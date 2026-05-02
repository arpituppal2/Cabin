import { AIRPORTS } from '../session/RouteData.js';

function formatMsCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

function greatCirclePoints(lat1, lon1, lat2, lon2, n) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lon1), φ2 = toRad(lat2), λ2 = toRad(lon2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((φ2 - φ1) / 2), 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.pow(Math.sin((λ2 - λ1) / 2), 2)
  ));
  if (d === 0) return [[lat1, lon1]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
    const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
    const z = a * Math.sin(φ1) + b * Math.sin(φ2);
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

function makeCloud(xOverride) {
  const x = xOverride !== undefined ? xOverride : 640 + Math.random() * 400;
  const layers = [];
  for (let i = 0; i < 8; i++) {
    layers.push({
      dx: (Math.random() - 0.5) * 80,
      dy: (Math.random() - 0.5) * 20,
      rx: 30 + Math.random() * 60,
      ry: 15 + Math.random() * 25
    });
  }
  return {
    x,
    y: 185 + Math.random() * 55,
    scale: 0.5 + Math.random() * 1.5,
    speed: 0.3 + Math.random() * 0.5,
    opacity: 0.6 + Math.random() * 0.35,
    layers
  };
}

function drawCloud(ctx, cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.scale, cloud.scale * 0.4);
  ctx.globalAlpha = cloud.opacity;
  cloud.layers.forEach(l => {
    ctx.beginPath();
    ctx.ellipse(l.dx, l.dy, l.rx, l.ry, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(l.dx, l.dy - l.ry * 0.3, 0, l.dx, l.dy, l.rx);
    g.addColorStop(0,   'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(220,225,235,0.70)');
    g.addColorStop(1,   'rgba(160,170,190,0)');
    ctx.fillStyle = g;
    ctx.fill();
  });
  ctx.restore();
}

export class IFEScreen {
  constructor(container, sessionEngine) {
    this.container = container;
    this.session   = sessionEngine;
    this.mode      = 'map';
    this._el       = null;
    this._animId   = null;
    this._onClose  = null;
    this._tasks    = [];
    this._taskUnsub  = null;
    this._telUnsub   = null;
    this._telemetry  = { altitude: 0, speed: 0, timeToDestSec: 0, oat: 15, progress: 0 };
    this._tailClouds = Array.from({ length: 20 }, (_, i) => makeCloud(Math.random() * 640));
    this._tailTime   = 0;
    this._tailCanvas = null;
    this._tailCtx    = null;
    this._leafletMap = null;
    this._leafletArc = null;
    this._planeMarker = null;
    this._arcPoints   = null;
  }

  onClose(fn) { this._onClose = fn; }

  open(initialMode) {
    if (initialMode) this.mode = initialMode;
    this._render();
    this._telUnsub  = this.session.on('telemetry', tel => { this._telemetry = tel; });
    this._taskUnsub = this.session.on('tasksChanged', tasks => {
      this._tasks = tasks;
      if (this.mode === 'tasks') this._renderTaskList();
    });
    this._tasks = [...this.session.state.tasks];
    this._switchMode(this.mode, true);
    this._startAnim();
  }

  close() {
    this._stopAnim();
    if (this._telUnsub)  this._telUnsub();
    if (this._taskUnsub) this._taskUnsub();
    this._destroyMap();
    if (this._el) {
      this._el.style.opacity = '0';
      setTimeout(() => {
        if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
        this._el = null;
      }, 180);
    }
    if (this._onClose) this._onClose();
  }

  _render() {
    const wrap = document.createElement('div');
    wrap.className = 'ife-overlay';

    const route = this.session.state.route;
    const originCode = route.origin || '???';
    const destCode   = route.destination || '???';

    wrap.innerHTML = `
      <div class="ife-panel" id="ife-panel-inner">
        <div class="ife-top-bar">
          <div class="ife-top-left">
            <span class="ife-airline-name">CABIN AIR</span>
            <span class="ife-divider">|</span>
            <span class="ife-route-label" id="ife-route-label">${originCode} → ${destCode}</span>
          </div>
          <button class="ife-close-btn" id="ife-close">&times;</button>
        </div>
        <div class="ife-content" id="ife-content"></div>
        <div class="ife-tab-bar">
          <button class="ife-tab" data-mode="map">MAP</button>
          <button class="ife-tab" data-mode="clock">CLOCK</button>
          <button class="ife-tab" data-mode="tasks">TASKS</button>
          <button class="ife-tab" data-mode="tailcam">TAIL CAM</button>
        </div>
      </div>`;

    this.container.appendChild(wrap);
    this._el = wrap;

    wrap.querySelector('#ife-close').addEventListener('click', () => this.close());
    wrap.querySelectorAll('.ife-tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchMode(btn.dataset.mode));
    });
  }

  _switchMode(mode, skipAnim = false) {
    this.mode = mode;
    if (!this._el) return;
    this._el.querySelectorAll('.ife-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const content = this._el.querySelector('#ife-content');
    if (!content) return;
    this._destroyMap();
    this._tailCanvas = null; this._tailCtx = null;
    content.style.display = '';
    content.style.flexDirection = '';

    if (mode === 'map') {
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.innerHTML = `
        <div id="ife-map" style="flex:1;min-height:0;width:100%;background:#0a1628;"></div>
        <div class="ife-telemetry-bar">
          <span>TIME TO DEST <strong id="tel-ttd">--:--</strong></span>
          <span>ALT <strong id="tel-alt">-- ft</strong></span>
          <span>SPD <strong id="tel-spd">-- kts</strong></span>
          <span>OAT <strong id="tel-oat">--°C</strong></span>
        </div>`;
      setTimeout(() => this._initLeafletMap(), 350);

    } else if (mode === 'clock') {
      const s = this.session.state;
      content.innerHTML = `
        <div class="ife-clock-wrap">
          <div class="ife-sprint-label" id="ife-sprint-label">SPRINT ${s.currentSprint}</div>
          <div class="ife-clock-digits" id="ife-clock-display">${formatMsCountdown(s.sprintMsLeft)}</div>
          <div class="ife-clock-phase" id="ife-clock-phase">${s.isOnBreak ? 'BREAK' : 'FOCUS'}</div>
        </div>`;

    } else if (mode === 'tailcam') {
      content.innerHTML = `<canvas id="tail-cam-canvas" style="display:block;width:100%;height:100%;"></canvas>`;
      const canvas = content.querySelector('#tail-cam-canvas');
      canvas.width  = 640;
      canvas.height = 400;
      this._tailCanvas = canvas;
      this._tailCtx    = canvas.getContext('2d');

    } else if (mode === 'tasks') {
      this._renderTaskList();

    } else if (mode === 'arrived') {
      this._renderArrived();
    }
  }

  _initLeafletMap() {
    if (!window.L) {
      console.warn('[IFE] window.L not available — Leaflet not loaded');
      return;
    }
    if (!this._el) return;
    const mapEl = this._el.querySelector('#ife-map');
    if (!mapEl) { console.warn('[IFE] #ife-map not found'); return; }

    const mapH = mapEl.offsetHeight;
    console.log('[IFE] initLeafletMap — container h=' + mapH);
    if (mapH < 10) {
      console.warn('[IFE] map container too small, retrying in 200ms');
      setTimeout(() => this._initLeafletMap(), 200);
      return;
    }

    const route  = this.session.state.route;
    const origin = route && AIRPORTS[route.origin];
    const dest   = route && AIRPORTS[route.destination];
    if (!origin || !dest) {
      mapEl.innerHTML = '<div style="color:#f0c040;padding:20px;font-family:Inter,sans-serif;font-size:13px;letter-spacing:0.06em;">No route selected.</div>';
      return;
    }

    this._destroyMap();
    const L = window.L;

    const map = L.map(mapEl, {
      zoomControl: false, attributionControl: false,
      dragging: true, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false
    });
    this._leafletMap = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19
    }).addTo(map);
    map.once('load', () => { setTimeout(() => map.invalidateSize(), 50); });

    const originIcon = L.divIcon({
      className: '', iconSize: [12, 12], iconAnchor: [6, 6],
      html: '<div style="width:10px;height:10px;background:#f0c040;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px #f0c040;"></div>'
    });
    const destIcon = L.divIcon({
      className: '', iconSize: [12, 12], iconAnchor: [6, 6],
      html: '<div style="width:10px;height:10px;background:#40e060;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px #40e060;"></div>'
    });

    L.marker([origin.lat, origin.lon], { icon: originIcon }).addTo(map)
      .bindTooltip(route.origin, { permanent: true, className: 'ife-map-label', direction: 'top' });
    L.marker([dest.lat, dest.lon], { icon: destIcon }).addTo(map)
      .bindTooltip(route.destination, { permanent: true, className: 'ife-map-label', direction: 'top' });

    this._arcPoints = greatCirclePoints(origin.lat, origin.lon, dest.lat, dest.lon, 80);

    L.polyline(this._arcPoints, {
      color: 'rgba(240,192,64,0.25)', weight: 2, dashArray: '6,4'
    }).addTo(map);

    this._leafletArc = L.polyline(
      this._arcPoints.slice(0, 1),
      { color: '#f0c040', weight: 2, opacity: 0.9 }
    ).addTo(map);

    const planeIcon = L.divIcon({
      className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      html: '<div style="font-size:18px;line-height:1;filter:drop-shadow(0 0 4px #f0c040);">✈</div>'
    });
    this._planeMarker = L.marker([origin.lat, origin.lon], { icon: planeIcon }).addTo(map);

    map.fitBounds(
      L.latLngBounds([[origin.lat, origin.lon], [dest.lat, dest.lon]]),
      { padding: [50, 50] }
    );
    setTimeout(() => { if (this._leafletMap) this._leafletMap.invalidateSize(); }, 100);

    this._updateMapProgress(this._telemetry.progress || 0);
  }

  _updateMapProgress(progress) {
    if (!this._arcPoints || !this._leafletArc || !this._planeMarker) return;
    const n = this._arcPoints.length;
    const idx = Math.min(Math.floor(progress * (n - 1)), n - 2);
    this._leafletArc.setLatLngs(this._arcPoints.slice(0, idx + 1));
    this._planeMarker.setLatLng(this._arcPoints[idx]);
  }

  _destroyMap() {
    if (this._leafletMap) {
      try { this._leafletMap.remove(); } catch (_) {}
      this._leafletMap  = null;
      this._leafletArc  = null;
      this._planeMarker = null;
      this._arcPoints   = null;
    }
  }

  _drawTailCam() {
    const canvas = this._tailCanvas, ctx = this._tailCtx;
    if (!canvas || !ctx) return;
    const W = 640, H = 400;
    this._tailTime += 0.016;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 260);
    skyGrad.addColorStop(0,   '#020a1a');
    skyGrad.addColorStop(0.6, '#0a2860');
    skyGrad.addColorStop(1,   '#1a4a80');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, 260);

    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 260, W, H - 260);

    const horizGrad = ctx.createLinearGradient(0, 230, 0, 290);
    horizGrad.addColorStop(0, 'rgba(30,80,160,0)');
    horizGrad.addColorStop(0.5, 'rgba(20,60,120,0.4)');
    horizGrad.addColorStop(1, 'rgba(5,10,30,0)');
    ctx.fillStyle = horizGrad;
    ctx.fillRect(0, 230, W, 60);

    this._tailClouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x < -200) {
        cloud.x = 700 + Math.random() * 100;
        cloud.y = 185 + Math.random() * 55;
        cloud.scale = 0.5 + Math.random() * 1.5;
      }
      drawCloud(ctx, cloud);
    });

    ctx.save();
    ctx.translate(W / 2, H);
    ctx.fillStyle = '#1a1a24';
    ctx.strokeStyle = '#2a2a38';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -80); ctx.lineTo(-15, 0); ctx.lineTo(15, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-80, -20); ctx.lineTo(-10, -30); ctx.lineTo(-10, -10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(80, -20); ctx.lineTo(10, -30); ctx.lineTo(10, -10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -10, 18, 60, 0, 0, Math.PI);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, W, 2);
    }

    const alt = Math.round(this._telemetry.altitude || 0);
    ctx.font = 'bold 11px "Inter",monospace';
    ctx.fillStyle = 'rgba(64,255,128,0.9)';
    ctx.fillText('● REC', 16, 24);
    ctx.fillStyle = 'rgba(64,255,128,0.6)';
    ctx.fillText(new Date().toISOString().substr(11, 8), 16, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px "Inter",monospace';
    ctx.fillText('TAIL CAM · ALT ' + alt.toLocaleString() + ' FT', 16, 56);
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.beginPath(); ctx.arc(8, 20, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3030'; ctx.fill();
    }

    const vig = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 380);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  _updateClockDisplay() {
    if (this.mode !== 'clock' || !this._el) return;
    const s = this.session.state;
    const display = this._el.querySelector('#ife-clock-display');
    const phase   = this._el.querySelector('#ife-clock-phase');
    const sprint  = this._el.querySelector('#ife-sprint-label');
    if (!display) return;
    const ms = s.sprintMsLeft;
    const str = formatMsCountdown(ms);
    display.textContent = str;
    display.classList.toggle('pulse', ms < 5 * 60 * 1000 && ms > 0);
    if (phase) phase.textContent = s.isOnBreak ? 'BREAK' : 'FOCUS';
    if (sprint) sprint.textContent = 'SPRINT ' + s.currentSprint;
  }

  _updateTelemetryBar() {
    if (this.mode !== 'map' || !this._el) return;
    const t = this._telemetry;
    const ttd = this._el.querySelector('#tel-ttd');
    const alt = this._el.querySelector('#tel-alt');
    const spd = this._el.querySelector('#tel-spd');
    const oat = this._el.querySelector('#tel-oat');
    if (!ttd) return;
    const h = Math.floor(t.timeToDestSec / 3600);
    const m = Math.floor((t.timeToDestSec % 3600) / 60);
    ttd.textContent = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
    if (alt) alt.textContent = Math.round(t.altitude).toLocaleString() + ' ft';
    if (spd) spd.textContent = Math.round(t.speed) + ' kts';
    if (oat) oat.textContent = (t.oat >= 0 ? '+' : '') + Math.round(t.oat) + '°C';
  }

  _startAnim() {
    const loop = () => {
      this._animId = requestAnimationFrame(loop);
      if (this.mode === 'tailcam') this._drawTailCam();
      if (this.mode === 'clock')   this._updateClockDisplay();
      if (this.mode === 'map') {
        this._updateTelemetryBar();
        this._updateMapProgress(this._telemetry.progress || 0);
      }
    };
    this._animId = requestAnimationFrame(loop);
  }

  _stopAnim() {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }

  _renderTaskList() {
    const content = this._el && this._el.querySelector('#ife-content');
    if (!content || this.mode !== 'tasks') return;
    const s = this.session.state;
    const tasks = this._tasks;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    content.innerHTML = `
      <div class="ife-tasks-wrap">
        <div class="ife-tasks-header">
          <span>Sprint ${s.currentSprint} Tasks</span>
          <span id="task-count" style="color:#3a3a50;font-size:11px;">${doneCount}/${tasks.length} done</span>
        </div>
        <input class="ife-task-input" id="task-input" type="text"
          placeholder="Add a task and press Enter..." autocomplete="off">
        <div class="ife-task-list" id="task-list"></div>
      </div>`;

    const input = content.querySelector('#task-input');
    const addTask = () => {
      const val = input.value.trim();
      if (!val) return;
      this.session.addTask(val);
      input.value = '';
      input.focus();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
    input.addEventListener('focus', () => { input.style.borderColor = 'rgba(240,192,64,0.4)'; });
    input.addEventListener('blur',  () => { input.style.borderColor = 'rgba(255,255,255,0.1)'; });

    this._renderTaskItems();

    this._taskUnsub && this._taskUnsub();
    this._taskUnsub = this.session.on('tasksChanged', updated => {
      this._tasks = updated;
      if (this.mode !== 'tasks') return;
      const countEl = content.querySelector('#task-count');
      if (countEl) countEl.textContent = `${updated.filter(t=>t.status==='done').length}/${updated.length} done`;
      this._renderTaskItems();
    });
  }

  _renderTaskItems() {
    const list = this._el && this._el.querySelector('#task-list');
    if (!list) return;
    const tasks = this._tasks;
    if (!tasks.length) {
      list.innerHTML = '<div style="padding:24px 16px;color:#3a3a50;font-size:12px;letter-spacing:0.06em;">No tasks yet. Add one above.</div>';
      return;
    }
    list.innerHTML = tasks.map(t => {
      const done = t.status === 'done';
      const dotColor = { todo: '#3a3a50', doing: '#f0c040', done: '#40e060' }[t.status];
      return `<div class="ife-task-item" data-id="${t.id}" data-status="${t.status}">
        <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;"></div>
        <span style="flex:1;font-size:13px;color:${done?'#3a3a50':'#e8e6f0'};${done?'text-decoration:line-through;':''}">
          ${this._escape(t.text)}</span>
        <span style="font-size:10px;color:#3a3a50;letter-spacing:0.08em;">S${t.sprint}</span>
      </div>`;
    }).join('');

    list.querySelectorAll('.ife-task-item').forEach(item => {
      item.addEventListener('click', () => {
        this.session.cycleTaskStatus(parseInt(item.dataset.id));
      });
    });
  }

  _renderArrived() {
    const content = this._el && this._el.querySelector('#ife-content');
    if (!content) return;
    const s = this.session.state;
    const totalMin = Math.round(s.elapsedMs / 60000);
    const doneTasks = s.tasks.filter(t => t.status === 'done').length;
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;text-align:center;">
        <div style="font-size:11px;letter-spacing:0.2em;color:#f0c040;margin-bottom:16px;">FLIGHT COMPLETE</div>
        <div style="font-size:26px;font-family:'Instrument Serif',serif;color:#e8e6f0;margin-bottom:6px;">
          Welcome to ${s.route.destinationCity || s.route.destination}</div>
        <div style="font-size:12px;color:#3a3a50;letter-spacing:0.08em;margin-bottom:40px;">
          ${s.route.origin} → ${s.route.destination}</div>
        <div style="display:flex;gap:32px;margin-bottom:40px;">
          ${[
            [s.completedSprints, 'SPRINTS FLOWN'],
            [`${doneTasks}/${s.tasks.length}`, 'TASKS DONE'],
            [`${totalMin}m`, 'SESSION TIME'],
          ].map(([v, l]) => `
            <div>
              <div style="font-size:28px;font-family:'Instrument Serif',serif;color:#f0c040;">${v}</div>
              <div style="font-size:10px;letter-spacing:0.12em;color:#3a3a50;margin-top:4px;">${l}</div>
            </div>`).join('')}
        </div>
        <button id="deplane-btn" style="
          padding:14px 32px;background:#f0c040;color:#06060e;
          font-family:Inter,sans-serif;font-size:11px;font-weight:700;
          letter-spacing:0.16em;text-transform:uppercase;border:none;
          border-radius:2px;cursor:pointer;">Deplane & Return</button>
      </div>`;
    content.querySelector('#deplane-btn').addEventListener('click', () => {
      this.close();
      window.dispatchEvent(new CustomEvent('cabin:deplane'));
    });
  }

  _escape(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  cycleMode() {
    const modes = ['map', 'clock', 'tasks', 'tailcam'];
    this._switchMode(modes[(modes.indexOf(this.mode) + 1) % modes.length]);
  }

  showArrived() {
    this._switchMode('arrived');
    if (this._el) this._el.querySelectorAll('.ife-tab').forEach(b => b.style.display = 'none');
  }
}
