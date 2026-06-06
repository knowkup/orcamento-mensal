import {
  exportDividasJson,
  exportDebtsCsv,
  exportDebtPaymentsCsv,
  handleDividasJsonImport,
  openClearAllModal
} from './data.js';
import { clearRenegotiationSelection, openRenegotiationModal } from './renegotiation.js';

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
}
