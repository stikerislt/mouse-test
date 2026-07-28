import { computeScore, getScoreLabel, verdictSummary } from '../core/scoring.js';
import { exportPDF, buildReportData } from '../core/export.js';
import { createSession } from '../core/storage.js';

const STATUS_ICON = { pass: '✓', warn: '!', fail: '✗' };

export function renderVerdict(container, checkResults, onRunAgain) {
  const score = computeScore(checkResults);
  const grade = getScoreLabel(score.overall);
  const summary = verdictSummary(score);

  container.innerHTML = `
    <div class="flow-screen verdict-screen">
      <div class="verdict-hero ${grade.class}">
        <div class="verdict-score">${score.testedCount >= 6 ? score.overall : '—'}</div>
        <h1>${grade.headline}</h1>
        <p class="flow-lead">${summary}</p>
      </div>

      <div class="card verdict-list">
        <h2>Your checks</h2>
        <ul class="result-rows">
          ${score.items.length ? score.items.map(item => `
            <li class="result-row ${item.status}">
              <span class="result-icon" aria-hidden="true">${STATUS_ICON[item.status] || '·'}</span>
              <div class="result-body">
                <strong>${item.label}</strong>
                <p>${item.summary}</p>
                ${item.fix ? `<p class="result-fix">${item.fix}</p>` : ''}
              </div>
            </li>
          `).join('') : '<li class="result-row warn"><p>No checks completed yet.</p></li>'}
        </ul>
      </div>

      <div class="verdict-actions">
        <button class="btn btn-primary btn-lg" id="save-report">Save report</button>
        <button class="btn btn-secondary btn-lg" id="run-again">Run again</button>
      </div>
      <p class="hint verdict-hint">Saved reports download as a PDF you can keep or share.</p>
    </div>
  `;

  container.querySelector('#run-again').addEventListener('click', onRunAgain);

  container.querySelector('#save-report').addEventListener('click', () => {
    const sessionName = `Mouse check ${new Date().toLocaleString()}`;
    createSession(sessionName, { tests: checkResults, score });
    exportPDF({
      title: 'Calibra Mouse Check',
      lines: buildReportData({ name: sessionName, data: { tests: checkResults } }, score),
    });
  });
}
