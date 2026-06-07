/**
 * Módulo de navegação centralizado.
 * Elimina as pontes window.showView e window.showDividasView.
 *
 * Uso:
 *   app.js: registerNavigation(showView)
 *   outros módulos: import { navigateTo } from "../navigation.js"
 */

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
