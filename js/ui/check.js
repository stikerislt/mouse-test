import {
  CHECK_META, CHECK_IDS, PAD_PRESETS, recommendedTapeCm,
  scoreConnection, scoreSensorAtRest, scoreSmoothness,
  scoreLiftTracking, scoreSwipeConsistency, scoreAcceleration,
} from '../core/checks.js';
import { saveConfig, loadConfig } from '../core/storage.js';
import { resetSession, saveTestResult } from '../core/sessionState.js';
import {
  startCapture, stopCapture, onInput, resetTotals, startSession,
  requestLock, releaseLock,
} from '../core/input.js';
import { formatNum } from '../core/stats.js';
import { renderVerdict } from './verdict.js';
import { setRestartCallback, setStopCallback } from './shell.js';

const REST_MS = 20000;
const CONNECTION_MS = 5000;
const SWIPE_IDLE_MS = 150;
const MIN_SWIPE_DIST = 50;
const SMOOTHNESS_MIN_MS = 4000;
const SMOOTHNESS_MAX_MS = 10000;
const SMOOTHNESS_MIN_SAMPLES = 5;

export function renderCheck(container) {
  const config = loadConfig();
  let phase = config.setupComplete ? 'welcome' : 'setup';
  let stepIndex = 0;
  let unsub = null;
  let raf = null;
  let running = false;
  let checkResults = {};
  let stepState = {};
  let captureArea = null;

  function cleanup() {
    running = false;
    stopCapture();
    releaseLock();
    unsub?.();
    unsub = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    setStopCallback(null);
  }

  function render() {
    cleanup();
    if (phase === 'setup') renderSetup();
    else if (phase === 'welcome') renderWelcome();
    else if (phase === 'running') renderStep();
    else if (phase === 'verdict') renderVerdict(container, checkResults, () => restart());
  }

  function restart() {
    checkResults = {};
    resetSession();
    stepIndex = 0;
    phase = loadConfig().setupComplete ? 'welcome' : 'setup';
    render();
  }

  function renderSetup() {
    const cfg = loadConfig();
    container.innerHTML = `
      <div class="flow-screen welcome-screen">
        <div class="flow-hero">
          <span class="brand-mark-lg">◈</span>
          <h1>Calibra</h1>
          <p class="flow-lead">Check if your mouse and mousepad are working consistently — in about 3 minutes.</p>
        </div>
        <div class="card flow-card">
          <h2>Quick setup</h2>
          <p class="hint">We only need two things. You can change these later.</p>
          <div class="form-row">
            <div class="form-field">
              <label>Mouse DPI</label>
              <input type="number" id="setup-dpi" value="${cfg.dpi || 800}" min="100" max="32000" step="50">
              <p class="hint">Find this in Logitech G Hub, Razer Synapse, or your mouse app. Common: 400, 800, 1600.</p>
            </div>
            <div class="form-field">
              <label>Mousepad width (cm)</label>
              <input type="number" id="setup-pad" value="${cfg.padWidth || 45}" min="10" max="150">
              <div class="preset-row">
                ${PAD_PRESETS.map(p => `<button type="button" class="btn btn-ghost btn-sm pad-preset" data-cm="${p.cm}">${p.label} (${p.cm} cm)</button>`).join('')}
              </div>
              <p class="hint">Measure left to right across the cloth you actually use.</p>
            </div>
          </div>
          <button class="btn btn-primary btn-lg" id="setup-continue">Continue</button>
        </div>
      </div>
    `;
    container.querySelector('#setup-continue').addEventListener('click', () => {
      const dpi = parseFloat(container.querySelector('#setup-dpi').value) || 800;
      const padWidth = parseFloat(container.querySelector('#setup-pad').value) || 45;
      saveConfig({ dpi, padWidth, setupComplete: true });
      phase = 'welcome';
      render();
    });
    container.querySelectorAll('.pad-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelector('#setup-pad').value = btn.dataset.cm;
      });
    });
  }

  function renderWelcome() {
    const cfg = loadConfig();
    const tape = recommendedTapeCm(cfg.padWidth || 45);
    container.innerHTML = `
      <div class="flow-screen welcome-screen">
        <div class="flow-hero">
          <h1>Ready to check your mouse?</h1>
          <p class="flow-lead">Six quick checks — no aim skill required. We'll tell you if something looks off.</p>
        </div>
        <ul class="check-preview-list">
          ${CHECK_IDS.map((id, i) => `
            <li><span class="check-preview-num">${i + 1}</span>
              <span><strong>${CHECK_META[id].title}</strong> — ${CHECK_META[id].question}</span>
            </li>
          `).join('')}
        </ul>
        <div class="card flow-card flow-tip">
          <p><strong>Before you start:</strong> For one check you'll need two tape marks about <strong>${formatNum(tape, 0)} cm</strong> apart on your pad. Everything else needs no setup.</p>
          <p class="hint">Turn off Windows "Enhance pointer precision" for best results.</p>
        </div>
        <button class="btn btn-primary btn-lg" id="start-check">Start check</button>
      </div>
    `;
    container.querySelector('#start-check').addEventListener('click', () => {
      checkResults = {};
      resetSession();
      stepIndex = 0;
      phase = 'running';
      render();
    });
  }

  function renderStep() {
    const id = CHECK_IDS[stepIndex];
    const meta = CHECK_META[id];
    const cfg = loadConfig();
    const tape = recommendedTapeCm(cfg.padWidth || 45);
    const progress = ((stepIndex) / CHECK_IDS.length) * 100;

    let extra = '';
    if (id === 'swipeConsistency' || id === 'acceleration') {
      extra = `<p class="flow-tip-inline">Put two tape marks <strong>${formatNum(tape, 0)} cm</strong> apart on your pad first.</p>`;
    }
    if (id === 'liftTracking') {
      extra = `<p class="lift-space-hint">Each time you lift the mouse, press <kbd>Space</kbd> on your keyboard (not a mouse button).</p>`;
    }
    if (id === 'acceleration') {
      extra = `<p class="flow-phase" id="accel-phase">Phase: <strong>Slow swipes</strong> (3 needed)</p>`;
    }

    container.innerHTML = `
      <div class="flow-screen check-screen">
        <div class="check-progress">
          <div class="check-progress-bar" style="width:${progress}%"></div>
          <span class="check-progress-label">Step ${stepIndex + 1} of ${CHECK_IDS.length}</span>
        </div>
        <div class="check-header">
          <h1>${meta.title}</h1>
          <p class="flow-lead">${meta.question}</p>
        </div>
        <div class="check-area" id="check-area" tabindex="-1">
          <button type="button" class="btn btn-ghost btn-sm check-skip-floating" id="step-skip-locked" hidden>Skip (Esc)</button>
          <div class="check-area-inner" id="check-live">
            <span class="check-pulse"></span>
            <span id="check-status">Tap Start when ready</span>
          </div>
          ${id === 'liftTracking' ? '<p class="lift-space-prompt"><kbd>Space</kbd> = I lifted the mouse</p>' : ''}
        </div>
        <p class="check-instruction">${meta.instruction}</p>
        ${extra}
        <div class="check-actions">
          <button class="btn btn-primary btn-lg" id="step-start">Start this step</button>
          <button class="btn btn-ghost" id="step-skip">Skip step</button>
        </div>
        <p class="hint check-esc-hint">${id === 'liftTracking' ? 'Press <kbd>Space</kbd> when you lift. <kbd>Esc</kbd> to skip.' : 'While a step is running, press <kbd>Esc</kbd> to skip.'}</p>
      </div>
    `;

    captureArea = container.querySelector('#check-area');
    const statusEl = container.querySelector('#check-status');
    const startBtn = container.querySelector('#step-start');
    const skipBtn = container.querySelector('#step-skip');
    const skipLockedBtn = container.querySelector('#step-skip-locked');
    let stepCleanup = null;

    function setStatus(msg, cls = '') {
      statusEl.textContent = msg;
      statusEl.className = cls;
    }

    function finishStep(result) {
      running = false;
      stopCapture();
      releaseLock();
      unsub?.();
      unsub = null;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      stepCleanup?.();
      stepCleanup = null;
      setStopCallback(null);
      if (skipLockedBtn) skipLockedBtn.hidden = true;
      checkResults[id] = result;
      saveTestResult(id, result);
      stepIndex++;
      if (stepIndex >= CHECK_IDS.length) {
        phase = 'verdict';
        render();
      } else {
        render();
      }
    }

    function skipStep() {
      releaseLock();
      finishStep({
        id,
        score: null,
        status: 'fail',
        summary: 'Skipped.',
        fix: 'Run the check again to include this step.',
        data: { skipped: true },
      });
    }

    skipBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      skipStep();
    });
    skipLockedBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      skipStep();
    });

    setStopCallback(() => {
      if (running) skipStep();
    });

    startBtn.addEventListener('click', async () => {
      if (running) return;
      running = true;
      startBtn.disabled = true;
      const needsLock = id !== 'liftTracking';
      if (needsLock && skipLockedBtn) skipLockedBtn.hidden = false;
      resetTotals();
      startSession();
      startCapture();
      captureArea.classList.add('active');

      stepState = createStepState(id, cfg);

      if (id === 'liftTracking') {
        setStatus('Move on pad → lift mouse → press Space (3 times)', 'active');
        let lastClient = null;
        const onPtr = (e) => {
          if (!running) return;
          if (lastClient) {
            const dx = e.clientX - lastClient.x;
            const dy = e.clientY - lastClient.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.5) {
              handleStepInput(id, { dx, dy, dist, dt: 16, speed: 0 }, stepState, setStatus, finishStep);
            }
          }
          lastClient = { x: e.clientX, y: e.clientY };
        };
        const onSpace = (e) => {
          if (!running || e.code !== 'Space') return;
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          e.preventDefault();
          markLift(stepState, setStatus, (result) => finishStep(result));
        };
        document.addEventListener('pointermove', onPtr);
        document.addEventListener('keydown', onSpace);
        stepCleanup = () => {
          document.removeEventListener('pointermove', onPtr);
          document.removeEventListener('keydown', onSpace);
        };
      } else {
        setStatus('Checking…', 'active');
        await requestLock(captureArea);
      }

      unsub = onInput((sample) => {
        if (!running) return;
        handleStepInput(id, sample, stepState, setStatus, finishStep, container);
      });

      function tick() {
        if (!running) return;
        handleStepTick(id, stepState, setStatus, finishStep);
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    });
  }

  if (!config.setupComplete) phase = 'setup';
  setRestartCallback(() => restart());
  render();

  return cleanup;
}

