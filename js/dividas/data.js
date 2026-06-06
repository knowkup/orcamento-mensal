import { state } from './state.js';
import { $, showToast, getCreditorName } from './utils.js';
import { debtBalance } from './calc.js';
import { reactivateDebtIfOpen } from './payment.js';
import { debtsColl, debtDoc, installmentsColl, installmentDoc, paymentsColl, paymentDoc, debtCreditorsColl, debtCreditorDoc, addDoc, getDocs, doc, deleteDoc, updateDoc, writeBatch, query, where, serverTimestamp } from './firebase.js';

const DIVIDAS_PREFS_KEY = 'dividas-preferences';

// --- Export CSV ---

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function serializable(item) {
  return Object.fromEntries(Object.entries(item).map(([key, value]) => {
    if (value && typeof value.toDate === 'function') return [key, value.toDate().toISOString()];
    if (value && value.seconds) return [key, new Date(value.seconds * 1000).toISOString()];
    return [key, value ?? ''];
  }));
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function toCsv(headers, rows) {
  return [headers.join(';')].concat(rows.map(row => headers.map(header => csvValue(row[header])).join(';'))).join('\n');
}

export function exportDividasJson() {
  const backup = {
    exportedAt: new Date().toISOString(),
    app: 'Rota Financeira - Orçamento Mensal',
    creditors: state.creditors.map(serializable),
    debts: state.debts.map(serializable),
    installments: state.installments.map(serializable),
    payments: state.payments.map(serializable)
  };
  downloadText('dividas-backup.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
}

export function triggerDividasJsonImport() {
  $('dividasJsonImportFile').click();
}

export function handleDividasJsonImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(String(reader.result || '{}'));
      await importJsonBackup(payload);
      event.target.value = '';
    } catch (error) {
      showToast('Não foi possível importar este JSON.');
    }
  };
  reader.readAsText(file);
}

export function exportDebtsCsv() {
  const headers = ['credor', 'divida', 'tipo', 'situacao', 'criticidade', 'parcelas', 'valorParcela', 'saldo', 'quitacaoHoje', 'primeiroVencimento'];
  const rows = state.debts.map(debt => ({
    credor: getCreditorName(debt.creditorId),
    divida: debt.name || '',
    tipo: debt.type || '',
    situacao: debt.status || '',
    criticidade: debt.criticality || '',
    parcelas: debt.installmentsQty || '',
    valorParcela: Number(debt.installmentValue || 0).toFixed(2).replace('.', ','),
    saldo: debtBalance(debt).toFixed(2).replace('.', ','),
    quitacaoHoje: Number(debt.payoffToday || 0).toFixed(2).replace('.', ','),
    primeiroVencimento: debt.firstDue || ''
  }));
  downloadText('dividas.csv', toCsv(headers, rows), 'text/csv;charset=utf-8');
}

export function exportDebtPaymentsCsv() {
  const headers = ['data', 'credor', 'divida', 'parcela', 'valorPrevisto', 'valorPago', 'desconto', 'juros'];
  const rows = state.payments.map(payment => {
    const debt = state.debts.find(item => item.id === payment.debtId);
    const installment = state.installments.find(item => item.id === payment.installmentId);
    return {
      data: payment.paymentDate || '',
      credor: debt ? getCreditorName(debt.creditorId) : '',
      divida: debt?.name || '',
      parcela: installment ? installment.number + '/' + installment.total : '',
      valorPrevisto: Number(payment.expectedValue || 0).toFixed(2).replace('.', ','),
      valorPago: Number(payment.paidValue || 0).toFixed(2).replace('.', ','),
      desconto: Number(payment.discount || 0).toFixed(2).replace('.', ','),
      juros: Number(payment.interest || 0).toFixed(2).replace('.', ',')
    };
  });
  downloadText('dividas-pagamentos.csv', toCsv(headers, rows), 'text/csv;charset=utf-8');
}

// --- Import JSON ---

function cleanImportedPayload(item, idMap = {}) {
  const payload = { ...item };
  delete payload.id;
  delete payload.createdAt;
  delete payload.updatedAt;
  if (payload.creditorId && idMap.creditors?.has(payload.creditorId)) payload.creditorId = idMap.creditors.get(payload.creditorId);
  if (payload.debtId && idMap.debts?.has(payload.debtId)) payload.debtId = idMap.debts.get(payload.debtId);
  if (payload.installmentId && idMap.installments?.has(payload.installmentId)) payload.installmentId = idMap.installments.get(payload.installmentId);
  return { ...payload, importedAt: serverTimestamp(), updatedAt: serverTimestamp() };
}

