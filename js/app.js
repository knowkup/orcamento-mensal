import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";
import { state, el } from "./state.js";
import { loadLocalState, exportState, importState } from "./storage.js";
import { setupFirebase, handleLoginToggle, saveState } from "./firebase.js";
import { bindMoneyInputs, refreshIcons, formatCurrencyInput } from "./utils.js";
import { renderProjection } from "./planejamento.js";
import { renderMonthlyControl, confirmReceivedOccurrence, openExpensePaymentDialog, confirmPaidOccurrence, cancelPaidOccurrence, cancelReceivedOccurrence, openReceiveDialog, openPlannedDialog, deleteManualPlanned, closeMonth, openAccountBalanceDialog, saveAccountBalance, updatePlannedFields, addPlannedPurchase, closePlannedDialog, saveFixedCostAmount } from "./controle.js";
import { renderInstallments, addInstallment, openInstallmentDialog, closeInstallmentDialog, payInstallment, unpayInstallment, deleteInstallment } from "./parcelamentos.js";
import { renderFixedCosts, openFixedCostDialog, closeFixedCostDialog, updateFixedCostFields, addFixedCost } from "./custos-fixos.js";
import { renderCar, updateCar, openCarContractDialog, ensureCarPayments, updateSettings, openCarPaymentDialog, payCarInstallment, unpayCarInstallment } from "./carro.js";
import { renderFgts, openFgtsDialog, closeFgtsDialog, addFgtsContract, renderFgtsInstallmentValueFields } from "./fgts.js";
import { renderSettings, renderOrigins, renderCreditCards, renderRecurringIncomes, renderTaxTables, hydrateForms, addCreditor, openCreditorDialog, closeCreditorDialog, handleCreditorLogoUpload, openCardDialog, closeCardDialog, saveCreditCard, updateCardLogoPreview, openIncomeDialog, closeIncomeDialog, saveRecurringIncome, handleIncomeLogoUpload, closeIncomeExceptionDialog, saveIncomeException, toggleIncomeCltFields } from "./preferencias.js";
import { renderFerias, bindFeriasEvents } from "./ferias.js";
import { loadDividas } from "./dividas/boot.js";

boot();

async function boot() {
  state.data = loadLocalState();
  state.renderFn = render;
  state.hydrateFn = hydrateForms;
  state.saveStateFn = saveState;
  state.loadDividasFn = loadDividas;
  bindEvents();
  hydrateForms();
  render();
  await setupFirebase(firebaseConfig, isFirebaseConfigured);
}

