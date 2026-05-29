import { $, escapeHtml, sortedCreditors } from './utils.js';

export function renderCreditors() {
  const select = $('debtCreditorSelect');
  if (!select) return;
  const creditors = sortedCreditors();
  select.innerHTML = creditors.length
    ? creditors.map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('')
    : '<option value="">Cadastre um credor em Preferências</option>';
}

export function renderCreditorMetrics() {}
