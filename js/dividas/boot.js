import { state, rebuildIndexes } from './state.js';
import { navigateTo } from '../navigation.js';
import { state as mainState } from '../state.js';
import { getDocs, debtsColl, debtDoc, installmentsColl, paymentsColl, debtCreditorsColl, writeBatch, serverTimestamp } from './firebase.js';
import { mergeCreditorCatalog } from '../domain/creditor-catalog.js';
import { normalizeDebtBudgetFlags } from '../domain/debt-budget.js';
import { synchronizePaidOffDebts } from './calc.js';
import { renderDashboard, renderRenegotiatedHistory } from './dashboard.js';
import { renderTrail } from './trail.js';
import { renderDebts } from './debts.js';
import { renderRenegotiation } from './renegotiation.js';
import { bindDebtDataEvents } from './ui-events.js';
import './payment.js';
import './debt-form.js';
import './data.js';

export async function loadDividas() {
  bindDebtDataEvents();
  const [legacyCreditorSnapshot, debtSnapshot, installmentSnapshot, paymentSnapshot] = await Promise.all([
    getDocs(debtCreditorsColl()),
    getDocs(debtsColl()),
    getDocs(installmentsColl()),
    getDocs(paymentsColl())
  ]);
  const legacyCreditors = legacyCreditorSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  state.debts = debtSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  state.installments = installmentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  state.payments = paymentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  await migrateLegacyCreditors(legacyCreditors, legacyCreditorSnapshot.docs);
  await normalizeConsignadoBudgetFlags();
  state.creditors = mainState.data?.creditors || [];
  rebuildIndexes();
  await synchronizePaidOffDebts();
  renderDividas();
  if (mainState.renderFn) mainState.renderFn();
}

export function renderDividas() {
  state.creditors = mainState.data?.creditors || [];
  rebuildIndexes();
  renderDebts();
  renderRenegotiation();
  renderTrail();
  renderRenegotiatedHistory();
}

state.renderFn = renderDividas;
state.loadAllFn = loadDividas;
mainState.renderDividasFn = renderDividas;

async function migrateLegacyCreditors(legacyCreditors, legacyDocs) {
  if (!legacyCreditors.length) return;
  const migration = mergeCreditorCatalog(
    mainState.data?.creditors || [],
    legacyCreditors,
    () => crypto.randomUUID()
  );

  if (migration.changed) {
    mainState.data.creditors = migration.creditors;
    if (mainState.saveStateFn) await mainState.saveStateFn();
  }

  const batch = writeBatch();
  let operations = 0;
  state.debts.forEach(debt => {
    const creditorId = migration.idMap.get(debt.creditorId);
    if (!creditorId || creditorId === debt.creditorId) return;
    debt.creditorId = creditorId;
    batch.update(debtDoc(debt.id), { creditorId, updatedAt: serverTimestamp() });
    operations += 1;
  });
  legacyDocs.forEach(document => {
    batch.delete(document.ref);
    operations += 1;
  });
  if (operations) await batch.commit();
}

async function normalizeConsignadoBudgetFlags() {
  const inconsistent = state.debts.filter(debt => {
    const flags = normalizeDebtBudgetFlags(debt);
    return flags.includeInBudget !== !!debt.includeInBudget;
  });
  if (!inconsistent.length) return;
  const batch = writeBatch();
  inconsistent.forEach(debt => {
    debt.includeInBudget = false;
    batch.update(debtDoc(debt.id), { includeInBudget: false, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export { navigateTo };
