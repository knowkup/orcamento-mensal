import { state } from './state.js';
import { $, brl, parseMoney, escapeHtml, showToast, sortedAllCreditors, addMonths } from './utils.js';
import { nextInstallment } from './calc.js';
import { nextPayoffOrder, nextActiveRouteOrder } from './debts.js';
import { debtsColl, debtDoc, installmentsColl, installmentDoc, doc, addDoc, getDocs, updateDoc, writeBatch, query, where, serverTimestamp } from './firebase.js';

// --- Modal de dívida ---

window.openDebtForm = function(mode = 'new', id = null, defaultStatus = 'Ativa') {
  window.closePaymentForm();
  window.closePayoffModal();
  state.editingDebtId = mode === 'edit' ? id : null;
  $('debtFormTitle').textContent = state.editingDebtId ? 'Editar dívida' : 'Nova dívida';
  if (state.editingDebtId) {
    const debt = state.debts.find(d => d.id === state.editingDebtId);
    if (!debt) return;
    $('debtCreditorSelect').value = debt.creditorId || '';
    $('debtName').value = debt.name || '';
    $('debtType').value = debt.type || 'Cartão';
    $('debtPaymentMethod').value = debt.paymentMethod || 'Boleto';
    $('debtFirstDue').value = debt.firstDue || '';
    $('debtInstallmentsQty').value = debt.installmentsQty || '';
    $('debtInstallmentValue').value = brl(debt.installmentValue || 0);
    $('debtStatus').value = debt.status || 'Ativa';
    $('debtCriticality').value = debt.criticality || 'Normal';
    $('debtBehavior').value = debt.behavior || 'Parcelada';
    $('debtPayoffToday').value = brl(debt.payoffToday || 0);
    $('debtPayoffOrder').value = debt.payoffOrder || '';
    $('debtNotes').value = debt.notes || '';
    $('debtIncludeInBudget').checked = !!debt.includeInBudget;
  } else {
    $('debtCreditorSelect').value = sortedAllCreditors()[0]?.id || '';
    $('debtName').value = '';
    $('debtType').value = 'Cartão';
    $('debtPaymentMethod').value = 'Boleto';
    $('debtFirstDue').value = '';
    $('debtInstallmentsQty').value = '';
    $('debtInstallmentValue').value = '';
    $('debtStatus').value = defaultStatus;
    $('debtCriticality').value = 'Normal';
    $('debtBehavior').value = 'Parcelada';
    $('debtPayoffToday').value = '';
    $('debtPayoffOrder').value = nextPayoffOrder();
    $('debtNotes').value = '';
    $('debtIncludeInBudget').checked = false;
  }
  document.getElementById('divDebtDialog').showModal();
};

window.closeDebtForm = function() {
  state.editingDebtId = null;
  document.getElementById('divDebtDialog').close();
};

window.saveDebt = async function() {
  if (!sortedAllCreditors().length) return showToast('Cadastre um credor antes da dívida.');
  const creditorId = $('debtCreditorSelect').value;
  const name = $('debtName').value.trim();
  const firstDue = $('debtFirstDue').value;
  const installmentsQty = Number($('debtInstallmentsQty').value || 0);
  const installmentValue = parseMoney($('debtInstallmentValue').value);
  if (!creditorId || !name || !firstDue || !installmentsQty || !installmentValue) return showToast('Preencha credor, nome, primeira parcela, quantidade e valor.');
  const payload = {
    creditorId, name, firstDue, installmentsQty, installmentValue,
    type: $('debtType').value,
    paymentMethod: $('debtPaymentMethod').value,
    status: $('debtStatus').value,
    criticality: $('debtCriticality').value,
    behavior: $('debtBehavior').value,
    payoffToday: parseMoney($('debtPayoffToday').value),
    payoffOrder: Number($('debtPayoffOrder').value || 0),
    notes: $('debtNotes').value.trim(),
    includeInBudget: $('debtIncludeInBudget').checked,
    updatedAt: serverTimestamp()
  };

  if (state.editingDebtId) {
    await updateDoc(debtDoc(state.editingDebtId), payload);
    await reconcileInstallmentsForDebt(state.editingDebtId, installmentsQty, installmentValue, firstDue);
    window.closeDebtForm();
    showToast('Dívida atualizada com sucesso.');
  } else {
    const created = await addDoc(debtsColl(), { ...payload, createdAt: serverTimestamp() });
    await generateInstallments(created.id, installmentsQty, installmentValue, firstDue);
    window.closeDebtForm();
    await state.loadAllFn();
    showToast('Dívida cadastrada com sucesso.');
  }
};

