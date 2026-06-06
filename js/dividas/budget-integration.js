import { state, rebuildIndexes } from './state.js';
import { state as mainState } from '../state.js';
import { addDoc, updateDoc, deleteDoc, installmentDoc, paymentsColl, paymentDoc, serverTimestamp } from './firebase.js';
import { debtInstallmentForMonth, debtBudgetRow } from '../domain/debt-budget.js';

export function getDebtInstallmentsForMonth(month) {
  return state.debts
    .filter(d => d.includeInBudget && d.status !== 'Quitada')
    .flatMap(debt => {
      const installment = debtInstallmentForMonth({
        debt,
        installments: state.installments,
        month,
        paidOccurrences: mainState.data?.paidOccurrences || []
      });
      if (!installment) return [];
      const creditorName = (state.creditors.find(c => c.id === debt.creditorId)
        || (mainState.data?.creditors || []).find(c => c.id === debt.creditorId))?.name || '';
      return [debtBudgetRow({ debt, installment, creditorName, month })];
    });
}

export async function markDebtInstallmentPaid(debtId, month, paid, amount, paymentDate) {
  const installment = state.installments.find(
    i => i.debtId === debtId
      && i.status === (paid ? 'Pendente' : 'Paga')
      && String(i.dueDate || '').startsWith(month)
  );
  if (!installment) return;

  if (paid) {
    await updateDoc(installmentDoc(installment.id), { status: 'Paga', updatedAt: serverTimestamp() });
    const created = await addDoc(paymentsColl(), {
      debtId,
      installmentId: installment.id,
      expectedValue: Number(installment.expectedValue || 0),
      paidValue: Number(amount || installment.expectedValue || 0),
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      discount: 0,
      interest: 0,
      source: 'monthly-control',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    installment.status = 'Paga';
    state.payments.push({
      id: created.id,
      debtId,
      installmentId: installment.id,
      expectedValue: Number(installment.expectedValue || 0),
      paidValue: Number(amount || installment.expectedValue || 0),
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      discount: 0,
      interest: 0,
      source: 'monthly-control'
    });
  } else {
    const payment = state.paymentByInstallment.get(installment.id);
    if (payment) {
      await deleteDoc(paymentDoc(payment.id));
      state.payments = state.payments.filter(p => p.id !== payment.id);
    }
    await updateDoc(installmentDoc(installment.id), { status: 'Pendente', updatedAt: serverTimestamp() });
    installment.status = 'Pendente';
  }

  rebuildIndexes();
  if (state.renderFn) state.renderFn();
}
