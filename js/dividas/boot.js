import { state, rebuildIndexes } from './state.js';
import { state as appState } from '../state.js';
import { getDocs, debtsColl, installmentsColl, paymentsColl, debtCreditorsColl, debtDoc, writeBatch } from './firebase.js';
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
  state.debts = (await getDocs(debtsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  state.installments = (await getDocs(installmentsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  state.payments = (await getDocs(paymentsColl())).docs.map(d => ({ id: d.id, ...d.data() }));
  rebuildIndexes();
  await migrateDebtCreditors();
  await synchronizePaidOffDebts();
  renderDividas();
}

async function migrateDebtCreditors() {
  const oldDocs = await getDocs(debtCreditorsColl());
  if (oldDocs.empty) return; // já migrado

  const oldCreditors = oldDocs.docs.map(d => ({ id: d.id, ...d.data() }));
  const orcCreditors = appState.data?.creditors || [];
  const idMap = {};

  for (const old of oldCreditors) {
    const match = orcCreditors.find(c =>
      c.name.trim().toLowerCase() === old.name.trim().toLowerCase()
    );
    if (match) {
      idMap[old.id] = match.id;
    } else {
      const newId = crypto.randomUUID();
      orcCreditors.push({
        id: newId,
        name: old.name,
        paymentForms: old.type ? [old.type] : ['Cartão de crédito'],
        logoUrl: old.logoUrl || ''
      });
      idMap[old.id] = newId;
    }
  }

  // Salva credores atualizados no Orçamento
  if (appState.saveStateFn) await appState.saveStateFn();

  // Atualiza creditorId nas dívidas
  const needsUpdate = state.debts.filter(d => d.creditorId && idMap[d.creditorId]);
  if (needsUpdate.length) {
    const batch = writeBatch();
    needsUpdate.forEach(d => {
      batch.update(debtDoc(d.id), { creditorId: idMap[d.creditorId] });
      d.creditorId = idMap[d.creditorId];
    });
    await batch.commit();
  }

  // Remove subcoleção debtCreditors
  const delBatch = writeBatch();
  oldDocs.docs.forEach(doc => delBatch.delete(doc.ref));
  await delBatch.commit();
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
