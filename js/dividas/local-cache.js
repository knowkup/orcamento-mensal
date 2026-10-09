import { state, rebuildIndexes } from './state.js';
import { normalizeData } from '../data.js';
import { state as mainState } from '../state.js';

const STARTUP_CACHE_KEY = 'orcamento-mensal-startup-cache-v2';

function isCollection(value) {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object');
}

/**
 * Restaura um retrato único do orçamento e das dívidas. As duas partes precisam
 * vir juntas: usar apenas as dívidas com um orçamento vazio distorce a projeção.
 */
export function restoreStartupCache(fallbackData) {
  try {
    const cached = JSON.parse(localStorage.getItem(STARTUP_CACHE_KEY) || 'null');
    if (!cached?.data || !isCollection(cached.debts) || !isCollection(cached.installments) || !isCollection(cached.payments)) {
      return { data: fallbackData, restored: false };
    }

    const data = normalizeData(cached.data);
    state.debts = cached.debts;
    state.installments = cached.installments;
    state.payments = cached.payments;
    state.creditors = Array.isArray(data.creditors) ? data.creditors : [];
    rebuildIndexes();
    return { data, restored: true };
  } catch (error) {
    console.warn('Não foi possível restaurar o cache inicial.', error);
    return { data: fallbackData, restored: false };
  }
}

export function persistStartupCache() {
  try {
    localStorage.setItem(STARTUP_CACHE_KEY, JSON.stringify({
      data: mainState.data,
      debts: state.debts,
      installments: state.installments,
      payments: state.payments,
      savedAt: Date.now()
    }));
  } catch (error) {
    // Falhar aqui não pode impedir o uso normal do sistema.
    console.warn('Não foi possível atualizar o cache inicial.', error);
  }
}
