import { CHECK_META } from './checks.js';

const WEIGHTS = {
  connection: 0.15,
  sensorAtRest: 0.15,
  smoothness: 0.15,
  liftTracking: 0.15,
  swipeConsistency: 0.20,
  acceleration: 0.20,
};

const PLAIN_LABELS = {
  connection: 'Connection',
  sensorAtRest: 'Sensor at rest',
  smoothness: 'Smoothness',
  liftTracking: 'Lift tracking',
  swipeConsistency: 'Swipe consistency',
  acceleration: 'Acceleration',
};

/**
 * @param {Record<string, { score?: number, status?: string, summary?: string, fix?: string }>} checkResults
 */
export function computeScore(checkResults) {
  const scores = {};
  const items = [];
  const recommendations = [];

  for (const [id, result] of Object.entries(checkResults || {})) {
    if (!result || result.score == null) continue;
    scores[id] = result.score;
    items.push({
      id,
      label: PLAIN_LABELS[id] || CHECK_META[id]?.title || id,
      score: result.score,
      status: result.status || 'warn',
      summary: result.summary || '',
      fix: result.fix || null,
    });
    if (result.fix) recommendations.push(result.fix);
  }

  let totalWeight = 0;
  let weighted = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    if (scores[key] != null) {
      weighted += scores[key] * weight;
      totalWeight += weight;
    }
  }

  const overall = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
  const testedCount = Object.keys(scores).length;

  let confidence = 'Low';
  if (overall >= 85) confidence = 'High';
  else if (overall >= 65) confidence = 'Moderate';

  if (testedCount < 6) {
    confidence = 'Incomplete';
    recommendations.unshift('Finish all 6 checks for a full picture of your mouse.');
  }

  return { overall, scores, items, confidence, recommendations, testedCount };
}

export function getScoreLabel(score) {
  if (score == null || isNaN(score)) return { label: 'Incomplete', class: 'warn', headline: 'Not finished yet' };
  if (score >= 90) return { label: 'Excellent', class: 'good', headline: 'Your mouse looks consistent' };
  if (score >= 75) return { label: 'Good', class: 'good', headline: 'Mostly consistent — minor issues only' };
  if (score >= 60) return { label: 'Fair', class: 'warn', headline: 'Some issues detected' };
  if (score >= 40) return { label: 'Needs attention', class: 'warn', headline: 'Several issues detected' };
  return { label: 'Poor', class: 'danger', headline: 'Your mouse may need attention' };
}

export function verdictSummary(score) {
  const g = getScoreLabel(score.overall);
  if (score.testedCount < 6) return 'Finish all checks to get your full result.';
  const fails = score.items.filter(i => i.status === 'fail');
  const warns = score.items.filter(i => i.status === 'warn');
  if (!fails.length && !warns.length) return 'Everything looked good. Your mouse and pad seem trustworthy for gaming.';
  if (fails.length) return `${fails.length} check${fails.length > 1 ? 's' : ''} failed — see fixes below.`;
  return `${warns.length} check${warns.length > 1 ? 's' : ''} could be better — see tips below.`;
}
