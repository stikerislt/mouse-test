const routes = new Map();
let currentCleanup = null;
const contentEl = () => document.getElementById('content');

export function registerRoute(id, handler) {
  routes.set(id, handler);
}

export function navigate(id, params = {}) {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  const handler = routes.get(id);
  if (handler) {
    const cleanup = handler(contentEl(), params);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  }
}

export function getCurrentRoute() {
  return 'check';
}

export function buildNav() {
  /* Single-screen app — no nav */
}
