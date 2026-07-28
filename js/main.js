import { initShell } from './ui/shell.js';
import { registerRoute, navigate } from './ui/router.js';
import { renderCheck } from './ui/check.js';

document.addEventListener('DOMContentLoaded', () => {
  initShell();
  registerRoute('check', (el) => renderCheck(el));
  navigate('check');
});
