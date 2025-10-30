"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface RepaymentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Loan {
  loan_id: string;
  amount: number;
  created_date: string;
  note: string | null;
  tenant: {
    user_id: string;
    name: string;
    nick_name: string | null;
  };
  has_schedule: boolean;
}

interface Preview {
  installment_number: number;
  due_date: string;
  amount: number;
}

export default function RepaymentScheduleModal({
  isOpen,
  onClose,
  onSuccess,
}: RepaymentScheduleModalProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<
    "month_start" | "month_end" | "specific_date" | "installment"
  >("month_start");
  const [specificDate, setSpecificDate] = useState<number>(15);
  const [specificDateMonth, setSpecificDateMonth] = useState<string>("");
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentStartDate, setInstallmentStartDate] = useState<string>("");
  const [installmentPeriodDays, setInstallmentPeriodDays] =
    useState<number>(30);
  const [installmentPeriodDaysInput, setInstallmentPeriodDaysInput] =
    useState<string>("30");
  const [preview, setPreview] = useState<Preview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Fetch loans when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLoans();
      // Initialize specificDateMonth and installmentStartDate
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const monthString = `${nextMonth.getFullYear()}-${String(
        nextMonth.getMonth() + 1
      ).padStart(2, "0")}`;
      setSpecificDateMonth(monthString);
      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setInstallmentStartDate(todayString);
    }
  }, [isOpen]);

  // Auto-adjust day when month changes if selected day is in the past
  useEffect(() => {
    if (specificDateMonth) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [year, month] = specificDateMonth.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, specificDate);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        const currentMonthString = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}`;
        if (specificDateMonth === currentMonthString) {
          setSpecificDate(today.getDate());
        } else {
          setSpecificDate(1);
        }
      }
    }
  }, [specificDateMonth, specificDate]);

  const fetchLoans = async () => {
    try {
      const data = await api.getLoansForSchedule();
      setLoans(data.loans || []);
    } catch (err) {
      console.error("Error fetching loans:", err);
      setError("Failed to load loans");
    }
  };

  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const calculatePreview = useCallback(() => {
    const loan = loans.find((l) => l.loan_id === selectedLoanId);
    if (!loan) {
      setPreview([]);
      return;
    }

    const totalAmount = loan.amount;
    const today = new Date();
    let previews: Preview[] = [];

    if (scheduleType === "month_start") {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      previews = [
        {
          installment_number: 1,
          due_date: formatDate(nextMonth),
          amount: totalAmount,
        },
      ];
    } else if (scheduleType === "month_end") {
      const thisMonthEnd = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      );
      let dueDate: Date;
      if (today.getDate() === thisMonthEnd.getDate()) {
        dueDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      } else {
        dueDate = thisMonthEnd;
      }
      previews = [
        {
          installment_number: 1,
          due_date: formatDate(dueDate),
          amount: totalAmount,
        },
      ];
    } else if (scheduleType === "specific_date") {
      if (!specificDateMonth) {
        setPreview([]);
        return;
      }
      const [year, month] = specificDateMonth.split("-").map(Number);
      const dueDate = new Date(year, month - 1, specificDate);
      const lastDay = new Date(year, month, 0).getDate();
      if (specificDate > lastDay) {
        dueDate.setDate(lastDay);
      }
      previews = [
        {
          installment_number: 1,
          due_date: formatDate(dueDate),
          amount: totalAmount,
        },
      ];
    } else if (scheduleType === "installment") {
      if (!installmentStartDate) {
        setPreview([]);
        return;
      }
      const [year, month, day] = installmentStartDate.split("-").map(Number);
      const start = new Date(year, month - 1, day);
      // Total period is from start to final payment inclusive of end
      const totalDays = Math.max(1, installmentPeriodDays);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + (totalDays - 1));

      const baseAmount = Math.floor(totalAmount / installmentCount);
      const remainder = totalAmount - baseAmount * installmentCount;
      const intervalDays =
        installmentCount === 1
          ? 0
          : Math.floor((totalDays * (installmentCount - 1)) / installmentCount);

      for (let i = installmentCount - 1; i >= 0; i--) {
        const daysFromEnd = i * intervalDays;
        const dueDate = new Date(endDate);
        dueDate.setDate(dueDate.getDate() - daysFromEnd);
        const amount =
          i === installmentCount - 1 ? baseAmount + remainder : baseAmount;
        previews.unshift({
          installment_number: installmentCount - i,
          due_date: formatDate(dueDate),
          amount,
        });
      }
    }

    setPreview(previews);
  }, [
    selectedLoanId,
    scheduleType,
    specificDate,
    specificDateMonth,
    installmentCount,
    installmentStartDate,
    installmentPeriodDays,
    loans,
  ]);

  // Update preview when inputs change
  useEffect(() => {
    if (selectedLoanId) {
      calculatePreview();
    } else {
      setPreview([]);
    }
  }, [selectedLoanId, calculatePreview]);

  const handleCreate = async () => {
    if (!selectedLoanId) {
      setError("Please select a loan");
      return;
    }

    // Validate date is not in the past for specific_date
    if (scheduleType === "specific_date") {
      if (!specificDateMonth) {
        setError("Please select a month and day");
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [year, month] = specificDateMonth.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, specificDate);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        setError("Cannot select a date in the past");
        return;
      }
    }

    // Validate installment requirements
    if (scheduleType === "installment") {
      if (!installmentStartDate) {
        setError("Please select a start date");
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [year, month, day] = installmentStartDate.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        setError("Cannot select a date in the past");
        return;
      }
      if (installmentCount < 2) {
        setError("Installment count must be at least 2");
        return;
      }
      if (installmentPeriodDays < 1 || installmentPeriodDays > 365) {
        setError("Payment period must be between 1 and 365 days");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      await api.createRepaymentSchedule({
        loan_id: selectedLoanId,
        schedule_type: scheduleType,
        specific_month:
          scheduleType === "specific_date" ? specificDateMonth : undefined,
        specific_date:
          scheduleType === "specific_date" ? specificDate : undefined,
        installment_count:
          scheduleType === "installment" ? installmentCount : undefined,
        installment_start_date:
          scheduleType === "installment" ? installmentStartDate : undefined,
        installment_period_days:
          scheduleType === "installment" ? installmentPeriodDays : undefined,
      });

      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Error creating schedule:", err);
      setError("Failed to create repayment schedule");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedLoanId("");
    setScheduleType("month_start");
    setSpecificDate(15);
    setSpecificDateMonth("");
    setInstallmentCount(2);
    setInstallmentStartDate("");
    setInstallmentPeriodDays(30);
    setPreview([]);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  const selectedLoan = loans.find((l) => l.loan_id === selectedLoanId);
  const todayString = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Create Repayment Schedule
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Loan Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loan:
              </label>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Loan</option>
                {loans.map((loan) => (
                  <option
                    key={loan.loan_id}
                    value={loan.loan_id}
                    disabled={loan.has_schedule}
                    className={loan.has_schedule ? "text-gray-400 italic" : ""}
                  >
                    {loan.tenant.nick_name || loan.tenant.name} - $
                    {loan.amount.toLocaleString()}
                    {loan.has_schedule ? " (Already scheduled)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Repayment Plan */}
            {selectedLoan && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repayment Plan:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="month_start"
                        checked={scheduleType === "month_start"}
                        onChange={(e) =>
                          setScheduleType(e.target.value as typeof scheduleType)
                        }
                        className="mr-2"
                      />
                      <span>Month Start (Next month 1st)</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="month_end"
                        checked={scheduleType === "month_end"}
                        onChange={(e) =>
                          setScheduleType(e.target.value as typeof scheduleType)
                        }
                        className="mr-2"
                      />
                      <span>Month End (This/Next month end)</span>
                    </label>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="specific_date"
                          checked={scheduleType === "specific_date"}
                          onChange={(e) =>
                            setScheduleType(
                              e.target.value as typeof scheduleType
                            )
                          }
                          className="mr-2"
                        />
                        <span>Specific Date</span>
                      </label>
                      {scheduleType === "specific_date" && (
                        <div className="ml-6 mt-2 space-y-2">
                          <div>
                            <label className="text-sm text-gray-600">
                              Month:
                            </label>
                            <input
                              type="month"
                              value={specificDateMonth}
                              onChange={(e) =>
                                setSpecificDateMonth(e.target.value)
                              }
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                              min={new Date().toISOString().slice(0, 7)}
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Day:
                            </label>
                            <select
                              value={specificDate}
                              onChange={(e) =>
                                setSpecificDate(parseInt(e.target.value))
                              }
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(
                                (day) => {
                                  const suffix =
                                    day === 1 || day === 21 || day === 31
                                      ? "st"
                                      : day === 2 || day === 22
                                      ? "nd"
                                      : day === 3 || day === 23
                                      ? "rd"
                                      : "th";
                                  const today = new Date();
                                  const isDisabled = (() => {
                                    if (!specificDateMonth) return false;
                                    const [year, month] = specificDateMonth
                                      .split("-")
                                      .map(Number);
                                    const selectedDate = new Date(
                                      year,
                                      month - 1,
                                      day
                                    );
                                    selectedDate.setHours(0, 0, 0, 0);
                                    today.setHours(0, 0, 0, 0);
                                    return selectedDate < today;
                                  })();
                                  return (
                                    <option
                                      key={day}
                                      value={day}
                                      disabled={isDisabled}
                                    >
                                      {day}
                                      {suffix}
                                      {isDisabled ? " (past)" : ""}
                                    </option>
                                  );
                                }
                              )}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="installment"
                          checked={scheduleType === "installment"}
                          onChange={(e) =>
                            setScheduleType(
                              e.target.value as typeof scheduleType
                            )
                          }
                          className="mr-2"
                        />
                        <span>Installment</span>
                      </label>
                      {scheduleType === "installment" && (
                        <div className="ml-6 mt-2 space-y-2">
                          <div>
                            <label className="text-sm text-gray-600">
                              Select Start Date:
                            </label>
                            <input
                              type="date"
                              value={installmentStartDate}
                              onChange={(e) =>
                                setInstallmentStartDate(e.target.value)
                              }
                              min={todayString}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Count:
                            </label>
                            <select
                              value={installmentCount}
                              onChange={(e) =>
                                setInstallmentCount(parseInt(e.target.value))
                              }
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                            >
                              {Array.from({ length: 9 }, (_, i) => i + 2).map(
                                (count) => (
                                  <option key={count} value={count}>
                                    {count} installments
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Payment Period (Days):
                            </label>
                            <input
                              type="number"
                              value={installmentPeriodDaysInput}
                              onChange={(e) => {
                                const v = e.target.value;
                                setInstallmentPeriodDaysInput(v);
                                const n = parseInt(v, 10);
                                if (!Number.isNaN(n)) {
                                  const clamped = Math.min(365, Math.max(1, n));
                                  setInstallmentPeriodDays(clamped);
                                }
                              }}
                              onBlur={() => {
                                const n = parseInt(
                                  installmentPeriodDaysInput,
                                  10
                                );
                                if (Number.isNaN(n)) {
                                  setInstallmentPeriodDaysInput(
                                    String(installmentPeriodDays)
                                  );
                                } else {
                                  const clamped = Math.min(365, Math.max(1, n));
                                  setInstallmentPeriodDays(clamped);
                                  setInstallmentPeriodDaysInput(
                                    String(clamped)
                                  );
                                }
                              }}
                              min={1}
                              max={365}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Number of days from start date to final payment
                              (1-365)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {preview.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <h3 className="font-semibold mb-2">Preview:</h3>
                    <div className="space-y-1 text-sm">
                      {preview.map((p) => {
                        const [year, month, day] = p.due_date.split("-");
                        const displayDate = `${month}/${day}/${year}`;
                        return (
                          <div
                            key={p.installment_number}
                            className="flex justify-between"
                          >
                            <span>
                              {preview.length > 1
                                ? `Installment ${p.installment_number}: `
                                : ""}
                              {displayDate}
                            </span>
                            <span className="font-semibold">
                              ${p.amount.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-gray-300 flex justify-between font-bold">
                        <span>Total:</span>
                        <span>
                          $
                          {preview
                            .reduce((sum, p) => sum + p.amount, 0)
                            .toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={
                !selectedLoanId ||
                isLoading ||
                (scheduleType === "installment" && !installmentStartDate) ||
                (scheduleType === "specific_date" && !specificDateMonth)
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
