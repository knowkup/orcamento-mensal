import { state } from './state.js';
import { debtDoc, writeBatch, serverTimestamp } from './firebase.js';
import { showToast } from './utils.js';

export async function persistDebtOrder(route, options = {}) {
  const batch = writeBatch();
  route.forEach((debt, index) => {
    const payoffOrder = index + 1;
    batch.update(debtDoc(debt.id), { payoffOrder, updatedAt: serverTimestamp() });
    const local = state.debts.find(item => item.id === debt.id);
    if (local) local.payoffOrder = payoffOrder;
  });
  await batch.commit();

  if (options.sortStateKey) state[options.sortStateKey] = 'trail';
  if (options.sortSelectId) {
    const select = document.getElementById(options.sortSelectId);
    if (select) select.value = 'trail';
  }
  if (state.renderFn) state.renderFn();
  if (options.message) showToast(options.message);
}

export function beginDebtDrag(event, id, options) {
  state[options.stateKey] = id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }
  event.target.closest(options.itemSelector)?.classList.add('dragging');
}

export function allowDebtDrop(event) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

export function takeDebtDropSource(event, options) {
  event.preventDefault();
  const sourceId = state[options.stateKey] || event.dataTransfer?.getData('text/plain');
  endDebtDrag(options);
  return sourceId;
}

export function endDebtDrag(options) {
  state[options.stateKey] = null;
  document.querySelectorAll(options.draggingSelector).forEach(item => item.classList.remove('dragging'));
}
