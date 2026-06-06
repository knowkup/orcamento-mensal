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
import { runDebtOperation } from './operation.js';

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
      if (button.dataset.routeScope === 'waiting') {
        runDebtOperation(
          () => moveWaitingDebt(button.dataset.secondaryRouteMove, direction),
          'Não foi possível atualizar a ordem de espera.'
        );
      }
      if (button.dataset.routeScope === 'hidden') {
        runDebtOperation(
          () => moveHiddenDebt(button.dataset.secondaryRouteMove, direction),
          'Não foi possível atualizar a ordem fora do radar.'
        );
      }
      return;
    }

    const action = button.dataset.debtAction;
    const debtId = button.dataset.debtId;
    if (!action || !debtId) return;
    if (action === 'changeDebtStatus') runDebtOperation(
      () => changeDebtStatus(debtId, button.dataset.debtStatus),
      'Não foi possível mover a dívida.'
    );
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
    runDebtOperation(
      () => moveDebtInTrail(button.dataset.routeMove, Number(button.dataset.direction || 0)),
      'Não foi possível atualizar a ordem da rota.'
    );
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
    runDebtOperation(() => dropRouteDebt(event, item.dataset.debtId), 'Não foi possível atualizar a ordem da rota.');
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
    if (item.dataset.debtRoute === 'waiting') {
      runDebtOperation(() => dropWaitingDebt(event, item.dataset.debtId), 'Não foi possível atualizar a ordem de espera.');
    }
    if (item.dataset.debtRoute === 'hidden') {
      runDebtOperation(() => dropHiddenDebt(event, item.dataset.debtId), 'Não foi possível atualizar a ordem fora do radar.');
    }
  });
  document.addEventListener('dragend', (event) => {
    const item = event.target.closest('[data-debt-route]');
    if (!item) return;
    if (item.dataset.debtRoute === 'waiting') endWaitingDebtDrag();
    if (item.dataset.debtRoute === 'hidden') endHiddenDebtDrag();
  });

  document.getElementById('closeRenegotiationModalButton')?.addEventListener('click', closeRenegotiationModal);
  document.getElementById('saveRenegotiationButton')?.addEventListener('click', () => runDebtOperation(saveRenegotiation, 'Não foi possível salvar o acordo.'));
  document.getElementById('closeDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteModalButton')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteButton')?.addEventListener('click', () => runDebtOperation(confirmDelete, 'Não foi possível concluir a exclusão.'));
  document.getElementById('closeDebtPaymentModalButton')?.addEventListener('click', closePaymentForm);
  document.getElementById('saveDebtPaymentButton')?.addEventListener('click', () => runDebtOperation(savePayment, 'Não foi possível registrar o pagamento.'));
  document.getElementById('closeDebtPayoffModalButton')?.addEventListener('click', closePayoffModal);
  document.getElementById('payoffValue')?.addEventListener('input', updatePayoffSummary);
  document.getElementById('confirmDebtPayoffButton')?.addEventListener('click', () => runDebtOperation(confirmPayoffDebt, 'Não foi possível quitar a dívida.'));
  document.getElementById('closeDebtInstallmentModalButton')?.addEventListener('click', closeInstallmentModal);
  document.getElementById('saveDebtInstallmentButton')?.addEventListener('click', () => runDebtOperation(saveInstallmentEdit, 'Não foi possível atualizar a parcela.'));
  document.getElementById('closeDebtFormButton')?.addEventListener('click', closeDebtForm);
  document.getElementById('debtIsConsignado')?.addEventListener('change', syncDebtBudgetAvailability);
  document.getElementById('saveDebtButton')?.addEventListener('click', () => runDebtOperation(saveDebt, 'Não foi possível salvar a dívida.'));
}
