import test from "node:test";
import assert from "node:assert/strict";
import { dueDateInMonth, firstOpenMonth, rescheduleInstallment } from "../js/domain/debt-rescheduling.js";

test("finds the next month that is not closed", () => {
  assert.equal(firstOpenMonth(["2026-09"], "2026-09"), "2026-10");
  assert.equal(firstOpenMonth(["2026-09", "2026-10"], "2026-09"), "2026-11");
});

test("keeps the original due date while scheduling the installment in an open month", () => {
  assert.deepEqual(rescheduleInstallment(
    { id: "installment-1", status: "Pendente", dueDate: "2026-09-30" },
    "2026-10",
    ["2026-09"],
    "2026-10"
  ), {
    dueDate: "2026-10-30",
    originalDueDate: "2026-09-30",
    rescheduledToMonth: "2026-10"
  });
});

test("uses the last valid day when moving a due date into a shorter month", () => {
  assert.equal(dueDateInMonth("2026-01-31", "2026-02"), "2026-02-28");
});

test("does not allow a reschedule to a closed or earlier month", () => {
  const installment = { status: "Pendente", dueDate: "2026-09-09" };
  assert.throws(() => rescheduleInstallment(installment, "2026-09", ["2026-09"], "2026-10"));
  assert.throws(() => rescheduleInstallment(installment, "2026-08", [], "2026-10"));
});
