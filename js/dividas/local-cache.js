import { state, rebuildIndexes } from './state.js';

const DEBT_CACHE_KEY = 'orcamento-mensal-dividas-cache-v1';

function isCollection(value) {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object');
}

/**
 * Mantém uma cópia de leitura das dívidas neste dispositivo. Ela existe para a
 * projeção abrir com os compromissos já conhecidos, enquanto o Firebase é
 * consultado em segundo plano.
 */
export function restoreDebtCache(creditors = []) {
  try {
    const cached = JSON.parse(localStorage.getItem(DEBT_CACHE_KEY) || 'null');
    if (!cached || !isCollection(cached.debts) || !isCollection(cached.installments) || !isCollection(cached.payments)) {
      return false;
    }

    state.debts = cached.debts;
    state.installments = cached.installments;
    state.payments = cached.payments;
    state.creditors = Array.isArray(creditors) ? creditors : [];
    rebuildIndexes();
    return true;
  } catch (error) {
    console.warn('Não foi possível restaurar o cache local das dívidas.', error);
    return false;
  }
}

export function persistDebtCache() {
  try {
    localStorage.setItem(DEBT_CACHE_KEY, JSON.stringify({
      debts: state.debts,
      installments: state.installments,
      payments: state.payments,
      savedAt: Date.now()
    }));
  } catch (error) {
    // Falhar aqui não pode impedir o uso normal do sistema.
    console.warn('Não foi possível atualizar o cache local das dívidas.', error);
  }
}
