import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";
import { state, el } from "./state.js";
import { loadLocalState, exportState, importState } from "./storage.js";
import { setupFirebase, saveState } from "./firebase.js";
import { bindMoneyInputs, refreshIcons, updateSync } from "./utils.js";
import { renderProjection } from "./planejamento/planejamento.js";
import { renderMonthlyControl, confirmReceivedOccurrence, confirmPaidOccurrence, openPlannedDialog, closeMonth, saveAccountBalance, updatePlannedFields, addPlannedPurchase, closePlannedDialog, saveFixedCostAmount, navigateControlMonth } from "./controle/controle.js";
import { renderInstallments, addInstallment, openInstallmentDialog, closeInstallmentDialog } from "./parcelamentos/parcelamentos.js";
import { renderFixedCosts, openFixedCostDialog, closeFixedCostDialog, updateFixedCostFields, addFixedCost } from "./custos-fixos/custos-fixos.js";
import { renderCar, updateCar, openCarContractDialog, updateSettings, payCarInstallment } from "./carro/carro.js";
import { renderFgts, openFgtsDialog, closeFgtsDialog, addFgtsContract, renderFgtsInstallmentValueFields } from "./fgts/fgts.js";
import { renderSettings, renderOrigins, renderCreditCards, renderRecurringIncomes, renderTaxTables, hydrateForms, addCreditor, openCreditorDialog, closeCreditorDialog, handleCreditorLogoUpload, openCardDialog, closeCardDialog, saveCreditCard, updateCardLogoPreview, openIncomeDialog, closeIncomeDialog, saveRecurringIncome, handleIncomeLogoUpload, closeIncomeExceptionDialog, saveIncomeException, toggleIncomeCltFields } from "./preferencias.js";
import { renderFerias, bindFeriasEvents } from "./ferias/ferias.js";
import { loadDividas } from "./dividas/boot.js";

boot();

async function boot() {
  state.data = loadLocalState();
  state.renderFn = renderCurrentView;
  state.hydrateFn = hydrateForms;
  state.saveStateFn = saveState;
  state.loadDividasFn = loadDividas;
  bindEvents();
  hydrateForms();
  renderAll();
  await setupFirebase(firebaseConfig, isFirebaseConfigured);
}

