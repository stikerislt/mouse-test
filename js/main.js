import { initShell } from './ui/shell.js';
import { registerRoute, navigate } from './ui/router.js';
import { renderCheck } from './ui/check.js';

function boot() {
  initShell();
  registerRoute('check', (el) => renderCheck(el));
  navigate('check');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