function bindEvents() {
  el.navTabs.forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  el.loginButton.addEventListener("click", handleLoginToggle);
  el.exportButton.addEventListener("click", exportState);
  el.importInput.addEventListener("change", importState);
  el.installmentForm.addEventListener("submit", addInstallment);
  el.newInstallmentButton.addEventListener("click", openInstallmentDialog);
  el.closeInstallmentButton.addEventListener("click", closeInstallmentDialog);
  el.fixedCostForm.addEventListener("submit", addFixedCost);
  el.newFixedCostButton.addEventListener("click", () => openFixedCostDialog());
  el.closeFixedCostButton.addEventListener("click", closeFixedCostDialog);
  el.fixedCostForm.elements.paymentMethod.addEventListener("change", updateFixedCostFields);
  el.settingsForm.addEventListener("submit", updateSettings);
  el.carForm.addEventListener("submit", updateCar);
  el.editCarButton.addEventListener("click", openCarContractDialog);
  el.closeCarContractButton.addEventListener("click", () => el.carContractDialog.close());
  el.carPaymentForm.addEventListener("submit", payCarInstallment);
  el.closeCarPaymentButton.addEventListener("click", () => el.carPaymentDialog.close());
  el.receiveForm.addEventListener("submit", confirmReceivedOccurrence);
  el.closeReceiveButton.addEventListener("click", () => el.receiveDialog.close());
  el.expensePaymentForm.addEventListener("submit", confirmPaidOccurrence);
  el.closeExpensePaymentButton.addEventListener("click", () => el.expensePaymentDialog.close());
  el.accountBalanceForm.addEventListener("submit", saveAccountBalance);
  el.closeAccountBalanceButton.addEventListener("click", () => el.accountBalanceDialog.close());
  bindMoneyInputs();
  el.fgtsForm.addEventListener("submit", addFgtsContract);
  el.newFgtsButton.addEventListener("click", openFgtsDialog);
  el.closeFgtsButton.addEventListener("click", closeFgtsDialog);
  ["totalInstallments", "installmentAmount", "paidInstallments", "firstDueDate"].forEach((name) => {
    el.fgtsForm.elements[name].addEventListener("input", renderFgtsInstallmentValueFields);
    el.fgtsForm.elements[name].addEventListener("change", renderFgtsInstallmentValueFields);
  });
  el.creditorForm.addEventListener("submit", addCreditor);
  el.creditorForm.elements.logoFile.addEventListener("change", handleCreditorLogoUpload);
  el.newCreditorButton.addEventListener("click", () => openCreditorDialog());
  el.closeCreditorButton.addEventListener("click", closeCreditorDialog);
  el.cardForm.addEventListener("submit", saveCreditCard);
  el.cardForm.elements.creditorId.addEventListener("change", updateCardLogoPreview);
  el.newCardButton.addEventListener("click", () => openCardDialog());
  el.closeCardButton.addEventListener("click", closeCardDialog);
  el.incomeForm.addEventListener("submit", saveRecurringIncome);
  el.incomeForm.elements.logoFile.addEventListener("change", handleIncomeLogoUpload);
  el.newIncomeButton.addEventListener("click", () => openIncomeDialog());
  el.closeIncomeButton.addEventListener("click", closeIncomeDialog);
  el.addPlanButton.addEventListener("click", () => openPlannedDialog());
  el.addMonthlyPlanButton.addEventListener("click", () => openPlannedDialog());
  el.closeMonthButton.addEventListener("click", closeMonth);
  el.closePlanButton.addEventListener("click", closePlannedDialog);
  el.plannedForm.addEventListener("submit", addPlannedPurchase);
  document.querySelector("#plannedKindExpense")?.addEventListener("click", () => {
    el.plannedForm.elements.kind.value = "expense";
    updatePlannedFields();
  });
  document.querySelector("#plannedKindIncome")?.addEventListener("click", () => {
    el.plannedForm.elements.kind.value = "income";
    updatePlannedFields();
  });
  el.fixedCostAmountForm.addEventListener("submit", saveFixedCostAmount);
  el.closeFixedCostAmountButton.addEventListener("click", () => el.fixedCostAmountDialog.close());
  el.incomeExceptionForm.addEventListener("submit", saveIncomeException);
  el.closeIncomeExceptionButton.addEventListener("click", closeIncomeExceptionDialog);
  document.querySelector("#openTaxTablesButton")?.addEventListener("click", () => document.querySelector("#taxTablesDialog")?.showModal());
  document.querySelector("#closeTaxTablesButton")?.addEventListener("click", () => document.querySelector("#taxTablesDialog")?.close());
  bindFeriasEvents();
  // Label select → atualiza campos condicionais e faixa líquido
  document.querySelector("#incomeLabelSelect")?.addEventListener("change", toggleIncomeCltFields);
  // Botão "Trocar" → abre file input oculto
  document.querySelector("#incomeTrocarBtn")?.addEventListener("click", () => {
    el.incomeForm.elements.logoFile?.click();
  });
  // Campos CLT → atualiza faixa líquido em tempo real
  el.incomeForm.elements.amount?.addEventListener("input", toggleIncomeCltFields);
  el.incomeForm.elements.cltAlimentacao?.addEventListener("input", toggleIncomeCltFields);
  el.incomeForm.elements.cltConsignado?.addEventListener("input", toggleIncomeCltFields);
  el.projectionTopScroll.addEventListener("scroll", () => {
    el.projectionScroll.scrollLeft = el.projectionTopScroll.scrollLeft;
  });
  el.projectionScroll.addEventListener("scroll", () => {
    el.projectionTopScroll.scrollLeft = el.projectionScroll.scrollLeft;
  });
}

function showView(name) {
  el.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  el.views.forEach((view) => {
    const active = view.id === `${name}View`;
    view.classList.toggle("active", active);
    if (active) {
      el.viewTitle.textContent = view.dataset.title;
      const eyebrow = document.getElementById("viewEyebrow");
      const subtitle = document.getElementById("viewSubtitle");
      if (eyebrow) eyebrow.textContent = view.dataset.eyebrow || "";
      if (subtitle) subtitle.textContent = view.dataset.subtitle || "";
    }
  });
  refreshIcons();
}
window.showView = showView;

function render() {
  renderProjection();
  renderMonthlyControl();
  renderInstallments();
  renderFixedCosts();
  renderCar();
  renderFgts();
  renderOrigins();
  renderCreditCards();
  renderRecurringIncomes();
  renderSettings();
  renderTaxTables();
  renderFerias();
  bindMoneyInputs();
  refreshIcons();
}
