import { ROUTES, formatFlightTime } from '../session/RouteData.js';

const SEATS = [
  { id: '1A', label: '1A — True Left Window', desc: 'Maximum privacy. Cocooned beside the window. Console shields you from the aisle.', window: true, row: 1, col: 0 },
  { id: '1D', label: '1D — Center Left Aisle', desc: 'Aisle-facing. Good view across to the window. Console in center.', window: false, row: 1, col: 2 },
  { id: '1G', label: '1G — Center Right Aisle', desc: 'Mirror of 1D. Aisle to your left. Spacious feel.', window: false, row: 1, col: 4 },
  { id: '1L', label: '1L — True Right Window', desc: 'Maximum privacy on the right side. Best window view.', window: true, row: 1, col: 6 },
  { id: '2B', label: '2B — Left Aisle', desc: 'Open and airy. Best for less enclosed focus. Aisle immediately to the right.', window: false, row: 2, col: 1 },
  { id: '2D', label: '2D — Center Left Center', desc: 'Tucked inward. Honeymoon seat. Intimate and sheltered.', window: false, row: 2, col: 2 },
  { id: '2G', label: '2G — Center Right Center', desc: 'Mirror of 2D. Enclosed. Private. Focused.', window: false, row: 2, col: 4 },
  { id: '2J', label: '2J — Right Aisle', desc: 'Open feel, right-side aisle. Energetic atmosphere.', window: false, row: 2, col: 5 }
];

