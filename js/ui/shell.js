import { initEnv, detectZoom, getEnvState } from '../core/env.js';
import { stopCapture } from '../core/input.js';

let restartCallback = null;
let stopCallback = null;

export function setRestartCallback(fn) {
  restartCallback = fn;
}

export function setStopCallback(fn) {
  stopCallback = fn;
}

export function initShell() {
  stopCapture();

  initEnv().then(() => {
    const envEl = document.getElementById('env-warnings');
    const s = getEnvState();
    const zoom = detectZoom();
    let html = '';
    if (zoom.warning) {
      html += `<div class="warning-banner">Browser zoom is about ${zoom.zoom}% — set to 100% for accurate results.</div>`;
    }
    if (s.refreshRate) {
      html += `<div class="warning-banner info">Display refresh: about ${s.refreshRate} Hz</div>`;
    }
    envEl.innerHTML = html;
  });

  document.getElementById('btn-start-over')?.addEventListener('click', () => {
    restartCallback?.();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape' && stopCallback) {
      e.preventDefault();
      stopCallback();
    }
  });
}