function createStepState(id, cfg) {
  const base = { startAt: performance.now() };
  switch (id) {
    case 'connection':
      return { ...base, intervals: [] };
    case 'sensorAtRest':
      return { ...base, movements: [], totalMove: 0, events: 0 };
    case 'smoothness': {
      const dpi = cfg.dpi || 800;
      return { ...base, microMoves: [], maxDist: Math.max(12, Math.round(dpi / 60)), dpi };
    }
    case 'liftTracking':
      return { ...base, lifts: [], liftStart: null, lastMark: 0 };
    case 'swipeConsistency':
      return { ...base, runs: [], swipeDx: 0, swipeDy: 0, swiping: false, idleTimer: null };
    case 'acceleration':
      return {
        ...base,
        phase: 'slow',
        slow: [],
        fast: [],
        swipeCounts: 0,
        swiping: false,
        idleTimer: null,
      };
    default:
      return base;
  }
}

function handleStepInput(id, sample, state, setStatus, finishStep) {
  switch (id) {
    case 'connection':
      if (sample.dt > 0 && sample.dt < 50) state.intervals.push(sample.dt);
      break;
    case 'sensorAtRest':
      if (sample.dist > 0) {
        state.events++;
        state.totalMove += sample.dist;
        state.movements.push(sample);
      }
      break;
    case 'smoothness':
      if (sample.dist <= 0) break;
      // Accept gentle motion: small per-tick steps or low speed (not fast swipes).
      if (sample.dist <= state.maxDist || (sample.speed > 0 && sample.speed < 4)) {
        state.microMoves.push({ dx: sample.dx, dy: sample.dy });
      }
      break;
    case 'liftTracking':
      if (state.liftStart && state.lifts.length) {
        const age = performance.now() - state.liftStart;
        if (age < 400 && sample.dist > 0) {
          const last = state.lifts[state.lifts.length - 1];
          last.duration = age;
          last.distance += sample.dist;
        }
      }
      break;
    case 'swipeConsistency':
      if (!state.swiping && (sample.dx !== 0 || sample.dy !== 0)) state.swiping = true;
      state.swipeDx += sample.dx;
      state.swipeDy += sample.dy;
      clearTimeout(state.idleTimer);
      state.idleTimer = setTimeout(() => {
        if (state.swiping) {
          const dist = Math.hypot(state.swipeDx, state.swipeDy);
          if (dist > MIN_SWIPE_DIST) {
            state.runs.push(dist);
            setStatus(`Swipe ${state.runs.length} recorded — swipe again`);
            if (state.runs.length >= 5) {
              finishStep(scoreSwipeConsistency(state.runs));
            }
          }
          state.swipeDx = 0;
          state.swipeDy = 0;
          state.swiping = false;
        }
      }, SWIPE_IDLE_MS);
      break;
    case 'acceleration': {
      if (!state.swiping && sample.dist > 0) state.swiping = true;
      state.swipeCounts += sample.dist;
      clearTimeout(state.idleTimer);
      state.idleTimer = setTimeout(() => {
        if (state.swiping && state.swipeCounts > 30) {
          const bucket = state.phase === 'slow' ? state.slow : state.fast;
          bucket.push(state.swipeCounts);
          state.swipeCounts = 0;
          state.swiping = false;
          const needed = 3;
          const phaseEl = document.getElementById('accel-phase');
          if (state.phase === 'slow' && state.slow.length >= needed) {
            state.phase = 'fast';
            if (phaseEl) phaseEl.innerHTML = 'Phase: <strong>Fast swipes</strong> (3 needed)';
            setStatus('Now swipe quickly between the marks');
          } else if (state.phase === 'fast' && state.fast.length >= needed) {
            finishStep(scoreAcceleration({ slow: state.slow, fast: state.fast }));
          } else {
            const n = state.phase === 'slow' ? state.slow.length : state.fast.length;
            setStatus(`${state.phase === 'slow' ? 'Slow' : 'Fast'} swipe ${n}/${needed}`);
          }
        }
      }, 200);
      break;
    }
  }
}