export class SeatSelector {
  constructor(container) {
    this.container = container;
    this.selectedSeat = '1A';
    this.selectedRoute = ROUTES[0];
    this.totalMin = ROUTES[0].flightTimeMin;
    this.sprintMin = 25;
    this.breakMin = 5;
    this.taxiMin = 8;
    this._onBoardCb = null;
    this._tooltip = null;
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

      <div class="seat-map-container">
        <div class="seat-map-label">Select Your Seat</div>
        <div class="seat-map-svg-wrap">
          <svg id="seat-map" viewBox="0 0 620 180" width="580" height="170" style="max-width:100%;overflow:visible;">
            ${this._buildSeatSVG()}
          </svg>
        </div>
      </div>

      <div class="config-section">
        <div class="config-section-title">Route</div>
        <div class="config-row">
          <select id="route-select" class="config-select">
            ${ROUTES.map(r => `<option value="${r.id}">${r.origin} → ${r.destination} — ${r.originCity} to ${r.destinationCity} (${formatFlightTime(r.flightTimeMin)})</option>`).join('')}
          </select>
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

      <button class="board-btn" id="board-btn">Board Flight →</button>
    `;

    this.container.appendChild(el);

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'seat-tooltip';
    document.body.appendChild(this._tooltip);

    this._bindEvents(el);
    this._drawStars();
    this._updateSeatSelection(this.selectedSeat);
  }

  _buildSeatSVG() {
    const seats = [
      { id: '1A', x: 20, y: 20 },
      { id: '1D', x: 165, y: 20 },
      { id: '1G', x: 330, y: 20 },
      { id: '1L', x: 480, y: 20 },
      { id: '2B', x: 90, y: 100 },
      { id: '2D', x: 185, y: 100 },
      { id: '2G', x: 310, y: 100 },
      { id: '2J', x: 410, y: 100 }
    ];

    const aisleLines = `
      <line x1="148" y1="0" x2="148" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="4,6"/>
      <line x1="310" y1="0" x2="310" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="4,6"/>
      <line x1="465" y1="0" x2="465" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="4,6"/>
    `;

    const rowLabels = `
      <text x="590" y="48" fill="rgba(255,255,255,0.2)" font-family="Inter,sans-serif" font-size="10" letter-spacing="1">ROW 1</text>
      <text x="590" y="128" fill="rgba(255,255,255,0.2)" font-family="Inter,sans-serif" font-size="10" letter-spacing="1">ROW 2</text>
    `;

    const seatPaths = seats.map(s => {
      const seat = SEATS.find(seat => seat.id === s.id);
      return `
        <g class="seat-svg-group" data-seat="${s.id}" style="cursor:pointer;">
          <rect class="seat-rect" data-seat="${s.id}" x="${s.x}" y="${s.y}" width="55" height="50" rx="4"
            fill="#1e1e2a" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <rect data-seat="${s.id}" x="${s.x + 10}" y="${s.y - 8}" width="35" height="12" rx="3"
            fill="#1a1a26" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
          <text data-seat="${s.id}" x="${s.x + 27}" y="${s.y + 30}" text-anchor="middle"
            fill="rgba(255,255,255,0.5)" font-family="Inter,sans-serif" font-size="11" font-weight="500"
            letter-spacing="0.5">${s.id}</text>
          ${seat && seat.window ? `<circle data-seat="${s.id}" cx="${s.x + 48}" cy="${s.y + 10}" r="4" fill="rgba(135,200,235,0.4)" stroke="rgba(135,200,235,0.6)" stroke-width="1"/>` : ''}
        </g>
      `;
    }).join('');

    return aisleLines + seatPaths + rowLabels;
  }

  _bindEvents(el) {
    const map = el.querySelector('#seat-map');
    map.querySelectorAll('[data-seat]').forEach(node => {
      node.addEventListener('click', e => {
        const id = e.currentTarget.dataset.seat || e.target.dataset.seat;
        if (id) this._updateSeatSelection(id);
      });
      node.addEventListener('mouseenter', e => {
        const id = e.currentTarget.dataset.seat || e.target.dataset.seat;
        if (id) this._showTooltip(e, id);
      });
      node.addEventListener('mouseleave', () => this._hideTooltip());
      node.addEventListener('mousemove', e => {
        this._tooltip.style.left = (e.clientX + 14) + 'px';
        this._tooltip.style.top = (e.clientY - 10) + 'px';
      });
    });

    el.querySelector('#route-select').addEventListener('change', e => {
      this.selectedRoute = ROUTES.find(r => r.id === e.target.value) || ROUTES[0];
      this.totalMin = this.selectedRoute.flightTimeMin;
      el.querySelector('#session-slider').value = this.totalMin;
      el.querySelector('#session-time-val').textContent = formatFlightTime(this.totalMin);
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
      if (this._onBoardCb) {
        this._onBoardCb({
          seat: this.selectedSeat,
          route: this.selectedRoute,
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
    document.querySelectorAll('.seat-rect').forEach(r => {
      const id = r.dataset.seat;
      if (id === seatId) {
        r.setAttribute('fill', '#c8a96e');
        r.setAttribute('stroke', '#e0c080');
      } else {
        r.setAttribute('fill', '#1e1e2a');
        r.setAttribute('stroke', 'rgba(255,255,255,0.12)');
      }
    });
    document.querySelectorAll('[data-seat]').forEach(el => {
      if (el.tagName === 'text') {
        el.setAttribute('fill', el.dataset.seat === seatId ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.5)');
      }
    });
  }

  _showTooltip(e, seatId) {
    const seat = SEATS.find(s => s.id === seatId);
    if (!seat) return;
    this._tooltip.innerHTML = `<strong>${seat.label}</strong>${seat.desc}`;
    this._tooltip.style.left = (e.clientX + 14) + 'px';
    this._tooltip.style.top = (e.clientY - 10) + 'px';
    this._tooltip.classList.add('visible');
  }

  _hideTooltip() {
    this._tooltip.classList.remove('visible');
  }

  _drawStars() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const parent = canvas.parentElement;
    const W = (parent ? parent.offsetWidth : window.innerWidth) || window.innerWidth;
    const H = Math.max(window.innerHeight, parent ? parent.scrollHeight : window.innerHeight);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.2 + 0.2;
      const a = Math.random() * 0.4 + 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    }
  }

  destroy() {
    if (this._tooltip && this._tooltip.parentNode) {
      this._tooltip.parentNode.removeChild(this._tooltip);
    }
    this.container.innerHTML = '';
  }
}
