import {
  exportDividasJson,
  exportDebtsCsv,
  exportDebtPaymentsCsv,
  handleDividasJsonImport,
  openClearAllModal,
  closeDeleteModal,
  confirmDelete
} from './data.js';
import {
  clearRenegotiationSelection,
  closeRenegotiationModal,
  openRenegotiationModal,
  saveRenegotiation,
  toggleRenegotiationDebt
} from './renegotiation.js';

export function bindDebtDataEvents() {
  const root = document.getElementById('divrenegociacaoView');
  if (!root || root.dataset.dataEventsBound === 'true') return;

  root.dataset.dataEventsBound = 'true';
  root.querySelector('#exportDividasJsonButton')?.addEventListener('click', exportDividasJson);
  root.querySelector('#exportDebtsCsvButton')?.addEventListener('click', exportDebtsCsv);
  root.querySelector('#exportDebtPaymentsCsvButton')?.addEventListener('click', exportDebtPaymentsCsv);
  root.querySelector('#dividasJsonImportFile')?.addEventListener('change', handleDividasJsonImport);
  root.querySelector('#openClearAllModalButton')?.addEventListener('click', openClearAllModal);
  root.querySelector('#clearRenegotiationSelectionButton')?.addEventListener('click', clearRenegotiationSelection);
  root.querySelector('#openRenegotiationModalButton')?.addEventListener('click', openRenegotiationModal);
  root.addEventListener('change', (event) => {
    const input = event.target.closest('[data-renegotiation-debt-id]');
    if (!input || !root.contains(input)) return;
    toggleRenegotiationDebt(input.dataset.renegotiationDebtId);
  });

  document.getElementById('closeRenegotiationModalButton')?.addEventListener('click', closeRenegotiationModal);
  document.getElementById('saveRenegotiationButton')?.addEventListener('click', saveRenegotiation);
  document.getElementById('closeDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteButton')?.addEventListener('click', confirmDelete);
}
