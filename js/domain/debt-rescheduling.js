function monthKey(value) {
  return String(value || "").slice(0, 7);
}

export function firstOpenMonth(closedMonths = [], startMonth = "") {
  const closed = new Set(closedMonths || []);
  const [year, month] = monthKey(startMonth).split("-").map(Number);
  if (!year || !month) return "";
  const date = new Date(year, month - 1, 1);
  while (closed.has(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)) {
    date.setMonth(date.getMonth() + 1);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function dueDateInMonth(originalDueDate, targetMonth) {
  const [year, month] = monthKey(targetMonth).split("-").map(Number);
  const day = Number(String(originalDueDate || "").slice(8, 10)) || 1;
  if (!year || !month) return "";
  const lastDay = new Date(year, month, 0).getDate();
  return `${targetMonth}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function rescheduleInstallment(installment, targetMonth, closedMonths = [], minimumMonth = "") {
  if (!installment || installment.status !== "Pendente") throw new Error("Apenas parcelas pendentes podem ser reagendadas.");
  const target = monthKey(targetMonth);
  const originalDueDate = installment.originalDueDate || installment.dueDate;
  if (!target || !originalDueDate) throw new Error("Informe o mês de pagamento.");
  if ((closedMonths || []).includes(target)) throw new Error("Escolha um mês que ainda esteja aberto.");
  if (minimumMonth && target < minimumMonth) throw new Error("Escolha o próximo mês aberto ou um mês posterior.");

  return {
    dueDate: dueDateInMonth(originalDueDate, target),
    originalDueDate,
    rescheduledToMonth: target
  };
}
