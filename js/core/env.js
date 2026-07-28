let refreshRate = 60;
let frameTimes = [];
let zoomWarning = false;
let fpsWarning = false;
let rafId = null;

export function detectZoom() {
  const ratio = window.devicePixelRatio || 1;
  // Prefer visualViewport.scale when available (more accurate than outer/inner width)
  let zoom = 100;
  if (window.visualViewport && window.visualViewport.scale) {
    zoom = Math.round(window.visualViewport.scale * 100);
  } else if (window.outerWidth && window.innerWidth) {
    const rough = Math.round((window.outerWidth / window.innerWidth) * 100);
    // Ignore absurd values from maximized/snapped windows
    if (rough >= 75 && rough <= 250) zoom = rough;
  }
  zoomWarning = zoom !== 100;
  return { ratio, zoom, warning: zoomWarning };
}

export function estimateRefreshRate() {
  return new Promise((resolve) => {
    const times = [];
    let last = performance.now();
    let count = 0;
    function frame(t) {
      times.push(t - last);
      last = t;
      count++;
      if (count < 60) requestAnimationFrame(frame);
      else {
        const avg = times.slice(10).reduce((a, b) => a + b, 0) / (times.length - 10);
        refreshRate = Math.round(1000 / avg);
        resolve(refreshRate);
      }
    }
    requestAnimationFrame(frame);
  });
}

export function startFpsMonitor(onDrop) {
  frameTimes = [];
  let last = performance.now();
  function tick(t) {
    const dt = t - last;
    last = t;
    frameTimes.push(dt);
    if (frameTimes.length > 120) frameTimes.shift();
    if (frameTimes.length >= 30) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = 1000 / avg;
      if (fps < refreshRate * 0.7 && fps < 45) {
        fpsWarning = true;
        onDrop?.(fps);
      }
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

export function stopFpsMonitor() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  fpsWarning = false;
}

export function getEnvState() {
  return { refreshRate, zoomWarning, fpsWarning, ...detectZoom() };
}

export function renderWarnings(container) {
  const warnings = [];
  const zoom = detectZoom();
  if (zoom.warning) warnings.push(`Browser zoom is ~${zoom.zoom}% — set to 100% for accurate results.`);
  if (fpsWarning) warnings.push('Frame rate dropped significantly during test — results may be affected.');
  container.innerHTML = warnings.map(w => `<div class="warning-banner">${w}</div>`).join('');
}

export async function initEnv() {
  await estimateRefreshRate();
}
