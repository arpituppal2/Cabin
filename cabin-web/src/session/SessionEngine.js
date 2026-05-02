import { ROUTES } from './RouteData.js';

export const PHASES = {
  ONBOARDING: 'ONBOARDING',
  BOARDING: 'BOARDING',
  TAXI: 'TAXI',
  TAKEOFF: 'TAKEOFF',
  CRUISE: 'CRUISE',
  BREAK: 'BREAK',
  DESCENT: 'DESCENT',
  LANDING: 'LANDING',
  ARRIVED: 'ARRIVED'
};

const BOARDING_MS  = 5  * 60 * 1000;
const TAKEOFF_MS   = 3  * 60 * 1000;
const DESCENT_MS   = 15 * 60 * 1000;
const LANDING_MS   = 5  * 60 * 1000;

export class SessionEngine {
  constructor() {
    this.state = {
      phase: PHASES.ONBOARDING,
      route: ROUTES[0],
      elapsedMs: 0,
      phaseStartMs: 0,
      sprintDurationMs: 25 * 60 * 1000,
      breakDurationMs:  5  * 60 * 1000,
      taxiDurationMs:   8  * 60 * 1000,
      sprintMsLeft: 25 * 60 * 1000,
      currentSprint: 1,
      completedSprints: 0,
      isOnBreak: false,
      seat: '1A',
      tasks: [],
      notes: '',
      meals: [],
      totalCruiseMs: 120 * 60 * 1000,
    };
    this._listeners = {};
    this._rafId = null;
    this._lastTimestamp = null;
    this._phaseTimers = [];
    this._stopped = false;
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => { this._listeners[event] = this._listeners[event].filter(f => f !== fn); };
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  configure(config) {
    const spMin  = config.sprintDurationMin  || 25;
    const brMin  = config.breakDurationMin   || 5;
    const taxMin = config.taxiDurationMin    || 8;
    const totMin = config.totalCruiseMin     || config.route?.flightTimeMin || 120;

    Object.assign(this.state, {
      seat: config.seat || '1A',
      route: config.route || ROUTES[0],
      totalCruiseMs:    totMin * 60 * 1000,
      sprintDurationMs: spMin  * 60 * 1000,
      breakDurationMs:  brMin  * 60 * 1000,
      taxiDurationMs:   taxMin * 60 * 1000,
      sprintMsLeft:     spMin  * 60 * 1000,
      sprintSecondsLeft: spMin * 60,
      sprintDurationMin: spMin,
      breakDurationMin:  brMin,
      taxiDurationMin:   taxMin,
      elapsedSeconds:    0,
    });
  }

  start() {
    const s = this.state;
    s.phase       = PHASES.BOARDING;
    s.elapsedMs   = 0;
    s.phaseStartMs = 0;
    this._stopped = false;
    this.emit('phaseChange', { phase: PHASES.BOARDING });

    this._schedulePhase(BOARDING_MS, () => this._enterTaxi());
    this._startRAF();
  }

  _startRAF() {
    this._lastTimestamp = null;
    const tick = (timestamp) => {
      if (this._stopped) return;
      let deltaMs = 0;
      if (this._lastTimestamp !== null) {
        deltaMs = Math.min(timestamp - this._lastTimestamp, 200);
      }
      this._lastTimestamp = timestamp;
      this.state.elapsedMs += deltaMs;
      this._onTick(deltaMs);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _onTick(deltaMs) {
    const s = this.state;
    if ((s.phase === PHASES.CRUISE || s.phase === PHASES.BREAK) && !s.isOnBreak) {
      s.sprintMsLeft = Math.max(0, s.sprintMsLeft - deltaMs);
      if (s.sprintMsLeft <= 0) {
        this._enterBreak();
      }
    }
    s.sprintSecondsLeft = s.sprintMsLeft / 1000;
    s.elapsedSeconds    = s.elapsedMs / 1000;
    this._updateTelemetry();
    this.emit('tick', {
      elapsedMs: s.elapsedMs,
      elapsedSeconds: s.elapsedSeconds,
      phase: s.phase,
      sprintMsLeft: s.sprintMsLeft,
      sprintSecondsLeft: s.sprintSecondsLeft,
      currentSprint: s.currentSprint
    });
  }

  _schedulePhase(ms, fn) {
    const id = setTimeout(fn, ms);
    this._phaseTimers.push(id);
    return id;
  }

  _enterTaxi() {
    this._setPhase(PHASES.TAXI);
    this._schedulePhase(this.state.taxiDurationMs, () => this._enterTakeoff());
  }

  _enterTakeoff() {
    this._setPhase(PHASES.TAKEOFF);
    this._schedulePhase(TAKEOFF_MS, () => this._enterCruise());
  }

  _enterCruise() {
    this._setPhase(PHASES.CRUISE);
    this.state.sprintMsLeft = this.state.sprintDurationMs;
    this.state.isOnBreak = false;
    this._schedulePhase(this.state.totalCruiseMs, () => this._enterDescent());
    this._scheduleMeals(this.state.totalCruiseMs);
  }

  _enterBreak() {
    this.state.isOnBreak = true;
    this.state.completedSprints++;
    this._setPhase(PHASES.BREAK);
    this.emit('sprintEnd', { sprint: this.state.currentSprint });
  }

  resumeFromBreak(walkOrStay) {
    if (this.state.phase !== PHASES.BREAK) return;
    const breakMs = this.state.breakDurationMs;
    this.emit('breakStart', { type: walkOrStay, durationSec: breakMs / 1000 });
    this._schedulePhase(breakMs, () => {
      this.state.isOnBreak = false;
      this.state.currentSprint++;
      this.state.sprintMsLeft = this.state.sprintDurationMs;
      this._setPhase(PHASES.CRUISE);
    });
  }

  _enterDescent() {
    this._setPhase(PHASES.DESCENT);
    this._schedulePhase(DESCENT_MS, () => this._enterLanding());
  }

  _enterLanding() {
    this._setPhase(PHASES.LANDING);
    this._schedulePhase(LANDING_MS, () => this._enterArrived());
  }

  _enterArrived() {
    this._setPhase(PHASES.ARRIVED);
    this._stopped = true;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  _setPhase(phase) {
    this.state.phase = phase;
    this.state.phaseStartMs = this.state.elapsedMs;
    this.emit('phaseChange', { phase });
  }

  _scheduleMeals(totalCruiseMs) {
    const schedule = [
      { offsetMin: 90,  type: 'nuts',      label: 'Mixed warm nuts & espresso' },
      { offsetMin: 180, type: 'meal',      label: 'Gourmet main course' },
      { offsetMin: 300, type: 'snack',     label: 'Mid-flight snack' },
      { offsetMin: 480, type: 'breakfast', label: 'Breakfast before landing' }
    ];
    schedule.forEach(meal => {
      const delayMs = meal.offsetMin * 60 * 1000;
      if (delayMs < totalCruiseMs) {
        this._schedulePhase(delayMs, () => {
          if (this.state.phase === PHASES.CRUISE) this.emit('mealService', meal);
        });
      }
    });
  }

  _updateTelemetry() {
    const s = this.state;
    const elapsed = s.elapsedMs;
    const boardingEnd  = BOARDING_MS;
    const taxiEnd      = boardingEnd  + s.taxiDurationMs;
    const takeoffEnd   = taxiEnd      + TAKEOFF_MS;
    const cruiseEnd    = takeoffEnd   + s.totalCruiseMs;
    const descentEnd   = cruiseEnd    + DESCENT_MS;

    const cruise    = s.route.cruiseAltitudeFt || 39000;
    const cruiseSpd = s.route.cruiseSpeedKts   || 490;

    let altitude = 0, speed = 0;

    if (s.phase === PHASES.BOARDING || s.phase === PHASES.TAXI) {
      altitude = 0; speed = 0;
    } else if (s.phase === PHASES.TAKEOFF) {
      const t = Math.min(1, (elapsed - taxiEnd) / TAKEOFF_MS);
      altitude = Math.floor(cruise * Math.pow(t, 0.7));
      speed    = Math.floor(cruiseSpd * Math.pow(t, 0.5));
    } else if (s.phase === PHASES.CRUISE || s.phase === PHASES.BREAK) {
      const t = Math.min(1, (elapsed - takeoffEnd) / (s.totalCruiseMs * 0.12));
      altitude = Math.floor(cruise * 0.85 + cruise * 0.15 * t);
      speed    = Math.floor(cruiseSpd * 0.9 + cruiseSpd * 0.1 * t);
    } else if (s.phase === PHASES.DESCENT) {
      const t = Math.min(1, (elapsed - cruiseEnd) / DESCENT_MS);
      altitude = Math.floor(cruise * (1 - t * 0.98));
      speed    = Math.floor(cruiseSpd * (1 - t * 0.38));
    } else if (s.phase === PHASES.LANDING) {
      const t = Math.min(1, (elapsed - descentEnd) / LANDING_MS);
      altitude = Math.floor(cruise * 0.02 * (1 - t));
      speed    = Math.floor(cruiseSpd * 0.55 * (1 - t));
    }

    const oat = altitude > 100 ? Math.round(15 - (altitude / 1000) * 1.98) : 15;
    const totalFlightMs  = s.route.flightTimeMin ? s.route.flightTimeMin * 60 * 1000 : 600 * 60 * 1000;
    const flightElapsedMs = Math.max(0, elapsed - boardingEnd);
    const timeToDestSec  = Math.max(0, Math.round((totalFlightMs - flightElapsedMs) / 1000));
    const progress       = totalFlightMs > 0 ? Math.min(1, flightElapsedMs / totalFlightMs) : 0;

    this.emit('telemetry', { altitude, speed, timeToDestSec, oat, progress });
  }

  addTask(text) {
    const task = { id: Date.now(), text, status: 'todo', sprint: this.state.currentSprint };
    this.state.tasks.push(task);
    this.emit('tasksChanged', this.state.tasks);
    return task;
  }

  cycleTaskStatus(id) {
    const task = this.state.tasks.find(t => t.id === id);
    if (!task) return;
    task.status = { todo: 'doing', doing: 'done', done: 'todo' }[task.status];
    this.emit('tasksChanged', this.state.tasks);
  }

  updateNotes(text) { this.state.notes = text; }

  reset() {
    this._stopped = true;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._phaseTimers.forEach(id => clearTimeout(id));
    this._phaseTimers = [];
    const spMin = 25, brMin = 5;
    this.state = {
      phase: PHASES.ONBOARDING,
      route: ROUTES[0],
      elapsedMs: 0,
      elapsedSeconds: 0,
      phaseStartMs: 0,
      sprintDurationMs: spMin * 60 * 1000,
      breakDurationMs:  brMin * 60 * 1000,
      taxiDurationMs:   8 * 60 * 1000,
      sprintMsLeft:     spMin * 60 * 1000,
      sprintSecondsLeft: spMin * 60,
      sprintDurationMin: spMin,
      breakDurationMin:  brMin,
      taxiDurationMin:   8,
      currentSprint: 1,
      completedSprints: 0,
      isOnBreak: false,
      seat: '1A',
      tasks: [],
      notes: '',
      meals: [],
      totalCruiseMs: 120 * 60 * 1000,
    };
  }
}
