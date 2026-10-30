/**
 * Módulo de navegação centralizado.
 * Elimina as pontes window.showView e window.showDividasView.
 *
 * Uso:
 *   app.js: registerNavigation(showView)
 *   outros módulos: import { navigateTo } from "../navigation.js"
 */

import { state } from "./state.js";

let _showViewFn = null;

/** Registrado pelo app.js no boot, antes de qualquer navegação. */
export function registerNavigation(fn) {
  _showViewFn = fn;
}

/** Navega para uma view pelo nome (ex: "divrota", "controle"). */
export function navigateTo(viewName) {
  if (_showViewFn) {
    _showViewFn(viewName);
  } else {
    // Fallback mínimo caso o app ainda não tenha registrado (improvável em prod).
    console.warn(`[navigation] navigateTo("${viewName}") chamado antes de registerNavigation`);
    document.querySelectorAll('.nav-tab').forEach((tab) =>
      tab.classList.toggle('active', tab.dataset.view === viewName)
    );
    document.querySelectorAll('.view').forEach((view) => {
      const active = view.id === viewName + 'View';
      view.classList.toggle('active', active);
      if (active && view.dataset.title) {
        const title = document.querySelector('#viewTitle');
        if (title) title.textContent = view.dataset.title;
      }
    });
  }
}

export function setupQuickAccess(showView) {
  const group = document.querySelector("#quickAccessGroup");
  const items = document.querySelector("#quickAccessItems");
  if (!group || !items) return;

  const originalTabs = [...document.querySelectorAll(".nav-tab")];
  originalTabs.forEach((tab) => {
    if (tab.closest(".quick-access-group") || tab.parentElement?.classList.contains("nav-entry")) return;
    const entry = document.createElement("div");
    entry.className = "nav-entry";
    tab.parentNode.insertBefore(entry, tab);
    entry.append(tab);
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "nav-favorite";
    favorite.dataset.favoriteView = tab.dataset.view;
    favorite.title = "Adicionar ao acesso rápido";
    favorite.setAttribute("aria-label", `Adicionar ${tab.textContent.trim()} ao acesso rápido`);
    favorite.innerHTML = '<i data-lucide="star"></i>';
    entry.append(favorite);
  });

  const render = () => {
    const favorites = state.data.quickAccess || [];
    document.querySelectorAll(".nav-favorite").forEach((button) => {
      const selected = favorites.includes(button.dataset.favoriteView);
      button.classList.toggle("is-favorite", selected);
      button.title = selected ? "Remover do acesso rápido" : "Adicionar ao acesso rápido";
      button.setAttribute("aria-pressed", String(selected));
    });
    const source = new Map([...document.querySelectorAll(".nav-tab")]
      .filter((tab) => !tab.closest("#quickAccessGroup"))
      .map((tab) => [tab.dataset.view, tab]));
    items.innerHTML = "";
    favorites.forEach((view) => {
      const tab = source.get(view);
      if (!tab) return;
      const quick = tab.cloneNode(true);
      quick.classList.remove("active");
      quick.dataset.quickView = view;
      items.append(quick);
    });
    group.hidden = !items.children.length;
    document.querySelectorAll("#quickAccessItems .nav-tab").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.quickView));
    });
  };

  state.renderQuickAccessFn = render;

  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".nav-favorite");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const view = button.dataset.favoriteView;
    const favorites = state.data.quickAccess || [];
    state.data.quickAccess = favorites.includes(view)
      ? favorites.filter((item) => item !== view)
      : [...favorites, view];
    render();
    await state.saveStateFn?.("Acesso rápido atualizado.");
  });
  render();
}
