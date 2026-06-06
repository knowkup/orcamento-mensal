import {
  exportDividasJson,
  exportDebtsCsv,
  exportDebtPaymentsCsv,
  handleDividasJsonImport,
  openClearAllModal,
  closeDeleteModal,
  confirmDelete,
  openDeleteModal
} from './data.js';
import {
  clearRenegotiationSelection,
  closeRenegotiationModal,
  openRenegotiationModal,
  saveRenegotiation,
  toggleRenegotiationDebt
} from './renegotiation.js';
import {
  dropHiddenDebt,
  dropWaitingDebt,
  endHiddenDebtDrag,
  endWaitingDebtDrag,
  hiddenDebtDragOver,
  moveHiddenDebt,
  moveWaitingDebt,
  setDebtInstallmentTab,
  setHiddenDebtSort,
  setWaitingDebtSort,
  showAllDebtInstallments,
  startHiddenDebtDrag,
  startWaitingDebtDrag,
  toggleDebt,
  waitingDebtDragOver
} from './debts.js';
import {
  dropRouteDebt,
  endRouteDrag,
  moveDebtInTrail,
  routeDragOver,
  setTrailDebtSort,
  startRouteDrag
} from './trail.js';
import {
  closeInstallmentModal,
  closePaymentForm,
  closePayoffModal,
  confirmPayoffDebt,
  saveInstallmentEdit,
  savePayment,
  openPaymentForm,
  openPayoffModal,
  updatePayoffSummary
} from './payment.js';
import {
  changeDebtStatus,
  closeDebtForm,
  goToDebtsAndNew,
  openDebtForm,
  openDebtFromDashboard,
  saveDebt,
  syncDebtBudgetAvailability
} from './debt-form.js';

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
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.toggleDebt) {
      toggleDebt(button.dataset.toggleDebt);
      return;
    }
    if (button.dataset.newDebtStatus) {
      goToDebtsAndNew(button.dataset.newDebtStatus);
      return;
    }
    if (button.dataset.paymentInstallmentId) {
      openPaymentForm(button.dataset.paymentInstallmentId);
      return;
    }
    if (button.dataset.deleteType && button.dataset.deleteId) {
      openDeleteModal(button.dataset.deleteType, button.dataset.deleteId);
      return;
    }
    if (button.dataset.installmentTab) {
      setDebtInstallmentTab(button.dataset.installmentTab);
      return;
    }
    if (button.hasAttribute('data-show-all-installments')) {
      showAllDebtInstallments();
      return;
    }
    if (button.dataset.dashboardDebtId) {
      openDebtFromDashboard(button.dataset.dashboardDebtId);
      return;
    }
    if (button.dataset.secondaryRouteMove) {
      const direction = Number(button.dataset.direction || 0);
      if (button.dataset.routeScope === 'waiting') moveWaitingDebt(button.dataset.secondaryRouteMove, direction);
      if (button.dataset.routeScope === 'hidden') moveHiddenDebt(button.dataset.secondaryRouteMove, direction);
      return;
    }

    const action = button.dataset.debtAction;
    const debtId = button.dataset.debtId;
    if (!action || !debtId) return;
    if (action === 'changeDebtStatus') changeDebtStatus(debtId, button.dataset.debtStatus);
    if (action === 'openPayoffModal') openPayoffModal(debtId);
    if (action === 'openDebtForm') openDebtForm('edit', debtId);
    if (action === 'openDeleteModal') openDeleteModal('debt', debtId);
  });
  document.getElementById('trailDebtSort')?.addEventListener('change', (event) => {
    setTrailDebtSort(event.target.value);
  });
  document.getElementById('waitingDebtSort')?.addEventListener('change', (event) => {
    setWaitingDebtSort(event.target.value);
  });
  document.getElementById('hiddenDebtSort')?.addEventListener('change', (event) => {
    setHiddenDebtSort(event.target.value);
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
  document.addEventListener('dragstart', (event) => {
    const item = event.target.closest('[data-debt-route]');
    if (!item) return;
    if (item.dataset.debtRoute === 'waiting') startWaitingDebtDrag(event, item.dataset.debtId);
    if (item.dataset.debtRoute === 'hidden') startHiddenDebtDrag(event, item.dataset.debtId);
  });
  document.addEventListener('dragover', (event) => {
    const item = event.target.closest('[data-debt-route]');
    if (!item) return;
    if (item.dataset.debtRoute === 'waiting') waitingDebtDragOver(event);
    if (item.dataset.debtRoute === 'hidden') hiddenDebtDragOver(event);
  });
  document.addEventListener('drop', (event) => {
    const item = event.target.closest('[data-debt-route]');
    if (!item) return;
    if (item.dataset.debtRoute === 'waiting') dropWaitingDebt(event, item.dataset.debtId);
    if (item.dataset.debtRoute === 'hidden') dropHiddenDebt(event, item.dataset.debtId);
  });
  document.addEventListener('dragend', (event) => {
    const item = event.target.closest('[data-debt-route]');
    if (!item) return;
    if (item.dataset.debtRoute === 'waiting') endWaitingDebtDrag();
    if (item.dataset.debtRoute === 'hidden') endHiddenDebtDrag();
  });

  document.getElementById('closeRenegotiationModalButton')?.addEventListener('click', closeRenegotiationModal);
  document.getElementById('saveRenegotiationButton')?.addEventListener('click', saveRenegotiation);
  document.getElementById('closeDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteButton')?.addEventListener('click', confirmDelete);
  document.getElementById('closeDebtPaymentModalButton')?.addEventListener('click', closePaymentForm);
  document.getElementById('saveDebtPaymentButton')?.addEventListener('click', savePayment);
  document.getElementById('closeDebtPayoffModalButton')?.addEventListener('click', closePayoffModal);
  document.getElementById('payoffValue')?.addEventListener('input', updatePayoffSummary);
  document.getElementById('confirmDebtPayoffButton')?.addEventListener('click', confirmPayoffDebt);
  document.getElementById('closeDebtInstallmentModalButton')?.addEventListener('click', closeInstallmentModal);
  document.getElementById('saveDebtInstallmentButton')?.addEventListener('click', saveInstallmentEdit);
  document.getElementById('closeDebtFormButton')?.addEventListener('click', closeDebtForm);
  document.getElementById('debtIsConsignado')?.addEventListener('change', syncDebtBudgetAvailability);
  document.getElementById('saveDebtButton')?.addEventListener('click', saveDebt);
}