function handleStepTick(id, state, setStatus, finishStep) {
  const elapsed = performance.now() - state.startAt;
  switch (id) {
    case 'connection': {
      const remaining = Math.max(0, CONNECTION_MS - elapsed);
      setStatus(`Move your mouse… ${Math.ceil(remaining / 1000)}s left`, 'active');
      if (elapsed >= CONNECTION_MS && state.intervals.length >= 20) {
        finishStep(scoreConnection(state.intervals));
      } else if (elapsed >= CONNECTION_MS + 2000) {
        finishStep(scoreConnection(state.intervals));
      }
      break;
    }
    case 'sensorAtRest': {
      const remaining = Math.max(0, REST_MS - elapsed);
      setStatus(`Hands off… ${Math.ceil(remaining / 1000)}s`, 'active');
      if (elapsed >= REST_MS) {
        finishStep(scoreSensorAtRest({
          totalMove: state.totalMove,
          events: state.events,
          durationMs: elapsed,
        }));
      }
      break;
    }
    case 'smoothness': {
      const needed = SMOOTHNESS_MIN_SAMPLES;
      const left = Math.max(0, Math.ceil((SMOOTHNESS_MAX_MS - elapsed) / 1000));
      if (state.microMoves.length === 0 && elapsed > 2000) {
        setStatus('Move slowly inside the box — or press Esc to skip', 'active');
      } else {
        setStatus(`${state.microMoves.length}/${needed} gentle samples (${left}s left)`, 'active');
      }
      if (state.microMoves.length >= needed && elapsed >= SMOOTHNESS_MIN_MS) {
        finishStep(scoreSmoothness(state.microMoves, state.dpi));
      } else if (elapsed >= SMOOTHNESS_MAX_MS) {
        finishStep(scoreSmoothness(state.microMoves, state.dpi));
      }
      break;
    }
    case 'liftTracking':
      if (state.lifts.length) {
        setStatus(`Lift ${state.lifts.length}/3 — move, lift, press Space`, 'active');
      }
      break;
    case 'swipeConsistency':
      setStatus(state.runs.length
        ? `${state.runs.length}/5 swipes — same path each time`
        : 'Swipe between your tape marks', 'active');
      break;
    case 'acceleration':
      break;
  }
}

function markLift(state, setStatus, finishStep) {
  const now = performance.now();
  if (state.lastMark && now - state.lastMark < 500) return;
  state.lastMark = now;
  state.liftStart = now;
  state.lifts.push({ duration: 0, distance: 0, t: now });
  const n = state.lifts.length;
  setStatus(`Lift ${n}/3 recorded — move on pad again, then lift + Space`, 'active');
  if (n >= 3) {
    setTimeout(() => finishStep(scoreLiftTracking(state.lifts)), 420);
  }
}
