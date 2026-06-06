import { state } from "./state.js";
import { DEFAULT_TAXES, calculateInss, calculateIrrf, calculateNetClt } from "./domain/taxes.js";

function currentTaxes() {
  return state.data.taxes ?? DEFAULT_TAXES;
}

export function calcInss(gross) {
  return calculateInss(gross, currentTaxes());
}

export function calcIrrf(gross, inss) {
  return calculateIrrf(gross, inss, currentTaxes());
}

export function calcNetClt(gross, consignado, alimentacaoPercent) {
  return calculateNetClt(gross, consignado, alimentacaoPercent, currentTaxes());
}
