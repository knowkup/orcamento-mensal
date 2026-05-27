import { state } from "./state.js";

const FALLBACK_TAXES = {
  inss: [
    { upTo: 1621.00, rate: 7.5 },
    { upTo: 2902.84, rate: 9 },
    { upTo: 4354.27, rate: 12 },
    { upTo: 8475.55, rate: 14 }
  ],
  irrf: {
    simplifiedDeduction: 2571.20,
    brackets: [
      { upTo: 2428.80, rate: 0, deduction: 0 },
      { upTo: 2826.65, rate: 7.5, deduction: 182.16 },
      { upTo: 3751.05, rate: 15, deduction: 394.16 },
      { upTo: 4664.68, rate: 22.5, deduction: 675.49 },
      { upTo: null, rate: 27.5, deduction: 908.73 }
    ]
  }
};

function currentTaxes() {
  return state.data.taxes ?? FALLBACK_TAXES;
}

export function calcInss(gross) {
  const brackets = currentTaxes().inss ?? FALLBACK_TAXES.inss;
  let total = 0, prev = 0;
  for (const b of brackets) {
    if (gross <= prev) break;
    const slice = Math.min(gross, b.upTo) - prev;
    total += slice * (b.rate / 100);
    prev = b.upTo;
    if (gross <= b.upTo) break;
  }
  return Math.round(total * 100) / 100;
}

export function calcIrrf(gross, inss) {
  const cfg = currentTaxes().irrf ?? FALLBACK_TAXES.irrf;
  const simplDeduction = Number(cfg.simplifiedDeduction ?? 2571.20);
  const brackets = cfg.brackets ?? FALLBACK_TAXES.irrf.brackets;
  const taxable = gross - inss - simplDeduction;
  if (taxable <= 0) return 0;
  for (const b of brackets) {
    if (b.upTo === null || taxable <= Number(b.upTo)) {
      return Math.max(0, Math.round((taxable * (Number(b.rate) / 100) - Number(b.deduction || 0)) * 100) / 100);
    }
  }
  return 0;
}

export function calcNetClt(gross, consignado, alimentacaoPercent) {
  const inss = calcInss(gross);
  const irrf = calcIrrf(gross, inss);
  const alimentacao = Math.round(gross * ((alimentacaoPercent ?? 1) / 100) * 100) / 100;
  const total = Math.round((inss + irrf + alimentacao + Number(consignado || 0)) * 100) / 100;
  return Math.round((gross - total) * 100) / 100;
}
