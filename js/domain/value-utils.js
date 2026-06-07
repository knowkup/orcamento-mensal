export function escapeHtmlValue(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function parseBrazilianMoney(value) {
  if (typeof value === 'number') return value;
  const text = String(value || '').replace(/[^\d,.-]/g, '').trim();
  if (!text) return 0;
  if (text.includes(',')) return Number(text.replaceAll('.', '').replace(',', '.')) || 0;
  return Number(text) || 0;
}

export function formatIsoDateBR(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '-';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function formatAnyDateBR(value) {
  if (!value) return '-';
  if (typeof value === 'string') return formatIsoDateBR(value);
  if (typeof value.toDate === 'function') return value.toDate().toLocaleDateString('pt-BR');
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString('pt-BR');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

export function addMonthsToIsoDate(value, months) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + Number(months || 0));
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

export function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function compareTextPtBr(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

export function initialsFromText(value) {
  return String(value || '?').trim().split(/\s+/).slice(0, 2)
    .map(part => part[0]).join('').toUpperCase() || '?';
}
