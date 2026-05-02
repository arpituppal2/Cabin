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

const BOARDING_MIN = 5;
const TAKEOFF_MIN = 3;
const DESCENT_MIN = 15;
const LANDING_MIN = 5;

export class SessionEngine {
  constructor() {
    this.state = {
      phase: PHASES.ONBOARDING,
      route: ROUTES[0],
      sessionStartTime: null,
      elapsedSeconds: 0,
      phaseStartSeconds: 0,
      currentSprint: 1,
      sprintDurationMin: 25,
      breakDurationMin: 5,
      taxiDurationMin: 8,
      isOnBreak: false,
      seat: '1A',
      tasks: [],
      notes: '',
      completedSprints: 0,
      meals: [],
      totalCruiseMin: 120,
      sprintSecondsLeft: 0,
      notebookOpenedThisSprint: false
    };
    this._listeners = {};
    this._phaseTimer = null;
    this._tickInterval = null;
    this._lastTick = null;
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
    Object.assign(this.state, {
      seat: config.seat || '1A',
      route: config.route || ROUTES[0],
      totalCruiseMin: config.totalCruiseMin || config.route?.flightTimeMin || 120,
      sprintDurationMin: config.sprintDurationMin || 25,
      breakDurationMin: config.breakDurationMin || 5,
      taxiDurationMin: config.taxiDurationMin || 8
    });
    this.state.sprintSecondsLeft = this.state.sprintDurationMin * 60;
  }

  start() {
    this.state.phase = PHASES.BOARDING;
    this.state.sessionStartTime = Date.now();
    this.state.elapsedSeconds = 0;
    this.state.phaseStartSeconds = 0;
    this._startTick();
    this.emit('phaseChange', { phase: PHASES.BOARDING });
    this._schedulePhase(BOARDING_MIN * 60, () => this._enterTaxi());
  }

  _startTick() {
    this._lastTick = Date.now();
    this._tickInterval = setInterval(() => {
      const now = Date.now();
      const delta = (now - this._lastTick) / 1000;
      this._lastTick = now;
      this.state.elapsedSeconds += delta;
      this._onTick(delta);
    }, 250);
  }

  _onTick(delta) {
    const s = this.state;
    if (s.phase === PHASES.CRUISE) {
      s.sprintSecondsLeft = Math.max(0, s.sprintSecondsLeft - delta);
      if (s.sprintSecondsLeft <= 0 && !s.isOnBreak) {
        this._enterBreak();
      }
    }
    this.emit('tick', {
      elapsedSeconds: s.elapsedSeconds,
      phase: s.phase,
      sprintSecondsLeft: s.sprintSecondsLeft,
      currentSprint: s.currentSprint
    });
    this._updateTelemetry();
  }

  _schedulePhase(seconds, fn) {
    if (this._phaseTimer) clearTimeout(this._phaseTimer);
    this._phaseTimer = setTimeout(fn, seconds * 1000);
  }

  _enterTaxi() {
    this._setPhase(PHASES.TAXI);
    this._schedulePhase(this.state.taxiDurationMin * 60, () => this._enterTakeoff());
  }

  _enterTakeoff() {
    this._setPhase(PHASES.TAKEOFF);
    this._schedulePhase(TAKEOFF_MIN * 60, () => this._enterCruise());
  }

  _enterCruise() {
    this._setPhase(PHASES.CRUISE);
    this.state.sprintSecondsLeft = this.state.sprintDurationMin * 60;
    this.state.notebookOpenedThisSprint = false;
    const cruiseSec = this.state.totalCruiseMin * 60;
    this._schedulePhase(cruiseSec, () => this._enterDescent());
    this._scheduleMeals(cruiseSec);
  }

  _enterBreak() {
    this.state.isOnBreak = true;
    this.state.completedSprints++;
    this._setPhase(PHASES.BREAK);
    this.emit('sprintEnd', { sprint: this.state.currentSprint });
  }

  resumeFromBreak(walkOrStay) {
    if (this.state.phase !== PHASES.BREAK) return;
    const breakSec = this.state.breakDurationMin * 60;
    setTimeout(() => {
      this.state.isOnBreak = false;
      this.state.currentSprint++;
      this.state.sprintSecondsLeft = this.state.sprintDurationMin * 60;
      this.state.notebookOpenedThisSprint = false;
      this._setPhase(PHASES.CRUISE);
    }, breakSec * 1000);
    this.emit('breakStart', { type: walkOrStay, durationSec: breakSec });
  }

  _enterDescent() {
    this._setPhase(PHASES.DESCENT);
    this._schedulePhase(DESCENT_MIN * 60, () => this._enterLanding());
  }

  _enterLanding() {
    this._setPhase(PHASES.LANDING);
    this._schedulePhase(LANDING_MIN * 60, () => this._enterArrived());
  }

