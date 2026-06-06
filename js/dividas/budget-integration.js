import { state, rebuildIndexes } from './state.js';
import { state as mainState } from '../state.js';
import { addDoc, updateDoc, deleteDoc, installmentDoc, paymentsColl, paymentDoc, serverTimestamp } from './firebase.js';

export function getDebtInstallmentsForMonth(month) {
  return state.debts
    .filter(d => d.includeInBudget && d.status !== 'Quitada')
    .flatMap(debt => {
      const paidViaControle = (mainState.data?.paidOccurrences || []).includes(`auto-debt-${debt.id}:${month}`);
      const installment = state.installments
        .filter(i => i.debtId === debt.id
          && String(i.dueDate || '').startsWith(month)
          && (i.status === 'Pendente' || (i.status === 'Paga' && paidViaControle)))
        .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))[0];
      if (!installment) return [];
      const creditorName = (state.creditors.find(c => c.id === debt.creditorId)
        || (mainState.data?.creditors || []).find(c => c.id === debt.creditorId))?.name || '';
      const row = {
        id: `auto-debt-${debt.id}`,
        kind: 'expense',
        owner: 'Felipe',
        creditorId: debt.creditorId || '',
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
