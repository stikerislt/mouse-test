export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Safe min — avoids spread-call stack overflow on very large arrays. */
export function min(arr) {
  if (!arr.length) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}

/** Safe max — avoids spread-call stack overflow on very large arrays. */
export function max(arr) {
  if (!arr.length) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function consistencyScore(values) {
  if (values.length < 2) return 100;
  const m = mean(values);
  if (m === 0) return 0;
  const cv = (stdDev(values) / Math.abs(m)) * 100;
  return Math.max(0, Math.min(100, 100 - cv));
}

export function detectOutliers(values, threshold = 2) {
  const m = mean(values);
  const sd = stdDev(values);
  if (sd === 0) return values.map(() => false);
  return values.map(v => Math.abs(v - m) > threshold * sd);
}

export function histogram(values, bins = 20) {
  if (!values.length) return { bins: [], counts: [], min: 0, max: 0 };
  const lo = min(values);
  const hi = max(values);
  const range = hi - lo || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(((v - lo) / range) * bins));
    counts[idx]++;
  }
  const binEdges = Array.from({ length: bins }, (_, i) => lo + (range * i) / bins);
  return { bins: binEdges, counts, min: lo, max: hi };
}

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function lineDeviation(points, x1, y1, x2, y2) {
  const lineLen = Math.hypot(x2 - x1, y2 - y1) || 1;
  const deviations = points.map(p => {
    const num = Math.abs((y2 - y1) * p.x - (x2 - x1) * p.y + x2 * y1 - y2 * x1);
    return num / lineLen;
  });
  return {
    max: Math.max(...deviations, 0),
    avg: mean(deviations),
    deviations,
  };
}

export function estimatePollingRate(intervals) {
  if (!intervals.length) return { hz: 0, stability: 0, label: 'Unknown' };
  const valid = intervals.filter(dt => dt > 0 && dt < 50);
  if (!valid.length) return { hz: 0, stability: 0, label: 'Unknown' };
  const avgDt = mean(valid);
  const hz = 1000 / avgDt;
  const sd = stdDev(valid);
  const stability = Math.max(0, 100 - (sd / avgDt) * 100);
  const rates = [125, 250, 500, 1000, 2000, 4000, 8000];
  let closest = rates[0];
  let minDiff = Infinity;
  for (const r of rates) {
    const diff = Math.abs(hz - r);
    if (diff < minDiff) { minDiff = diff; closest = r; }
  }
  return { hz, stability, label: `${Math.round(closest)} Hz`, raw: hz };
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatNum(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toFixed(dec);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function distance2D(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleFromDelta(dx, dy) {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function circularMean(angles) {
  if (!angles.length) return 0;
  let sinSum = 0, cosSum = 0;
  for (const a of angles) {
    const rad = (a * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  return (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
}

export function smoothnessScore(points) {
  if (points.length < 3) return 100;
  let jerkSum = 0;
  for (let i = 2; i < points.length; i++) {
    const a1 = Math.atan2(points[i - 1].y - points[i - 2].y, points[i - 1].x - points[i - 2].x);
    const a2 = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    jerkSum += Math.abs(diff);
  }
  const avgJerk = jerkSum / (points.length - 2);
  return Math.max(0, Math.min(100, 100 - avgJerk * 50));
}