window.changeDebtStatus = async function(id, status) {
  const debt = state.debts.find(d => d.id === id);
  const payload = { status, updatedAt: serverTimestamp() };
  if (status === 'Ativa') payload.payoffOrder = nextActiveRouteOrder(id);
  await updateDoc(debtDoc(id), payload);
  if (debt) {
    debt.status = status;
    if (payload.payoffOrder) debt.payoffOrder = payload.payoffOrder;
  }
  if (state.renderFn) state.renderFn();
  const messages = {
    Ativa: 'Dívida movida para Rota Financeira.',
    'Em espera': 'Dívida movida para espera.',
    'Fora do radar': 'Dívida movida para fora do radar.',
    Quitada: 'Dívida movida para quitadas.'
  };
  showToast(messages[status] || 'Situação atualizada com sucesso.');
};

window.rollDebt = function(id) {
  const debt = state.debts.find(item => item.id === id);
  if (!debt) return showToast('Dívida não encontrada.');
  const baseDue = debt.firstDue || nextInstallment(debt)?.dueDate || new Date().toISOString().slice(0, 10);
  window.openDebtForm('new', null, debt.status || 'Ativa');
  $('debtCreditorSelect').value = debt.creditorId || '';
  $('debtName').value = debt.name || '';
  $('debtType').value = debt.type || 'Cartão';
  $('debtPaymentMethod').value = debt.paymentMethod || 'Boleto';
  $('debtFirstDue').value = addMonths(baseDue, 1);
  $('debtInstallmentsQty').value = debt.installmentsQty || '';
  $('debtInstallmentValue').value = brl(debt.installmentValue || 0);
  $('debtStatus').value = debt.status || 'Ativa';
  $('debtCriticality').value = debt.criticality || 'Normal';
  $('debtBehavior').value = 'Rolagem';
  $('debtPayoffToday').value = brl(debt.payoffToday || 0);
  $('debtPayoffOrder').value = nextPayoffOrder();
  $('debtNotes').value = debt.notes || '';
  showToast('Rolagem preparada para edição.');
};

window.goToDebtsAndNew = function(defaultStatus = 'Ativa') {
  window.openDebtForm('new', null, defaultStatus);
};

window.openDebtFromDashboard = function(id) {
  window.showDividasView('divrota');
  state.expandedDebtId = id;
  if (state.renderFn) state.renderFn();
  const road = document.getElementById('trailRoad');
  if (road) road.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.openDebtFromTrail = function(id) {
  const debt = state.debts.find(item => item.id === id);
  const view = debt && debt.status === 'Quitada' ? 'divquitadas'
    : debt && debt.status === 'Fora do radar' ? 'divradar'
    : debt && debt.status === 'Em espera' ? 'divespera'
    : 'divrota';
  window.showDividasView(view);
  state.expandedDebtId = id;
  if (state.renderFn) state.renderFn();
  const targetId = debt && debt.status === 'Quitada' ? 'paidOffDebts'
    : debt && debt.status === 'Fora do radar' ? 'hiddenDebts'
    : debt && debt.status === 'Em espera' ? 'waitingDebts'
    : 'trailRoad';
  const target = document.getElementById(targetId);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// --- Firebase: reconciliar e gerar parcelas ---

async function reconcileInstallmentsForDebt(debtId, qty, value, firstDue) {
  const q = query(installmentsColl(), where('debtId', '==', debtId));
  const snap = await getDocs(q);
  const existing = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const byNumber = new Map(existing.map(item => [Number(item.number), item]));
  const paidInstallmentIds = new Set(state.payments.filter(p => p.debtId === debtId).map(p => p.installmentId));
  const batch = writeBatch();
  for (let i = 0; i < qty; i++) {
    const number = i + 1;
    const current = byNumber.get(number);
    const nextData = { debtId, number, total: qty, dueDate: addMonths(firstDue, i), expectedValue: value, status: current?.status || 'Pendente', updatedAt: serverTimestamp() };
    if (current) {
      const hasPayment = current.status === 'Paga' || paidInstallmentIds.has(current.id);
      batch.update(current.ref, hasPayment ? { total: qty, updatedAt: serverTimestamp() } : nextData);
    } else {
      const ref = doc(installmentsColl());
      batch.set(ref, { ...nextData, createdAt: serverTimestamp() });
    }
  }
  existing.filter(item => Number(item.number) > qty).forEach(item => {
    const hasPayment = item.status === 'Paga' || paidInstallmentIds.has(item.id);
    if (hasPayment) batch.update(item.ref, { total: qty, updatedAt: serverTimestamp() });
    else batch.delete(item.ref);
  });
  await batch.commit();
  await state.loadAllFn();
}

async function generateInstallments(debtId, qty, value, firstDue) {
  const batch = writeBatch();
  for (let i = 0; i < qty; i++) {
    const ref = doc(installmentsColl());
    batch.set(ref, { debtId, number: i + 1, total: qty, dueDate: addMonths(firstDue, i), expectedValue: value, status: 'Pendente', createdAt: serverTimestamp() });
  }
  await batch.commit();
}

