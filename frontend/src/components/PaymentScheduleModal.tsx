"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface PaymentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface BillRun {
  bill_run_id: number;
  month_start: string;
  property_id: number;
  property_name: string;
  tenants: Array<{
    user_id: string;
    name: string;
    nick_name: string | null;
    total_amount: number;
    has_schedule: boolean;
  }>;
}

interface Preview {
  installment_number: number;
  due_date: string;
  amount: number;
}

export default function PaymentScheduleModal({
  isOpen,
  onClose,
  onSuccess,
}: PaymentScheduleModalProps) {
  const [billRuns, setBillRuns] = useState<BillRun[]>([]);
  const [selectedBillRun, setSelectedBillRun] = useState<BillRun | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<
    "month_start" | "month_end" | "specific_date" | "installment"
  >("month_start");
  const [referenceDateType, setReferenceDateType] = useState<
    "today" | "specific_month"
  >("today");
  const [specificMonth, setSpecificMonth] = useState<string>("");
  const [specificDate, setSpecificDate] = useState<number>(15);
  const [specificDateMonth, setSpecificDateMonth] = useState<string>(""); // For "specific_date" schedule type
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [preview, setPreview] = useState<Preview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Fetch bill runs when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchBillRuns();
      // Initialize specificDateMonth and specificMonth to next month
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const monthString = `${nextMonth.getFullYear()}-${String(
        nextMonth.getMonth() + 1
      ).padStart(2, "0")}`;
      setSpecificDateMonth(monthString);
      setSpecificMonth(monthString);
    }
  }, [isOpen]);

  // Clear selected tenant if they already have a schedule for the new bill run
  useEffect(() => {
    if (selectedBillRun && selectedTenantId) {
      const selectedTenant = selectedBillRun.tenants.find(
        (t) => t.user_id === selectedTenantId
      );
      if (selectedTenant?.has_schedule) {
        setSelectedTenantId("");
      }
    }
  }, [selectedBillRun]);

  // Auto-adjust day when month changes if selected day is in the past
  useEffect(() => {
    if (specificDateMonth) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [year, month] = specificDateMonth.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, specificDate);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        // Set to today's date if we're in the current month
        const currentMonthString = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}`;
        if (specificDateMonth === currentMonthString) {
          setSpecificDate(today.getDate());
        } else {
          // Otherwise set to 1st of the selected month
          setSpecificDate(1);
        }
      }
    }
  }, [specificDateMonth]);

  const fetchBillRuns = async () => {
    try {
      const data = await api.getBillRunsForSchedule();
      setBillRuns(data.bill_runs || []);
    } catch (err) {
      console.error("Error fetching bill runs:", err);
      setError("Failed to load bill runs");
    }
  };

  // Update preview when inputs change
  useEffect(() => {
    if (selectedBillRun && selectedTenantId) {
      calculatePreview();
    } else {
      setPreview([]);
    }
  }, [
    selectedBillRun,
    selectedTenantId,
    scheduleType,
    referenceDateType,
    specificMonth,
    specificDate,
    specificDateMonth,
    installmentCount,
  ]);

  // Helper function to format date as YYYY-MM-DD (avoid timezone issues)
  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const calculatePreview = () => {
    const tenant = selectedBillRun?.tenants.find(
      (t) => t.user_id === selectedTenantId
    );
    if (!tenant) return;

    const totalAmount = tenant.total_amount;
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
      // Get last day of this month
      const thisMonthEnd = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      );

      let dueDate: Date;

      // If today is the last day of the month, use next month's last day
      if (today.getDate() === thisMonthEnd.getDate()) {
        dueDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      } else {
        // Use this month's end (we haven't passed it yet)
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
      if (!specificDateMonth) return;

      const [year, month] = specificDateMonth.split("-").map(Number);
      const dueDate = new Date(year, month - 1, specificDate);

      // Check if the selected day exceeds the month's last day
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
      let startDate: Date, endDate: Date;

      if (referenceDateType === "today") {
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30);
      } else {
        if (!specificMonth) return;
        const [year, month] = specificMonth.split("-").map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
      }

      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const baseAmount = Math.floor(totalAmount / installmentCount);
      const remainder = totalAmount - baseAmount * installmentCount;
      const intervalDays = Math.floor(totalDays / installmentCount);

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
  };

  const handleCreate = async () => {
    if (!selectedBillRun || !selectedTenantId) {
      setError("Please select bill run and tenant");
      return;
    }

    const tenant = selectedBillRun.tenants.find(
      (t) => t.user_id === selectedTenantId
    );
    if (!tenant) return;

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

    // Validate month is not current or past for installment with specific month
    if (
      scheduleType === "installment" &&
      referenceDateType === "specific_month"
    ) {
      if (!specificMonth) {
        setError("Please select a month");
        return;
      }
      const today = new Date();
      const [year, month] = specificMonth.split("-").map(Number);
      const selectedMonth = new Date(year, month - 1, 1);
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      if (selectedMonth <= currentMonth) {
        setError(
          "Please select a future month (use 'From Today' for current month)"
        );
        return;
      }
    }

    // Validate installment count is at least 2
    if (scheduleType === "installment" && installmentCount < 2) {
      setError("Installment count must be at least 2");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await api.createPaymentSchedule({
        bill_run_id: selectedBillRun.bill_run_id,
        tenant_user_id: selectedTenantId,
        property_id: selectedBillRun.property_id,
        total_amount: tenant.total_amount,
        schedule_type: scheduleType,
        reference_date_type:
          scheduleType === "installment" ? referenceDateType : undefined,
        specific_month:
          scheduleType === "installment" &&
          referenceDateType === "specific_month"
            ? specificMonth
            : scheduleType === "specific_date"
            ? specificDateMonth
            : undefined,
        specific_date:
          scheduleType === "specific_date" ? specificDate : undefined,
        installment_count:
          scheduleType === "installment" ? installmentCount : undefined,
      });

      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Error creating schedule:", err);
      setError("Failed to create payment schedule");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedBillRun(null);
    setSelectedTenantId("");
    setScheduleType("month_start");
    setReferenceDateType("today");
    setSpecificMonth("");
    setSpecificDate(15);
    setSpecificDateMonth("");
    setInstallmentCount(2);
    setPreview([]);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  const selectedTenant = selectedBillRun?.tenants.find(
    (t) => t.user_id === selectedTenantId
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Create Payment Schedule
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
            {/* Bill Run Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bill Run:
              </label>
              <select
                value={selectedBillRun?.bill_run_id || ""}
                onChange={(e) => {
                  const billRun = billRuns.find(
                    (br) => br.bill_run_id === parseInt(e.target.value)
                  );
                  setSelectedBillRun(billRun || null);
                  setSelectedTenantId("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Bill Run</option>
                {billRuns.map((br) => (
                  <option key={br.bill_run_id} value={br.bill_run_id}>
                    {br.month_start.substring(0, 7)} - {br.property_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tenant Selection */}
            {selectedBillRun && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant:
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Tenant</option>
                  {selectedBillRun.tenants.map((tenant) => (
                    <option
                      key={tenant.user_id}
                      value={tenant.user_id}
                      disabled={tenant.has_schedule}
                      className={
                        tenant.has_schedule ? "text-gray-400 italic" : ""
                      }
                    >
                      {tenant.nick_name || tenant.name} - $
                      {tenant.total_amount.toLocaleString()}
                      {tenant.has_schedule ? " (Already scheduled)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Plan */}
            {selectedTenant && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Plan:
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
                              min={new Date().toISOString().slice(0, 7)} // Current month as minimum
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

                                  // Disable past dates
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
                                    // Disable if the date is before today
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
                            <label className="flex items-center">
                              <input
                                type="radio"
                                value="today"
                                checked={referenceDateType === "today"}
                                onChange={(e) =>
                                  setReferenceDateType(
                                    e.target.value as typeof referenceDateType
                                  )
                                }
                                className="mr-2"
                              />
                              <span className="text-sm">
                                From Today (30 days)
                              </span>
                            </label>
                          </div>
                          <div>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                value="specific_month"
                                checked={referenceDateType === "specific_month"}
                                onChange={(e) =>
                                  setReferenceDateType(
                                    e.target.value as typeof referenceDateType
                                  )
                                }
                                className="mr-2"
                              />
                              <span className="text-sm">Specific Month</span>
                            </label>
                            {referenceDateType === "specific_month" && (
                              <input
                                type="month"
                                value={specificMonth}
                                onChange={(e) =>
                                  setSpecificMonth(e.target.value)
                                }
                                className="ml-6 mt-1 px-2 py-1 border border-gray-300 rounded"
                                min={(() => {
                                  const today = new Date();
                                  const nextMonth = new Date(
                                    today.getFullYear(),
                                    today.getMonth() + 1,
                                    1
                                  );
                                  return `${nextMonth.getFullYear()}-${String(
                                    nextMonth.getMonth() + 1
                                  ).padStart(2, "0")}`;
                                })()}
                              />
                            )}
                          </div>
                          <div className="mt-2">
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
                        // Parse date without timezone conversion
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
                !selectedBillRun ||
                !selectedTenantId ||
                isLoading ||
                (scheduleType === "installment" &&
                  referenceDateType === "specific_month" &&
                  !specificMonth)
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
