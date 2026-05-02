export class IFEScreen {
  constructor(container, sessionEngine) {
    this.container = container;
    this.session = sessionEngine;
    this.mode = 'map';
    this._el = null;
    this._mapCanvas = null;
    this._mapCtx = null;
    this._tailCanvas = null;
    this._tailCtx = null;
    this._tailClouds = this._genTailClouds(20);
    this._tailTime = 0;
    this._animId = null;
    this._telemetry = { altitude: 0, speed: 0, timeToDestSec: 0, oat: 15, progress: 0 };
    this._onClose = null;
    this._tasks = [];
    this._taskUnsub = null;
    this._telUnsub = null;
    this._tickUnsub = null;
    this._mapPoints = null;
  }

  onClose(fn) { this._onClose = fn; }

  open(initialMode) {
    if (initialMode) this.mode = initialMode;
    this._render();
    this._taskUnsub = this.session.on('tasksChanged', tasks => {
      this._tasks = tasks;
      if (this.mode === 'tasks') this._renderTaskList();
    });
    this._telUnsub = this.session.on('telemetry', tel => {
      this._telemetry = tel;
    });
    this._tickUnsub = this.session.on('tick', data => {
      if (this.mode === 'clock') this._updateClock(data);
      if (this.mode === 'map') this._refreshTelemetryBar();
    });
    this._tasks = [...this.session.state.tasks];
    this._startAnim();
  }

  close() {
    this._stopAnim();
    if (this._taskUnsub) this._taskUnsub();
    if (this._telUnsub) this._telUnsub();
    if (this._tickUnsub) this._tickUnsub();
    if (this._el) {
      this._el.classList.add('closing');
      setTimeout(() => {
        if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
        this._el = null;
      }, 250);
    }
    if (this._onClose) this._onClose();
  }

  _render() {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `<div class="panel-backdrop"></div>`;

    const panel = document.createElement('div');
    panel.className = 'ife-panel';

    const route = this.session.state.route;
    panel.innerHTML = `
      <div class="ife-header">
        <span class="ife-route-info">${route.origin} → ${route.destination} · ${route.originCity} to ${route.destinationCity}</span>
        <button class="ife-close-btn" id="ife-close">✕</button>
      </div>
      <div class="ife-content" id="ife-content"></div>
      <div class="ife-mode-bar">
        <button class="ife-mode-btn ${this.mode==='map'?'active':''}" data-mode="map">Map</button>
        <button class="ife-mode-btn ${this.mode==='clock'?'active':''}" data-mode="clock">Clock</button>
        <button class="ife-mode-btn ${this.mode==='tailcam'?'active':''}" data-mode="tailcam">Tail Cam</button>
        <button class="ife-mode-btn ${this.mode==='tasks'?'active':''}" data-mode="tasks">Tasks</button>
      </div>
    `;

    overlay.appendChild(panel);
    this.container.appendChild(overlay);
    this._el = overlay;

    panel.querySelector('#ife-close').addEventListener('click', () => this.close());
    overlay.querySelector('.panel-backdrop').addEventListener('click', () => this.close());
    panel.querySelectorAll('.ife-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchMode(btn.dataset.mode));
    });

    this._switchMode(this.mode, true);
  }

  _switchMode(mode, skipAnim = false) {
    this.mode = mode;
    this._el && this._el.querySelectorAll('.ife-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const content = this._el && this._el.querySelector('#ife-content');
    if (!content) return;

    if (mode === 'map') {
      content.innerHTML = `
        <div class="ife-map-container">
          <canvas id="ife-map-canvas"></canvas>
          <div class="ife-telemetry-bar" id="ife-tel-bar">
            <div class="ife-telemetry-item">
              <span class="ife-telemetry-label">Time to Dest</span>
              <span class="ife-telemetry-value" id="tel-ttd">--:--</span>
            </div>
            <div class="ife-telemetry-item">
              <span class="ife-telemetry-label">Altitude</span>
              <span class="ife-telemetry-value" id="tel-alt">0 ft</span>
            </div>
            <div class="ife-telemetry-item">
              <span class="ife-telemetry-label">Ground Speed</span>
              <span class="ife-telemetry-value" id="tel-spd">0 kts</span>
            </div>
            <div class="ife-telemetry-item">
              <span class="ife-telemetry-label">OAT</span>
              <span class="ife-telemetry-value" id="tel-oat">+15°C</span>
            </div>
          </div>
        </div>`;
      this._mapCanvas = content.querySelector('#ife-map-canvas');
      this._resizeCanvas(this._mapCanvas);
      this._mapCtx = this._mapCanvas.getContext('2d');
      this._drawMap();
    } else if (mode === 'clock') {
      const s = this.session.state;
      const total = s.sprintDurationMin * s.currentSprint;
      content.innerHTML = `
        <div class="ife-clock-container">
          <span class="ife-sprint-label">SPRINT ${s.currentSprint}</span>
          <div class="ife-clock-time" id="ife-clock-time">25:00</div>
          <span class="ife-clock-status" id="ife-clock-status">${s.isOnBreak ? 'BREAK' : 'FOCUS'}</span>
        </div>`;
      this._updateClock({ sprintSecondsLeft: s.sprintSecondsLeft, currentSprint: s.currentSprint });
    } else if (mode === 'tailcam') {
      content.innerHTML = `
        <div class="ife-tailcam-container">
          <canvas id="ife-tailcam-canvas"></canvas>
          <div class="ife-tailcam-label"><div class="rec-dot"></div> TAIL CAM</div>
          <div class="ife-tailcam-scanlines"></div>
          <svg class="ife-tail-silhouette" viewBox="0 0 200 80" fill="rgba(255,255,255,0.15)">
            <path d="M100,20 L60,70 L80,70 L90,45 L110,45 L120,70 L140,70 Z"/>
            <path d="M85,20 L30,50 L30,58 L88,38 Z"/>
            <path d="M115,20 L170,50 L170,58 L112,38 Z"/>
          </svg>
        </div>`;
      this._tailCanvas = content.querySelector('#ife-tailcam-canvas');
      this._resizeCanvas(this._tailCanvas);
      this._tailCtx = this._tailCanvas.getContext('2d');
    } else if (mode === 'tasks') {
      this._renderTaskList();
    } else if (mode === 'arrived') {
      this._renderArrived();
    }
  }

  _resizeCanvas(canvas) {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    canvas.width = Math.floor(rect.width) || 800;
    canvas.height = Math.floor(rect.height - 50) || 400;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  _refreshTelemetryBar() {
    const t = this._telemetry;
    const ttdEl = this._el && this._el.querySelector('#tel-ttd');
    const altEl = this._el && this._el.querySelector('#tel-alt');
    const spdEl = this._el && this._el.querySelector('#tel-spd');
    const oatEl = this._el && this._el.querySelector('#tel-oat');
    if (!ttdEl) return;
    const h = Math.floor(t.timeToDestSec / 3600);
    const m = Math.floor((t.timeToDestSec % 3600) / 60);
    ttdEl.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    altEl.textContent = Math.round(t.altitude).toLocaleString() + ' ft';
    spdEl.textContent = Math.round(t.speed) + ' kts';
    const sign = t.oat >= 0 ? '+' : '';
    oatEl.textContent = `${sign}${Math.round(t.oat)}°C`;
  }

  _updateClock(data) {
    const el = this._el && this._el.querySelector('#ife-clock-time');
    const statusEl = this._el && this._el.querySelector('#ife-clock-status');
    if (!el) return;
    const sec = Math.max(0, Math.round(data.sprintSecondsLeft || 0));
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
    el.classList.toggle('pulse', sec < 300);
    if (statusEl) statusEl.textContent = this.session.state.isOnBreak ? 'BREAK' : 'FOCUS';
  }

  _drawMap() {
    const canvas = this._mapCanvas;
    const ctx = this._mapCtx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    const LAND_H = H - 50;

    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);

    const continents = [
      [[0.0,0.5],[0.18,0.5],[0.18,0.7],[0.12,0.85],[0.0,0.85]],
      [[0.08,0.25],[0.23,0.22],[0.26,0.45],[0.18,0.5],[0.08,0.45]],
      [[0.24,0.22],[0.45,0.18],[0.5,0.35],[0.48,0.48],[0.35,0.55],[0.24,0.48]],
      [[0.5,0.22],[0.62,0.2],[0.68,0.32],[0.65,0.48],[0.55,0.5],[0.48,0.4]],
      [[0.65,0.5],[0.8,0.48],[0.88,0.62],[0.82,0.75],[0.65,0.72]],
      [[0.78,0.3],[0.95,0.28],[1.0,0.4],[0.95,0.55],[0.8,0.52]],
      [[0.58,0.65],[0.72,0.62],[0.75,0.8],[0.65,0.9],[0.55,0.82]],
    ];

    continents.forEach(pts => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const px = x * W, py = y * LAND_H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = '#1a2a3a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,80,120,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    const route = this.session.state.route;
    const progress = this._telemetry.progress || 0;

    const originLL = this._routeToXY(route.origin, W, LAND_H);
    const destLL = this._routeToXY(route.destination, W, LAND_H);

    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(240,192,64,0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const p = this._interpolateArc(originLL, destLL, t);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 2;
    const steps = Math.floor(progress * 60);
    for (let i = 0; i <= steps; i++) {
      const t = i / 60;
      const p = this._interpolateArc(originLL, destLL, t);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    const planePos = this._interpolateArc(originLL, destLL, progress);
    const nextPos = this._interpolateArc(originLL, destLL, Math.min(1, progress + 0.02));
    const angle = Math.atan2(nextPos.y - planePos.y, nextPos.x - planePos.x);

    ctx.save();
    ctx.translate(planePos.x, planePos.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fillStyle = '#f0c040';
    ctx.shadowColor = '#f0c040';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    [originLL, destLL].forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#80b8ff' : '#f0c040';
      ctx.fill();
      ctx.font = '10px Inter,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(i === 0 ? route.origin : route.destination, pt.x + 7, pt.y + 4);
    });

    this._refreshTelemetryBar();
  }

  _routeToXY(code, W, H) {
    const coords = {
      LAX: [-118.4, 33.9], LHR: [-0.5, 51.5], JFK: [-73.8, 40.6], NRT: [139.8, 35.8],
      SFO: [-122.4, 37.6], SIN: [103.9, 1.4], SYD: [151.2, -33.9], ORD: [-87.9, 41.9],
      DXB: [55.4, 25.3], MIA: [-80.3, 25.8], GRU: [-46.5, -23.4], HKG: [113.9, 22.3],
      CDG: [2.5, 49.0], BKK: [100.7, 13.9], TPE: [121.2, 25.1], FRA: [8.6, 50.0],
      PEK: [116.6, 40.1], SCL: [-70.7, -33.4], JNB: [28.2, -26.1], AMS: [4.8, 52.4],
      EZE: [-58.5, -34.6]
    };
    const ll = coords[code] || [0, 0];
    const x = ((ll[0] + 180) / 360) * W;
    const y = ((90 - ll[1]) / 180) * H;
    return { x, y };
  }

  _interpolateArc(a, b, t) {
    const cx = (a.x + b.x) / 2;
    const cy = Math.min(a.y, b.y) - 30;
    const mt = 1 - t;
    return {
      x: mt * mt * a.x + 2 * mt * t * cx + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * cy + t * t * b.y
    };
  }

  _genTailClouds(n) {
    return Array.from({ length: n }, () => ({
      x: Math.random(), y: 0.1 + Math.random() * 0.8,
      rx: 30 + Math.random() * 60, ry: 10 + Math.random() * 20,
      speed: 0.02 + Math.random() * 0.04,
      opacity: 0.3 + Math.random() * 0.4
    }));
  }

  _drawTailCam() {
    const canvas = this._tailCanvas;
    const ctx = this._tailCtx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    this._tailTime += 0.016;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    skyGrad.addColorStop(0, '#0a1828');
    skyGrad.addColorStop(1, '#1a4080');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.65);

    this._tailClouds.forEach(c => {
      const cx = ((c.x + this._tailTime * c.speed) % 1.2 - 0.1) * W;
      const cy = c.y * H;
      ctx.save();
      ctx.globalAlpha = c.opacity;
      ctx.fillStyle = 'rgba(220,230,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    const groundGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
    groundGrad.addColorStop(0, 'rgba(10,20,50,0)');
    groundGrad.addColorStop(0.3, '#0a1430');
    groundGrad.addColorStop(1, '#05080f');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }

  _renderTaskList() {
    const content = this._el && this._el.querySelector('#ife-content');
    if (!content || this.mode !== 'tasks') return;
    const s = this.session.state;
    const tasks = this._tasks;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    content.innerHTML = `
      <div class="ife-tasks-container">
        <div class="ife-tasks-header">
          <span class="ife-tasks-sprint-label">Sprint ${s.currentSprint} Tasks</span>
          <span class="ife-task-count">${doneCount}/${tasks.length} done</span>
        </div>
        <div class="ife-task-input-wrap">
          <input class="ife-task-input" id="task-input" placeholder="Add a task…" type="text" autocomplete="off">
          <button class="ife-task-add-btn" id="task-add-btn">Add</button>
        </div>
        <div class="ife-tasks-list" id="task-list"></div>
      </div>`;

    const input = content.querySelector('#task-input');
    const addBtn = content.querySelector('#task-add-btn');
    const list = content.querySelector('#task-list');

    const addTask = () => {
      const val = input.value.trim();
      if (!val) return;
      this.session.addTask(val);
      input.value = '';
      input.focus();
    };

    addBtn.addEventListener('click', addTask);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

    this._renderTaskItems(list, tasks);

    this._taskUnsub && this._taskUnsub();
    this._taskUnsub = this.session.on('tasksChanged', updatedTasks => {
      this._tasks = updatedTasks;
      if (this.mode === 'tasks') {
        const doneC = updatedTasks.filter(t => t.status === 'done').length;
        const countEl = content.querySelector('.ife-task-count');
        if (countEl) countEl.textContent = `${doneC}/${updatedTasks.length} done`;
        const listEl = content.querySelector('#task-list');
        if (listEl) this._renderTaskItems(listEl, updatedTasks);
      }
    });
  }

  _renderTaskItems(list, tasks) {
    if (!tasks.length) {
      list.innerHTML = '<div style="padding:20px 16px;color:var(--color-text-muted);font-size:12px;">No tasks yet. Add one above.</div>';
      return;
    }
    const grouped = {};
    tasks.forEach(t => {
      if (!grouped[t.sprint]) grouped[t.sprint] = [];
      grouped[t.sprint].push(t);
    });
    list.innerHTML = Object.entries(grouped).map(([sprint, items]) => `
      <div class="task-group-header">Sprint ${sprint}</div>
      ${items.map(t => `
        <div class="task-item ${t.status}" data-id="${t.id}">
          <div class="task-status-dot ${t.status}"></div>
          <span class="task-text">${this._escape(t.text)}</span>
          <span class="task-sprint-badge">S${t.sprint}</span>
        </div>`).join('')}
    `).join('');

    list.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        this.session.cycleTaskStatus(parseInt(item.dataset.id));
      });
    });
  }

  _escape(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  _renderArrived() {
    const content = this._el && this._el.querySelector('#ife-content');
    if (!content) return;
    const s = this.session.state;
    const totalMin = Math.round(s.elapsedSeconds / 60);
    const doneTasks = s.tasks.filter(t => t.status === 'done').length;
    const altitude = Math.round((s.totalCruiseMin * 10000) / 60);

    content.innerHTML = `
      <div class="ife-arrived-container">
        <div class="ife-arrived-title">Welcome to ${s.route.destinationCity}</div>
        <div class="ife-arrived-subtitle">Flight ${s.route.origin}→${s.route.destination} · Session Complete</div>
        <div class="ife-arrived-stats">
          <div class="ife-stat-item">
            <div class="ife-stat-value">${s.completedSprints}</div>
            <div class="ife-stat-label">Sprints Flown</div>
          </div>
          <div class="ife-stat-item">
            <div class="ife-stat-value">${doneTasks}/${s.tasks.length}</div>
            <div class="ife-stat-label">Tasks Done</div>
          </div>
          <div class="ife-stat-item">
            <div class="ife-stat-value">${totalMin}m</div>
            <div class="ife-stat-label">Total Flight Time</div>
          </div>
          <div class="ife-stat-item">
            <div class="ife-stat-value">${s.notes.length}</div>
            <div class="ife-stat-label">Notes Written</div>
          </div>
        </div>
        <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);margin-top:4px;">
          Productivity Altitude: ${altitude.toLocaleString()} ft
        </div>
        <button class="ife-deplane-btn" id="deplane-btn">Deplane & Return</button>
      </div>`;

    content.querySelector('#deplane-btn').addEventListener('click', () => {
      this.close();
      window.dispatchEvent(new CustomEvent('cabin:deplane'));
    });
  }

  _startAnim() {
    const loop = () => {
      this._animId = requestAnimationFrame(loop);
      if (this.mode === 'map' && this._mapCanvas) this._drawMap();
      if (this.mode === 'tailcam' && this._tailCanvas) this._drawTailCam();
    };
    requestAnimationFrame(loop);
  }

  _stopAnim() {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }

  cycleMode() {
    const modes = ['map', 'clock', 'tailcam', 'tasks'];
    const idx = modes.indexOf(this.mode);
    this._switchMode(modes[(idx + 1) % modes.length]);
  }

  showArrived() {
    this._switchMode('arrived');
    this._el && this._el.querySelectorAll('.ife-mode-btn').forEach(b => b.style.display = 'none');
  }
}
