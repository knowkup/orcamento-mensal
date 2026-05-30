import { state, rebuildIndexes } from './state.js';
import { state as mainState } from '../state.js';
import { getDocs, debtsColl, installmentsColl, paymentsColl, debtCreditorsColl } from './firebase.js';
import { synchronizePaidOffDebts } from './calc.js';
import { renderDashboard, renderRenegotiatedHistory } from './dashboard.js';
import { renderTrail } from './trail.js';
import { renderDebts } from './debts.js';
import { renderRenegotiation } from './renegotiation.js';
import { renderCreditors } from './creditors.js';
import './payment.js';
import './debt-form.js';
import './data.js';

export async function loadDividas() {
  state.creditors = (await getDocs(debtCreditorsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  state.debts = (await getDocs(debtsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  state.installments = (await getDocs(installmentsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  state.payments = (await getDocs(paymentsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  rebuildIndexes();
  await synchronizePaidOffDebts();
  renderDividas();
  if (mainState.renderFn) mainState.renderFn();
}

export function renderDividas() {
  rebuildIndexes();
  renderCreditors();
  renderDebts();
  renderRenegotiation();
  renderTrail();
  renderRenegotiatedHistory();
}

state.renderFn = renderDividas;
state.loadAllFn = loadDividas;

export function getDebtInstallmentsForMonth(month) {
  return state.debts
    .filter(d => d.includeInBudget && d.status !== 'Quitada')
    .flatMap(debt => {
      const installment = state.installments
        .filter(i => i.debtId === debt.id && i.status === 'Pendente' && String(i.dueDate || '').startsWith(month))
        .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))[0];
      if (!installment) return [];
      const creditorName = state.creditors.find(c => c.id === debt.creditorId)?.name || '';
      const row = {
        id: `auto-debt-${debt.id}`,
        kind: 'expense',
        owner: 'Felipe',
        creditorId: '',
        fromDebtId: debt.id,
        label: debt.name,
        origin: creditorName,
        logoUrl: '',
        values: { [month]: Number(installment.expectedValue || 0) },
        dueDates: { [month]: installment.dueDate }
      };
      return [{ row, value: Number(installment.expectedValue || 0) }];
    });
}

// Navigation helper — maps debt view names to Orçamento's unified showView
window.showDividasView = function(viewName) {
  if (window.showView) {
    window.showView(viewName);
  } else {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === viewName));
    document.querySelectorAll('.view').forEach(view => {
      const active = view.id === viewName + 'View';
      view.classList.toggle('active', active);
      if (active && view.dataset.title) {
        const title = document.querySelector('#viewTitle');
        if (title) title.textContent = view.dataset.title;
      }
    });
  }
};
