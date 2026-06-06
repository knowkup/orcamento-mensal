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
import { toggleDebt } from './debts.js';
import {
  dropRouteDebt,
  endRouteDrag,
  moveDebtInTrail,
  routeDragOver,
  setTrailDebtSort,
  startRouteDrag
} from './trail.js';

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

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-toggle-debt]');
    if (!button) return;
    toggleDebt(button.dataset.toggleDebt);
  });
  document.getElementById('trailDebtSort')?.addEventListener('change', (event) => {
    setTrailDebtSort(event.target.value);
  });
  const trailRoad = document.getElementById('trailRoad');
  trailRoad?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-route-move]');
    if (!button || !trailRoad.contains(button)) return;
    moveDebtInTrail(button.dataset.routeMove, Number(button.dataset.direction || 0));
  });
  trailRoad?.addEventListener('dragstart', (event) => {
    const item = event.target.closest('.route-item[draggable="true"]');
    if (!item || !trailRoad.contains(item)) return;
    startRouteDrag(event, item.dataset.debtId);
  });
  trailRoad?.addEventListener('dragover', (event) => {
    const item = event.target.closest('.route-item[draggable="true"]');
    if (!item || !trailRoad.contains(item)) return;
    routeDragOver(event);
  });
  trailRoad?.addEventListener('drop', (event) => {
    const item = event.target.closest('.route-item[draggable="true"]');
    if (!item || !trailRoad.contains(item)) return;
    dropRouteDebt(event, item.dataset.debtId);
  });
  trailRoad?.addEventListener('dragend', endRouteDrag);

  document.getElementById('closeRenegotiationModalButton')?.addEventListener('click', closeRenegotiationModal);
  document.getElementById('saveRenegotiationButton')?.addEventListener('click', saveRenegotiation);
  document.getElementById('closeDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteButton')?.addEventListener('click', confirmDelete);
}
