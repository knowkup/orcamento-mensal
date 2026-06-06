import { state } from './state.js';
import { state as appState } from '../state.js';
import { showToast as showAppToast } from '../utils.js';
import {
  addMonthsToIsoDate,
  compareTextPtBr,
  escapeHtmlValue,
  formatAnyDateBR as formatSharedDateBR,
  formatIsoDateBR,
  initialsFromText,
  normalizeSearchText,
  parseBrazilianMoney
} from '../domain/value-utils.js';

export const $ = (id) => document.getElementById(id);

export function brl(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export function parseMoney(value) {
  return parseBrazilianMoney(value);
}

export function formatDateBR(dateString) { return formatIsoDateBR(dateString); }

export function formatAnyDateBR(value) {
  return formatSharedDateBR(value);
}

export function addMonths(dateString, months) {
  return addMonthsToIsoDate(dateString, months);
}

export function currentMonthKey() { return new Date().toISOString().slice(0, 7); }

export function byDueDate(a, b) { return String(a.dueDate || '').localeCompare(String(b.dueDate || '')); }

export function showToast(message, tone = null) {
  const text = String(message);
  const inferredTone = tone
    || (/sucesso|salvo|salva|atualizad|cadastrad|registrad|removid|excluid|importado|quitada/i.test(text) ? 'success' : null)
    || (/nao|não|informe|preencha|selecione|nenhum|nenhuma|falha|erro|impossivel|indisponivel/i.test(text) ? 'error' : 'info');
  showAppToast(message, inferredTone);
}

export function escapeHtml(value) {
  return escapeHtmlValue(value);
}

export function emptyCard(title, text) {
  return '<div class="empty-state debt-empty-state"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(text) + '</span></div>';
}

export function tag(label, tone) {
  return '<span class="tag ' + tone + '">' + escapeHtml(label) + '</span>';
}

export function normalizeText(value) {
  return normalizeSearchText(value);
}

export function compareText(a, b) {
  return compareTextPtBr(a, b);
}

export function getCreditorName(id) {
  const creditor = state.creditors.find(c => c.id === id)
    || (appState.data?.creditors || []).find(c => c.id === id);
  return creditor ? creditor.name : 'Credor não informado';
}

export function sortedCreditors() {
  return [...state.creditors].sort((a, b) => compareText(a.name, b.name));
}

export function sortedAllCreditors() {
  const dividas = state.creditors;
  const app = (appState.data?.creditors || []).filter(c => !dividas.some(d => d.id === c.id));
  return [...dividas, ...app].sort((a, b) => compareText(a.name, b.name));
}

export function creditorDomain(name) {
  const value = normalizeText(name);
  const domains = [
    ['mercado pago', 'mercadopago.com.br'],
    ['mercadopago', 'mercadopago.com.br'],
    ['nubank', 'nubank.com.br'],
    ['nu bank', 'nubank.com.br'],
    ['itau', 'itau.com.br'],
    ['santander', 'santander.com.br'],
    ['banco inter', 'bancointer.com.br'],
    ['inter', 'bancointer.com.br'],
    ['bradesco', 'bradesco.com.br'],
    ['caixa', 'caixa.gov.br'],
    ['cef', 'caixa.gov.br'],
    ['banco do brasil', 'bb.com.br'],
    ['bb', 'bb.com.br'],
    ['sicredi', 'sicredi.com.br'],
    ['sicoob', 'sicoob.com.br'],
    ['banrisul', 'banrisul.com.br'],
    ['btg', 'btgpactual.com'],
    ['btg pactual', 'btgpactual.com'],
    ['xp', 'xpinc.com'],
    ['pagbank', 'pagbank.com.br'],
    ['pagseguro', 'pagseguro.uol.com.br'],
    ['stone', 'stone.com.br'],
    ['ton', 'ton.com.br'],
    ['cora', 'cora.com.br'],
    ['picpay', 'picpay.com'],
    ['c6', 'c6bank.com.br'],
    ['c6 bank', 'c6bank.com.br'],
    ['neon', 'neon.com.br'],
    ['pan', 'bancopan.com.br'],
    ['banco pan', 'bancopan.com.br'],
    ['porto seguro', 'portoseguro.com.br'],
    ['renner', 'lojasrenner.com.br'],
    ['riachuelo', 'riachuelo.com.br'],
    ['magalu', 'magazineluiza.com.br'],
    ['magazine luiza', 'magazineluiza.com.br'],
    ['casas bahia', 'casasbahia.com.br'],
    ['americanas', 'americanas.com.br'],
    ['amazon', 'amazon.com.br'],
    ['shopee', 'shopee.com.br']
  ];
  const found = domains.find(item => value.includes(item[0]));
  return found ? found[1] : '';
}

export function initials(value) {
  return initialsFromText(value);
}

export function creditorLogoHtml(creditorId) {
  const creditor = state.creditors.find(c => c.id === creditorId)
    || (appState.data?.creditors || []).find(c => c.id === creditorId);
  const name = getCreditorName(creditorId);
  const customLogo = String(creditor?.logoUrl || '').trim();
  if (customLogo) {
    return '<div class="creditor-logo"><img alt="' + escapeHtml(name) + '" src="' + escapeHtml(customLogo) + '" onerror="this.replaceWith(document.createTextNode(\'' + escapeHtml(initials(name)) + '\'))"></div>';
  }
  const domain = creditorDomain(name);
  if (!domain) return '<div class="creditor-logo">' + escapeHtml(initials(name)) + '</div>';
  const src = 'https://www.google.com/s2/favicons?domain_url=https://' + encodeURIComponent(domain) + '&sz=64';
  return '<div class="creditor-logo"><img alt="' + escapeHtml(name) + '" src="' + src + '" onerror="this.replaceWith(document.createTextNode(\'' + escapeHtml(initials(name)) + '\'))"></div>';
}

export function priorityTagForDebt(debt) {
  let critical = tag('Normal', 'gray');
  if (debt.criticality === 'Máxima') critical = tag('Prioridade Máxima', 'amber');
  if (debt.criticality === 'Alta') critical = tag('Prioridade Alta', 'blue');
  return critical;
}

export function compactTagsForDebt(debt, isNextTarget = false) {
  return priorityTagForDebt(debt) + (isNextTarget ? tag('Próximo Alvo', 'red') : '');
}

export function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateString + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

export function dueHint(dateString) {
  const days = daysUntil(dateString);
  if (days === null) return '';
  if (days < 0) return 'Vencida há ' + Math.abs(days) + ' dias';
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Daqui a 1 dia';
  return 'Daqui a ' + days + ' dias';
}

export function paymentForInstallment(installmentId) {
  return state.paymentByInstallment.get(installmentId) || null;
}

export function fact(label, value) {
  return '<span><strong style="color:var(--soft)">' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + '</span>';
}

export function routeProgressHtml(progress) {
  return '<div class="route-progress">' +
    '<div class="route-progress-top"><span>Progresso</span><strong>' + progress + '%</strong></div>' +
    '<div class="route-progress-track"><div class="route-progress-fill" style="width:' + progress + '%;"></div></div>' +
  '</div>';
}
