import { showToast } from './utils.js';

export async function runDebtOperation(operation, errorMessage = 'Não foi possível concluir a operação.') {
  try {
    return await operation();
  } catch (error) {
    console.error(error);
    showToast(errorMessage, 'error');
    return null;
  }
}
