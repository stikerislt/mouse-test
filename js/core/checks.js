/**
 * Pure scoring for the 6 hardware checks.
 * Each returns { id, score, status, summary, fix, data }.
 * status: 'pass' | 'warn' | 'fail'
 */

import { mean, stdDev, consistencyScore, estimatePollingRate } from './stats.js';

export const CHECK_IDS = [
  'connection',
  'sensorAtRest',
  'smoothness',
  'liftTracking',
  'swipeConsistency',
  'acceleration',
];

export const CHECK_META = {
  connection: {
    title: 'Connection',
    question: 'Is your mouse reporting steadily?',
    instruction: 'Move your mouse in circles for a few seconds.',
  },
  sensorAtRest: {
    title: 'Sensor at rest',
    question: 'Does the cursor stay still when you let go?',
    instruction: 'Place the mouse on the pad and take your hand off. Do not touch it.',
  },
  smoothness: {
    title: 'Sensor smoothness',
    question: 'Are tiny movements smooth?',
    instruction: 'Click Start, then move the mouse slowly inside the box above — small, gentle motions for about 5 seconds.',
  },
  liftTracking: {
    title: 'Lift tracking',
    question: 'Does it stop tracking when you lift?',
    instruction: 'Move on the pad, lift the mouse off the surface, then press Space on your keyboard. Put the mouse back down, move again, lift, Space — 3 times total.',
  },
  swipeConsistency: {
    title: 'Swipe consistency',
    question: 'Do identical swipes give the same result?',
    instruction: 'Put two tape marks on your pad. Swipe between them the same way each time, then lift.',
  },
  acceleration: {
    title: 'Acceleration',
    question: 'Do fast and slow swipes cover the same distance?',
    instruction: 'Use the same tape marks. Swipe slowly 3 times, then quickly 3 times.',
  },
};

function statusFromScore(score, passAt = 75, warnAt = 55) {
  if (score == null || isNaN(score)) return 'fail';
  if (score >= passAt) return 'pass';
  if (score >= warnAt) return 'warn';
  return 'fail';
}

/** Score connection / polling stability from interval samples. */
export function scoreConnection(intervals) {
  if (!intervals || intervals.length < 20) {
    return {
      id: 'connection',
      score: null,
      status: 'fail',
      summary: 'Not enough movement was recorded.',
      fix: 'Move your mouse continuously for at least 5 seconds.',
      data: { samples: intervals?.length || 0 },
    };
  }
  const poll = estimatePollingRate(intervals);
  const score = Math.round(Math.min(100, poll.stability));
  const status = statusFromScore(score, 80, 60);
  return {
    id: 'connection',
    score,
    status,
    summary: status === 'pass'
      ? `Your mouse is reporting steadily (about ${poll.label}).`
      : status === 'warn'
        ? 'Connection is a bit uneven — try a different USB port.'
        : 'Unstable connection — try another USB port or cable.',
    fix: status === 'pass' ? null : 'Plug the mouse directly into the PC (not a hub) and try again.',
    data: { hz: poll.hz, stability: poll.stability, label: poll.label, samples: intervals.length },
  };
}

/** Score idle sensor drift. */
export function scoreSensorAtRest({ totalMove, events, durationMs }) {
  if (durationMs < 15000) {
    return {
      id: 'sensorAtRest',
      score: null,
      status: 'fail',
      summary: 'The rest check did not finish.',
      fix: 'Keep your hand off the mouse until the timer ends.',
      data: { totalMove, events },
    };
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - totalMove * 5 - events)));
  const status = totalMove < 2 && events <= 3 ? 'pass' : totalMove < 10 ? 'warn' : 'fail';
  return {
    id: 'sensorAtRest',
    score,
    status,
    summary: status === 'pass'
      ? 'Your sensor stayed quiet while idle.'
      : status === 'warn'
        ? 'A little movement was detected while idle.'
        : 'The sensor moved on its own while idle.',
    fix: status === 'pass' ? null : 'Clean the sensor lens, check mouse feet, and use a flat pad.',
    data: { totalMove, events, durationMs },
  };
}

function detectStairStepping(moves) {
  if (moves.length < 5) return false;
  let axisLocks = 0;
  for (let i = 1; i < moves.length; i++) {
    const dx = Math.abs(moves[i].dx), dy = Math.abs(moves[i].dy);
    if ((dx > 0 && dy === 0) || (dy > 0 && dx === 0)) axisLocks++;
  }
  return axisLocks / moves.length > 0.7;
}

