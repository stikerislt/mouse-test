/** Ring buffer for high-frequency mouse samples */
export class RingBuffer {
  constructor(capacity = 120000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.length = 0;
  }

  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.length < this.capacity) this.length++;
  }

  clear() {
    this.head = 0;
    this.length = 0;
  }

  toArray() {
    const out = [];
    const start = this.length < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.length; i++) {
      out.push(this.buffer[(start + i) % this.capacity]);
    }
    return out;
  }

  getRecent(n) {
    const count = Math.min(n, this.length);
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      out.unshift(this.buffer[idx]);
    }
    return out;
  }
}

const listeners = new Set();
let capturing = false;
let locked = false;
let activeElement = null;
let sessionStart = null;
let totalDx = 0;
let totalDy = 0;
let lastDx = 0;
let lastDy = 0;
let lastSpeed = 0;
let lastDt = 0;
let pollIntervals = [];
let lockFailed = false;
const ring = new RingBuffer();

export const inputState = {
  get capturing() { return capturing; },
  get locked() { return locked; },
  get lockFailed() { return lockFailed; },
  get totalDx() { return totalDx; },
  get totalDy() { return totalDy; },
  get lastDx() { return lastDx; },
  get lastDy() { return lastDy; },
  get lastSpeed() { return lastSpeed; },
  get lastDt() { return lastDt; },
  get pollIntervals() { return pollIntervals; },
  ring,
};

export function onInput(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(sample) {
  for (const cb of listeners) {
    try { cb(sample); } catch (err) { console.error(err); }
  }
}

function processMove(dx, dy, t, buttons = 0) {
  if (dx === 0 && dy === 0) return;
  const prev = ring.length > 0 ? ring.buffer[(ring.head - 1 + ring.capacity) % ring.capacity] : null;
  if (prev) {
    lastDt = t - prev.t;
    if (lastDt > 0 && lastDt < 100) pollIntervals.push(lastDt);
    if (pollIntervals.length > 200) pollIntervals.shift();
  } else {
    lastDt = 0;
  }
  lastDx = dx;
  lastDy = dy;
  totalDx += dx;
  totalDy += dy;
  const dist = Math.hypot(dx, dy);
  lastSpeed = lastDt > 0 ? dist / lastDt : 0;
  const sample = { t, dx, dy, buttons, dist, speed: lastSpeed, dt: lastDt };
  ring.push(sample);
  emit(sample);
}

function handleMoveEvent(e) {
  // Only while a test (or Listen) explicitly called startCapture()
  if (!capturing) return;

  const t = performance.now();
  if (typeof e.getCoalescedEvents === 'function') {
    const events = e.getCoalescedEvents();
    if (events.length) {
      for (const ev of events) {
        processMove(ev.movementX || 0, ev.movementY || 0, t, ev.buttons ?? e.buttons);
      }
      return;
    }
  }
  processMove(e.movementX || 0, e.movementY || 0, t, e.buttons);
}

function onPointerLockChange() {
  locked = !!document.pointerLockElement && document.pointerLockElement === activeElement;
  if (!document.pointerLockElement) {
    locked = false;
  }
}

function onPointerLockError() {
  lockFailed = true;
  locked = false;
}

export async function requestLock(el) {
  if (!el) return false;
  activeElement = el;
  lockFailed = false;

  // Ensure element can receive lock
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });

  try {
    const opts = { unadjustedMovement: true };
    const result = el.requestPointerLock(opts);
    if (result && typeof result.then === 'function') {
      await result.catch(() => el.requestPointerLock());
    }
  } catch {
    try { el.requestPointerLock(); } catch { /* ignore */ }
  }

  return new Promise((resolve) => {
    const deadline = performance.now() + 800;
    const check = () => {
      if (document.pointerLockElement === el) {
        locked = true;
        lockFailed = false;
        document.removeEventListener('pointerlockchange', onChange);
        resolve(true);
        return;
      }
      if (performance.now() > deadline) {
        document.removeEventListener('pointerlockchange', onChange);
        lockFailed = !document.pointerLockElement;
        locked = !!document.pointerLockElement;
        resolve(locked);
      }
    };
    const onChange = () => check();
    document.addEventListener('pointerlockchange', onChange);
    setTimeout(check, 50);
    setTimeout(check, 200);
    setTimeout(check, 500);
    setTimeout(check, 800);
  });
}

export function releaseLock() {
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch { /* ignore */ }
  }
  locked = false;
  activeElement = null;
}

/** Begin accepting relative mouse input (with or without pointer lock). */
export function startCapture() {
  capturing = true;
}

export function stopCapture() {
  capturing = false;
  releaseLock();
  // Clear live readout so the status bar doesn't look "active" after stop
  lastDx = 0;
  lastDy = 0;
  lastSpeed = 0;
  stopSession();
}

export function startSession() {
  sessionStart = performance.now();
  totalDx = 0;
  totalDy = 0;
  pollIntervals = [];
}

export function stopSession() {
  sessionStart = null;
}

export function getSessionElapsed() {
  return sessionStart ? performance.now() - sessionStart : 0;
}

export function resetTotals() {
  totalDx = 0;
  totalDy = 0;
  lastDx = 0;
  lastDy = 0;
  lastSpeed = 0;
  pollIntervals = [];
  ring.clear();
}

export function initInput() {
  // Prefer pointer events only — do NOT also attach mousemove (would double-count).
  if (window.PointerEvent) {
    document.addEventListener('pointermove', handleMoveEvent, { passive: true });
  } else {
    document.addEventListener('mousemove', handleMoveEvent, { passive: true });
  }
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);
}

export function getTotalMovement() {
  return Math.hypot(totalDx, totalDy);
}