function bindEvents() {
  el.navTabs.forEach((button) => on(button, "click", () => showView(button.dataset.view)));
  on(el.exportButton, "click", exportState);
  on(el.importInput, "change", importState);
  const menuBtn = document.getElementById("topbarMenuButton");
  const dropdown = document.getElementById("topbarDropdown");
  if (menuBtn && dropdown) {
    on(menuBtn, "click", (e) => { e.stopPropagation(); dropdown.classList.toggle("is-open"); });
    on(document, "click", () => dropdown.classList.remove("is-open"));
  }
  on(el.installmentForm, "submit", addInstallment);
  on(el.newInstallmentButton, "click", openInstallmentDialog);
  on(el.closeInstallmentButton, "click", closeInstallmentDialog);
  on(el.fixedCostForm, "submit", addFixedCost);
  on(el.newFixedCostButton, "click", () => openFixedCostDialog());
  on(el.closeFixedCostButton, "click", closeFixedCostDialog);
  on(el.fixedCostForm.elements.paymentMethod, "change", updateFixedCostFields);
  on(el.settingsForm, "submit", updateSettings);
  on(el.carForm, "submit", updateCar);
  on(el.editCarButton, "click", openCarContractDialog);
  on(el.closeCarContractButton, "click", () => closeDialog(el.carContractDialog));
  on(el.carPaymentForm, "submit", payCarInstallment);
  on(el.closeCarPaymentButton, "click", () => closeDialog(el.carPaymentDialog));
  on(el.receiveForm, "submit", confirmReceivedOccurrence);
  on(el.closeReceiveButton, "click", () => closeDialog(el.receiveDialog));
  on(el.expensePaymentForm, "submit", confirmPaidOccurrence);
  on(el.closeExpensePaymentButton, "click", () => closeDialog(el.expensePaymentDialog));
  on(el.accountBalanceForm, "submit", saveAccountBalance);
  on(el.closeAccountBalanceButton, "click", () => closeDialog(el.accountBalanceDialog));
  bindMoneyInputs();
  on(el.fgtsForm, "submit", addFgtsContract);
  on(el.newFgtsButton, "click", openFgtsDialog);
  on(el.closeFgtsButton, "click", closeFgtsDialog);
  ["totalInstallments", "installmentAmount", "paidInstallments", "firstDueDate"].forEach((name) => {
    on(el.fgtsForm.elements[name], "input", renderFgtsInstallmentValueFields);
    on(el.fgtsForm.elements[name], "change", renderFgtsInstallmentValueFields);
  });
  on(el.creditorForm, "submit", addCreditor);
  on(el.creditorForm.elements.logoFile, "change", handleCreditorLogoUpload);
  on(el.newCreditorButton, "click", () => openCreditorDialog());
  on(el.closeCreditorButton, "click", closeCreditorDialog);
  on(el.cardForm, "submit", saveCreditCard);
  on(el.cardForm.elements.creditorId, "change", updateCardLogoPreview);
  on(el.newCardButton, "click", () => openCardDialog());
  on(el.closeCardButton, "click", closeCardDialog);
  on(el.incomeForm, "submit", saveRecurringIncome);
  on(el.incomeForm.elements.logoFile, "change", handleIncomeLogoUpload);
  on(el.newIncomeButton, "click", () => openIncomeDialog());
  on(el.closeIncomeButton, "click", closeIncomeDialog);
  on(el.addPlanButton, "click", () => openPlannedDialog());
  on(el.addMonthlyPlanButton, "click", () => openPlannedDialog());
  on(el.closeMonthButton, "click", closeMonth);
  on(el.prevControlMonthButton, "click", () => navigateControlMonth(-1));
  on(el.nextControlMonthButton, "click", () => navigateControlMonth(1));
  on(el.closePlanButton, "click", closePlannedDialog);
  on(el.plannedForm, "submit", addPlannedPurchase);
  on(document.querySelector("#plannedKindExpense"), "click", () => {
    el.plannedForm.elements.kind.value = "expense";
    updatePlannedFields();
  });
  on(document.querySelector("#plannedKindIncome"), "click", () => {
    el.plannedForm.elements.kind.value = "income";
    updatePlannedFields();
  });
  on(el.fixedCostAmountForm, "submit", saveFixedCostAmount);
  on(el.closeFixedCostAmountButton, "click", () => closeDialog(el.fixedCostAmountDialog));
  on(el.incomeExceptionForm, "submit", saveIncomeException);
  on(el.closeIncomeExceptionButton, "click", closeIncomeExceptionDialog);
  on(document.querySelector("#openTaxTablesButton"), "click", () => document.querySelector("#taxTablesDialog")?.showModal());
  on(document.querySelector("#closeTaxTablesButton"), "click", () => document.querySelector("#taxTablesDialog")?.close());
  bindFeriasEvents();
  on(window, "offline", () => updateSync("Offline", "Alteracoes ficam salvas neste dispositivo.", "offline"));
  on(window, "online", () => {
    if (state.firebaseReady) updateSync("Reconectando", "Verificando dados na nuvem.", "syncing");
  });
  // Label select → atualiza campos condicionais e faixa líquido
  on(document.querySelector("#incomeLabelSelect"), "change", toggleIncomeCltFields);
  // Botão "Trocar" → abre file input oculto
  on(document.querySelector("#incomeTrocarBtn"), "click", () => {
    el.incomeForm.elements.logoFile?.click();
  });
  // Campos CLT → atualiza faixa líquido em tempo real
  on(el.incomeForm.elements.amount, "input", toggleIncomeCltFields);
  on(el.incomeForm.elements.cltAlimentacao, "input", toggleIncomeCltFields);
  on(el.incomeForm.elements.cltConsignado, "input", toggleIncomeCltFields);
  on(el.projectionTopScroll, "scroll", () => {
    el.projectionScroll.scrollLeft = el.projectionTopScroll.scrollLeft;
  });
  on(el.projectionScroll, "scroll", () => {
    el.projectionTopScroll.scrollLeft = el.projectionScroll.scrollLeft;
  });
  // Mobile bottom nav
  document.querySelectorAll(".bottom-tab[data-view]").forEach((btn) => {
    on(btn, "click", () => showView(btn.dataset.view));
  });
  const maisBtn = document.getElementById("maisButton");
  const maisDrawer = document.getElementById("maisDrawer");
  const maisOverlay = document.getElementById("maisOverlay");
  if (maisBtn && maisDrawer && maisOverlay) {
    on(maisBtn, "click", () => {
      const opening = !maisDrawer.classList.contains("open");
      maisDrawer.classList.toggle("open", opening);
      maisOverlay.classList.toggle("open", opening);
    });
    on(maisOverlay, "click", () => {
      closeMoreDrawer(maisDrawer, maisOverlay);
    });
    document.querySelectorAll(".mais-item[data-view]").forEach((btn) => {
      on(btn, "click", () => {
        showView(btn.dataset.view);
        closeMoreDrawer(maisDrawer, maisOverlay);
      });
    });
    on(document.getElementById("maisExportBtn"), "click", () => {
      el.exportButton.click();
      closeMoreDrawer(maisDrawer, maisOverlay);
    });
    on(document.getElementById("maisImportBtn"), "click", () => {
      el.importInput.click();
      closeMoreDrawer(maisDrawer, maisOverlay);
    });

  }
}

function on(target, eventName, handler) {
  target?.addEventListener(eventName, handler);
}

function closeDialog(dialog) {
  dialog?.close();
}

function closeMoreDrawer(drawer, overlay) {
  drawer.classList.remove("open");
  overlay.classList.remove("open");
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
  const bottomPrimary = ["planejamento", "controle", "divdashboard", "divrota"];
  document.querySelectorAll(".bottom-tab[data-view]").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === name);
  });
  const maisBtn = document.getElementById("maisButton");
  if (maisBtn) maisBtn.classList.toggle("active", !bottomPrimary.includes(name));
  renderView(name);
  refreshIcons();
}
window.showView = showView;

function renderAll() {
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

function renderCurrentView() {
  const activeView = document.querySelector(".view.active");
  renderView(activeView?.id?.replace(/View$/, "") || "planejamento");
}

function renderView(name) {
  const renderers = {
    planejamento: renderProjection,
    controle: renderMonthlyControl,
    parcelas: renderInstallments,
    custos: renderFixedCosts,
    carro: renderCar,
    fgts: renderFgts,
    ferias: renderFerias,
    ajustes() {
      renderOrigins();
      renderCreditCards();
      renderRecurringIncomes();
      renderSettings();
      renderTaxTables();
    }
  };
  renderers[name]?.();
  bindMoneyInputs();
  refreshIcons();
}