  _enterArrived() {
    this._setPhase(PHASES.ARRIVED);
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  _setPhase(phase) {
    this.state.phase = phase;
    this.state.phaseStartSeconds = this.state.elapsedSeconds;
    this.emit('phaseChange', { phase });
  }

  _scheduleMeals(totalCruiseSec) {
    const schedule = [
      { offsetMin: 90, type: 'nuts', label: 'Mixed warm nuts & espresso' },
      { offsetMin: 180, type: 'meal', label: 'Gourmet main course' },
      { offsetMin: 300, type: 'snack', label: 'Mid-flight snack' },
      { offsetMin: 480, type: 'breakfast', label: 'Breakfast before landing' }
    ];
    schedule.forEach(meal => {
      const delaySec = meal.offsetMin * 60;
      if (delaySec < totalCruiseSec) {
        setTimeout(() => {
          if (this.state.phase === PHASES.CRUISE) {
            this.emit('mealService', meal);
          }
        }, delaySec * 1000);
      }
    });
  }

  _updateTelemetry() {
    const s = this.state;
    const phase = s.phase;
    const elapsed = s.elapsedSeconds;
    const boardingEnd = BOARDING_MIN * 60;
    const taxiEnd = boardingEnd + s.taxiDurationMin * 60;
    const takeoffEnd = taxiEnd + TAKEOFF_MIN * 60;
    const cruiseEnd = takeoffEnd + s.totalCruiseMin * 60;
    const descentEnd = cruiseEnd + DESCENT_MIN * 60;
    const landingEnd = descentEnd + LANDING_MIN * 60;

    let altitude = 0;
    let speed = 0;
    const cruise = s.route.cruiseAltitudeFt;
    const cruiseSpd = s.route.cruiseSpeedKts;

    if (phase === PHASES.BOARDING || phase === PHASES.TAXI) {
      altitude = 0; speed = 0;
    } else if (phase === PHASES.TAKEOFF) {
      const t = Math.min(1, (elapsed - taxiEnd) / (TAKEOFF_MIN * 60));
      altitude = Math.pow(t, 1.5) * cruise * 0.6;
      speed = t * cruiseSpd * 0.85;
    } else if (phase === PHASES.CRUISE || phase === PHASES.BREAK) {
      const t = Math.min(1, (elapsed - takeoffEnd) / (s.totalCruiseMin * 60 * 0.15));
      altitude = cruise * 0.6 + t * cruise * 0.4;
      speed = cruiseSpd * 0.85 + t * cruiseSpd * 0.15;
    } else if (phase === PHASES.DESCENT) {
      const t = Math.min(1, (elapsed - cruiseEnd) / (DESCENT_MIN * 60));
      altitude = cruise * (1 - t * 0.95);
      speed = cruiseSpd * (1 - t * 0.4);
    } else if (phase === PHASES.LANDING) {
      const t = Math.min(1, (elapsed - descentEnd) / (LANDING_MIN * 60));
      altitude = cruise * 0.05 * (1 - t);
      speed = cruiseSpd * 0.6 * (1 - t * 0.85);
    }

    const totalFlight = s.route.flightTimeMin * 60;
    const flightElapsed = Math.max(0, elapsed - boardingEnd);
    const timeToDestSec = Math.max(0, totalFlight - flightElapsed);
    const oat = altitude > 1000 ? -57 + (1 - altitude / cruise) * 72 : 15;
    const progress = totalFlight > 0 ? Math.min(1, flightElapsed / totalFlight) : 0;

    this.emit('telemetry', { altitude, speed, timeToDestSec, oat, progress });
  }

  addTask(text) {
    const task = {
      id: Date.now(),
      text,
      status: 'todo',
      sprint: this.state.currentSprint
    };
    this.state.tasks.push(task);
    this.emit('tasksChanged', this.state.tasks);
    return task;
  }

  cycleTaskStatus(id) {
    const task = this.state.tasks.find(t => t.id === id);
    if (!task) return;
    const cycle = { todo: 'doing', doing: 'done', done: 'todo' };
    task.status = cycle[task.status];
    this.emit('tasksChanged', this.state.tasks);
  }

  updateNotes(text) {
    this.state.notes = text;
  }

  reset() {
    if (this._tickInterval) clearInterval(this._tickInterval);
    if (this._phaseTimer) clearTimeout(this._phaseTimer);
    this.state = {
      phase: PHASES.ONBOARDING,
      route: ROUTES[0],
      sessionStartTime: null,
      elapsedSeconds: 0,
      phaseStartSeconds: 0,
      currentSprint: 1,
      sprintDurationMin: 25,
      breakDurationMin: 5,
      taxiDurationMin: 8,
      isOnBreak: false,
      seat: '1A',
      tasks: [],
      notes: '',
      completedSprints: 0,
      meals: [],
      totalCruiseMin: 120,
      sprintSecondsLeft: 0,
      notebookOpenedThisSprint: false
    };
  }
}