/** Score micro-movement smoothness. */
export function scoreSmoothness(microMoves, dpi = 800) {
  if (!microMoves || microMoves.length < 5) {
    return {
      id: 'smoothness',
      score: null,
      status: 'fail',
      summary: 'Not enough slow movement was recorded.',
      fix: 'Move the mouse very slowly in tiny amounts for a few seconds.',
      data: { samples: microMoves?.length || 0 },
    };
  }
  const magnitudes = microMoves.map(m => Math.hypot(m.dx, m.dy));
  const noise = mean(magnitudes);
  const jitter = stdDev(magnitudes);
  const stairSteps = detectStairStepping(microMoves);
  const score = Math.max(0, Math.min(100, Math.round(100 - noise * 20 - jitter * 30 - (stairSteps ? 25 : 0))));
  const status = stairSteps ? 'warn' : statusFromScore(score, 70, 50);
  return {
    id: 'smoothness',
    score,
    status,
    summary: stairSteps
      ? 'Tiny movements look stepped — mouse software may be smoothing.'
      : score >= 70
        ? 'Tiny movements look smooth.'
        : 'Extra noise in tiny movements.',
    fix: status === 'pass' ? null : 'Turn off smoothing / angle snapping in your mouse software.',
    data: { noise, jitter, stairSteps, samples: microMoves.length, dpi },
  };
}

/** Score lift-off residual tracking. */
export function scoreLiftTracking(lifts) {
  if (!lifts || !lifts.length) {
    return {
      id: 'liftTracking',
      score: null,
      status: 'fail',
      summary: 'No lifts were recorded.',
      fix: 'Move the mouse, lift it, then tap "I lifted it" each time.',
      data: { lifts: 0 },
    };
  }
  const avgResidual = mean(lifts.map(l => l.distance));
  const detected = avgResidual > 2;
  const score = Math.max(0, Math.min(100, Math.round(100 - avgResidual * 2)));
  const status = detected ? 'fail' : avgResidual > 1 ? 'warn' : 'pass';
  return {
    id: 'liftTracking',
    score,
    status,
    summary: detected
      ? 'The sensor kept tracking after you lifted.'
      : 'Lift-off looks clean — little tracking after lift.',
    fix: detected ? 'Lower lift-off distance in mouse software or try a different pad.' : null,
    data: { lifts: lifts.length, avgResidual, detected },
  };
}

/** Score identical swipe repeatability. */
export function scoreSwipeConsistency(runs) {
  if (!runs || runs.length < 5) {
    return {
      id: 'swipeConsistency',
      score: null,
      status: 'fail',
      summary: 'Not enough swipes were recorded.',
      fix: 'Swipe between your tape marks at least 5 times the same way.',
      data: { swipes: runs?.length || 0 },
    };
  }
  const cons = Math.round(consistencyScore(runs));
  const status = statusFromScore(cons, 85, 65);
  return {
    id: 'swipeConsistency',
    score: cons,
    status,
    summary: status === 'pass'
      ? 'Your swipes were very repeatable.'
      : status === 'warn'
        ? 'Some variation between swipes — check tape placement.'
        : 'Swipes varied a lot — pad, sensor, or technique may be inconsistent.',
    fix: status === 'pass' ? null : 'Use the same path each swipe and keep tape marks fixed.',
    data: { swipes: runs.length, consistency: cons },
  };
}

/** Score fast vs slow swipe linearity. */
export function scoreAcceleration(speedData) {
  const slow = speedData?.slow || [];
  const fast = speedData?.fast || speedData?.vfast || [];
  if (slow.length < 2 || fast.length < 2) {
    return {
      id: 'acceleration',
      score: null,
      status: 'fail',
      summary: 'Need both slow and fast swipes.',
      fix: 'Do 3 slow swipes between your tape marks, then 3 fast ones.',
      data: speedData,
    };
  }
  const slowAvg = mean(slow);
  const fastAvg = mean(fast);
  const ratio = slowAvg > 0 ? fastAvg / slowAvg : 0;
  const slowCv = slowAvg > 0 ? stdDev(slow) / slowAvg : 0;
  const fastCv = fastAvg > 0 ? stdDev(fast) / fastAvg : 0;
  const accelerationOk = ratio > 0 && ratio < 1.35 && slowCv < 0.5 && fastCv < 0.5;
  const score = accelerationOk
    ? Math.max(40, Math.round(100 - Math.abs(ratio - 1) * 40 - (slowCv + fastCv) * 20))
    : Math.round(35 + Math.max(0, 30 - Math.abs(ratio - 1) * 20));
  const status = accelerationOk ? (score >= 75 ? 'pass' : 'warn') : 'fail';
  return {
    id: 'acceleration',
    score,
    status,
    summary: accelerationOk
      ? 'Fast and slow swipes cover similar distances — no hidden acceleration.'
      : 'Fast swipes travel farther than slow ones — acceleration may be on.',
    fix: accelerationOk ? null : 'Turn off "Enhance pointer precision" in Windows and raw input in-game.',
    data: { slowAvg, fastAvg, ratio, accelerationOk },
  };
}

/** Recommended tape distance (cm) for swipe checks — ~90° travel, clamped to pad. */
export function recommendedTapeCm(padWidthCm = 45) {
  const quarterPad = padWidthCm / 4;
  return Math.min(Math.max(8, padWidthCm / 6), quarterPad, 20);
}

export const PAD_PRESETS = [
  { label: 'Small', cm: 25 },
  { label: 'Medium', cm: 35 },
  { label: 'Large', cm: 45 },
  { label: 'Desk mat', cm: 90 },
];
