export const DEFAULT_TAXES = {
  inss: [
    { upTo: 1621.00, rate: 7.5 },
    { upTo: 2902.84, rate: 9 },
    { upTo: 4354.27, rate: 12 },
    { upTo: 8475.55, rate: 14 }
  ],
  irrf: {
    exemptionLimit: 5000,
    partialLimit: 7350,
    brackets: [
      { upTo: 2428.80, rate: 0, deduction: 0 },
      { upTo: 2826.65, rate: 7.5, deduction: 182.16 },
      { upTo: 3751.05, rate: 15, deduction: 394.16 },
      { upTo: 4664.68, rate: 22.5, deduction: 675.49 },
      { upTo: null, rate: 27.5, deduction: 908.73 }
    ]
  }
};

export function calculateInss(gross, taxes = DEFAULT_TAXES) {
  const brackets = taxes.inss ?? DEFAULT_TAXES.inss;
  let total = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    if (gross <= previousLimit) break;
    const slice = Math.min(gross, bracket.upTo) - previousLimit;
    total += slice * (bracket.rate / 100);
    previousLimit = bracket.upTo;
    if (gross <= bracket.upTo) break;
  }

  return Math.round(total * 100) / 100;
}

export function calculateIrrf(gross, inss, taxes = DEFAULT_TAXES) {
  const config = taxes.irrf ?? DEFAULT_TAXES.irrf;
  const exemptionLimit = Number(config.exemptionLimit ?? 5000);
  const partialLimit = Number(config.partialLimit ?? 7350);
  const brackets = config.brackets ?? DEFAULT_TAXES.irrf.brackets;

  if (gross <= exemptionLimit) return 0;

  const taxable = gross - inss;
  if (taxable <= 0) return 0;

  let irrf = 0;
  for (const bracket of brackets) {
    if (bracket.upTo === null || taxable <= Number(bracket.upTo)) {
      irrf = Math.max(0, taxable * (Number(bracket.rate) / 100) - Number(bracket.deduction || 0));
      break;
    }
  }

  if (gross <= partialLimit && partialLimit > exemptionLimit) {
    irrf = irrf * (gross - exemptionLimit) / (partialLimit - exemptionLimit);
  }

  return Math.round(irrf * 100) / 100;
}

export function calculateNetClt(gross, consignado, alimentacaoPercent, taxes = DEFAULT_TAXES) {
  const inss = calculateInss(gross, taxes);
  const irrf = calculateIrrf(gross, inss, taxes);
  const alimentacao = Math.round(gross * ((alimentacaoPercent ?? 1) / 100));
  const total = Math.round((inss + irrf + alimentacao + Number(consignado || 0)) * 100) / 100;
  return Math.round((gross - total) * 100) / 100;
}