async function importJsonBackup(payload) {
  const importedCreditors = Array.isArray(payload.creditors) ? payload.creditors : [];
  const importedDebts = Array.isArray(payload.debts) ? payload.debts : [];
  const importedInstallments = Array.isArray(payload.installments) ? payload.installments : [];
  const importedPayments = Array.isArray(payload.payments) ? payload.payments : [];
  const idMap = { creditors: new Map(), debts: new Map(), installments: new Map() };

  showToast(`Importando: ${importedCreditors.length} credores, ${importedDebts.length} dívidas, ${importedInstallments.length} parcelas...`);

  for (const item of importedCreditors) {
    const created = await addDoc(debtCreditorsColl(), cleanImportedPayload(item, idMap));
    if (item.id) idMap.creditors.set(item.id, created.id);
  }
  for (const item of importedDebts) {
    const created = await addDoc(debtsColl(), cleanImportedPayload(item, idMap));
    if (item.id) idMap.debts.set(item.id, created.id);
  }

  const CHUNK = 50;
  for (let i = 0; i < importedInstallments.length; i += CHUNK) {
    await Promise.all(importedInstallments.slice(i, i + CHUNK).map(async (item) => {
      const created = await addDoc(installmentsColl(), cleanImportedPayload(item, idMap));
      if (item.id) idMap.installments.set(item.id, created.id);
    }));
  }
  for (let i = 0; i < importedPayments.length; i += CHUNK) {
    await Promise.all(importedPayments.slice(i, i + CHUNK).map(async (item) => {
      await addDoc(paymentsColl(), cleanImportedPayload(item, idMap));
    }));
  }

  await state.loadAllFn();
  showToast('JSON importado com sucesso.');
}

// --- Modal de exclusão ---

export function openClearAllModal() {
  state.deleteContext = { type: 'all' };
  $('deleteModalTitle').textContent = 'Limpar todos os dados';
  $('deleteModalText').textContent = 'Deseja remover definitivamente credores, dívidas, parcelas e pagamentos?';
  $('deleteModalWarning').textContent = 'Essa ação limpa a base atual e não poderá ser desfeita. Exporte um JSON antes se quiser guardar backup.';
  document.getElementById('divDeleteDialog').showModal();
}

window.openDeleteModal = function(type, id) {
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
  } else {
    const creditor = state.creditors.find(c => c.id === id);
    if (!creditor) return;
    $('deleteModalTitle').textContent = 'Excluir credor';
    $('deleteModalText').textContent = 'Deseja excluir definitivamente ' + creditor.name + '?';
    $('deleteModalWarning').textContent = 'Só exclua credores que não estejam vinculados a dívidas.';
  }
  document.getElementById('divDeleteDialog').showModal();
};

window.closeDeleteModal = function() {
  state.deleteContext = null;
  document.getElementById('divDeleteDialog').close();
};

window.confirmDelete = async function() {
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
    state.debts = state.debts.filter(d => d.id !== debtId);
    state.installments = state.installments.filter(i => i.debtId !== debtId);
    state.payments = state.payments.filter(p => p.debtId !== debtId);
    if (state.expandedDebtId === debtId) state.expandedDebtId = null;
    window.closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Dívida removida com sucesso.');

  } else if (ctx.type === 'payment') {
    const paymentId = ctx.id;
    const installmentId = ctx.installmentId;
    const debtId = ctx.debtId;
    await deleteDoc(paymentDoc(paymentId));
    await updateDoc(installmentDoc(installmentId), { status: 'Pendente', paidAt: null, updatedAt: serverTimestamp() });
    state.payments = state.payments.filter(p => p.id !== paymentId);
    const inst = state.installments.find(i => i.id === installmentId);
    if (inst) { inst.status = 'Pendente'; delete inst.paidAt; }
    await reactivateDebtIfOpen(debtId);
    state.expandedDebtId = debtId;
    window.closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Pagamento excluído com sucesso.');

  } else if (ctx.type === 'all') {
    let batch = writeBatch();
    let operations = 0;
    const colls = [paymentsColl(), installmentsColl(), debtsColl(), debtCreditorsColl()];
    for (const coll of colls) {
      const snapshot = await getDocs(coll);
      for (const d of snapshot.docs) {
        batch.delete(d.ref);
        operations += 1;
        if (operations === 450) { await batch.commit(); batch = writeBatch(); operations = 0; }
      }
    }
    if (operations) await batch.commit();
    state.creditors = [];
    state.debts = [];
    state.installments = [];
    state.payments = [];
    state.expandedDebtId = null;
    state.selectedRenegotiationDebtIds.clear();
    window.closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Todos os dados foram removidos.');

  } else {
    const hasDebt = state.debts.some(d => d.creditorId === ctx.id);
    if (hasDebt) { window.closeDeleteModal(); return showToast('Este credor está vinculado a dívidas.'); }
    await deleteDoc(debtCreditorDoc(ctx.id));
    state.creditors = state.creditors.filter(c => c.id !== ctx.id);
    window.closeDeleteModal();
    if (state.renderFn) state.renderFn();
    showToast('Credor removido com sucesso.');
  }
};
