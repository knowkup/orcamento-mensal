import { state } from './state.js';
import { $, showToast, getCreditorName } from './utils.js';
import { debtBalance } from './calc.js';
import { reactivateDebtIfOpen } from './payment.js';
import { clearDebtGraph, removeDebtGraph, removePaymentAndReopenInstallment } from '../domain/debt-transactions.js';
import { debtsColl, debtDoc, installmentsColl, installmentDoc, paymentsColl, paymentDoc, getDocs, deleteDoc, updateDoc, writeBatch, query, where, serverTimestamp } from './firebase.js';

// --- Modal de exclusão ---

export function openClearAllModal() {
  state.deleteContext = { type: 'all' };
  $('deleteModalTitle').textContent = 'Limpar todos os dados';
  $('deleteModalText').textContent = 'Deseja remover definitivamente dívidas, parcelas e pagamentos?';
  $('deleteModalWarning').textContent = 'Essa ação limpa a base atual e não poderá ser desfeita. Exporte um JSON antes se quiser guardar backup.';
  document.getElementById('divDeleteDialog').showModal();
}

export function openDeleteModal(type, id) {
  state.deleteContext = { type, id };
  if (type === 'debt') {
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;
    $('deleteModalTitle').textContent = 'Excluir dívida';
    $('deleteModalText').textContent = 'Deseja excluir definitivamente ' + getCreditorName(debt.creditorId) + ' · ' + debt.name + '?';
    $('deleteModalWarning').textContent = 'Essa ação removerá também parcelas e pagamentos vinculados a esta dívida.';
  } else if (type === 'payment') {
    const payment = state.payments.find(p => p.id === id);
    const inst = payment ? state.installments.find(i => i.id === payment.installmentId) : null;
    const debt = inst ? state.debts.find(d => d.id === inst.debtId) : null;
    if (!payment || !inst) return;
    state.deleteContext = { type, id, installmentId: inst.id, debtId: inst.debtId };
    $('deleteModalTitle').textContent = 'Excluir pagamento';
    $('deleteModalText').textContent = 'Deseja excluir o pagamento da parcela ' + inst.number + '/' + inst.total + (debt ? ' de ' + getCreditorName(debt.creditorId) + ' · ' + debt.name : '') + '?';
    $('deleteModalWarning').textContent = 'A parcela voltará para pendente e o registro de pagamento será removido.';
  } else return;
  document.getElementById('divDeleteDialog').showModal();
}

export function closeDeleteModal() {
  state.deleteContext = null;
  document.getElementById('divDeleteDialog').close();
}

export async function confirmDelete() {
  if (!state.deleteContext) return;
  const ctx = state.deleteContext;

  if (ctx.type === 'debt') {
    const debtId = ctx.id;
    const batch = writeBatch();
    batch.delete(debtDoc(debtId));
    const debtInstallmentSnap = await getDocs(query(installmentsColl(), where('debtId', '==', debtId)));
    const debtPaymentSnap = await getDocs(query(paymentsColl(), where('debtId', '==', debtId)));
    debtInstallmentSnap.forEach(d => batch.delete(d.ref));
    debtPaymentSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    Object.assign(state, removeDebtGraph(state, debtId));
    if (state.expandedDebtId === debtId) state.expandedDebtId = null;
    closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Dívida removida com sucesso.');

  } else if (ctx.type === 'payment') {
    const paymentId = ctx.id;
    const installmentId = ctx.installmentId;
    const debtId = ctx.debtId;
    await deleteDoc(paymentDoc(paymentId));
    await updateDoc(installmentDoc(installmentId), { status: 'Pendente', paidAt: null, updatedAt: serverTimestamp() });
    Object.assign(state, removePaymentAndReopenInstallment(state, paymentId, installmentId));
    await reactivateDebtIfOpen(debtId);
    state.expandedDebtId = debtId;
    closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Pagamento excluído com sucesso.');

  } else if (ctx.type === 'all') {
    let batch = writeBatch();
    let operations = 0;
    const colls = [paymentsColl(), installmentsColl(), debtsColl()];
    for (const coll of colls) {
      const snapshot = await getDocs(coll);
      for (const d of snapshot.docs) {
        batch.delete(d.ref);
        operations += 1;
        if (operations === 450) { await batch.commit(); batch = writeBatch(); operations = 0; }
      }
    }
    if (operations) await batch.commit();
    Object.assign(state, clearDebtGraph());
    state.expandedDebtId = null;
    state.selectedRenegotiationDebtIds.clear();
    closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Todos os dados foram removidos.');
  }
}
