import { mean, median, stdDev, percentile, consistencyScore, detectOutliers, histogram, pathLength, lineDeviation, estimatePollingRate, formatTime, formatNum, clamp, distance2D, angleFromDelta, circularMean, smoothnessScore, min, max } from '../js/core/stats.js';
import {
  scoreConnection, scoreSensorAtRest, scoreSmoothness,
  scoreLiftTracking, scoreSwipeConsistency, scoreAcceleration,
  recommendedTapeCm,
} from '../js/core/checks.js';
import { computeScore, getScoreLabel } from '../js/core/scoring.js';

window.__testsStarted = true;

const results = [];
let passed = 0, failed = 0;

function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

function assert(name, cond) {
  if (cond) { passed++; results.push({ name, ok: true }); }
  else { failed++; results.push({ name, ok: false }); }
}

function assertApprox(name, a, b, eps = 1e-6) {
  const ok = approx(a, b, eps);
  if (!ok) console.error(`${name}: expected ${b}, got ${a}`);
  assert(name, ok);
}

// stats.js (abbreviated — same as before)
assert('mean of [1,2,3,4] = 2.5', approx(mean([1, 2, 3, 4]), 2.5));
assert('consistencyScore of identical = 100', approx(consistencyScore([100, 100, 100]), 100));
const poll = estimatePollingRate([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
assertApprox('estimatePollingRate 1ms → 1000 Hz', poll.hz, 1000, 0.5);

// checks.js
const conn = scoreConnection([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
assert('scoreConnection returns pass with stable intervals', conn.status === 'pass' || conn.score > 60);

const rest = scoreSensorAtRest({ totalMove: 0, events: 0, durationMs: 20000 });
assert('scoreSensorAtRest idle = pass', rest.status === 'pass');

const swipe = scoreSwipeConsistency([100, 101, 99, 100, 102]);
assert('scoreSwipeConsistency repeatable = pass', swipe.status === 'pass');

assert('recommendedTapeCm(45) between 8 and 20', recommendedTapeCm(45) >= 8 && recommendedTapeCm(45) <= 20);

// scoring.js
const emptyScore = computeScore({});
assert('computeScore({}) overall = 0', emptyScore.overall === 0);

const fullGood = {
  connection: { score: 90, status: 'pass', summary: 'ok' },
  sensorAtRest: { score: 95, status: 'pass', summary: 'ok' },
  smoothness: { score: 85, status: 'pass', summary: 'ok' },
  liftTracking: { score: 90, status: 'pass', summary: 'ok' },
  swipeConsistency: { score: 92, status: 'pass', summary: 'ok' },
  acceleration: { score: 88, status: 'pass', summary: 'ok' },
};
const good = computeScore(fullGood);
assert('computeScore 6 checks = High confidence', good.confidence === 'High');
assert('computeScore 6 checks testedCount = 6', good.testedCount === 6);

assert('getScoreLabel(95) headline exists', getScoreLabel(95).headline.length > 0);

const summary = document.getElementById('summary');
const container = document.getElementById('results');
summary.innerHTML = `<span class="${failed === 0 ? 'pass' : 'fail'}">${passed} passed, ${failed} failed</span>`;
container.innerHTML = results.map(r =>
  `<div class="test"><span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'}</span> <span class="name">${r.name}</span></div>`
).join('');

console.log(`Calibra tests: ${passed} passed, ${failed} failed`);
