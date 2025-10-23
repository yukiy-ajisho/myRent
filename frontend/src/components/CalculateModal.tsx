"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Property {
  property_id: string;
  name: string;
  timezone: string;
  active: boolean;
}

interface CalculationResult {
  bill_run_id: string;
  lines_created: number;
  ledger_records_created: number;
  totals: {
    rent: number;
    utilities: number;
    grand_total: number;
  };
  user_days: Record<string, number>;
  headcount: number;
  total_person_days: number;
}

interface BillLine {
  bill_line_id: string;
  user_id: string;
  utility: string;
  amount: number;
  bill_run_id: string;
  app_user: {
    name: string;
  };
  bill_run: {
    month_start: string;
  };
}

interface UtilityActual {
  actual_id: string;
  property_id: string;
  month_start: string;
  utility: string;
  amount: number;
}

const UTILITIES = ["electricity", "gas", "water", "internet", "garbage"];

interface CalculateModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculateModal({
  property,
  isOpen,
  onClose,
}: CalculateModalProps) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [message, setMessage] = useState("");
  const [calculationResult, setCalculationResult] =
    useState<CalculationResult | null>(null);
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [utilityAmounts, setUtilityAmounts] = useState<Record<string, string>>(
    {}
  );
  const [saveStatus, setSaveStatus] = useState<
    Record<string, "saving" | "saved" | "error">
  >({});
  const [debounceTimers, setDebounceTimers] = useState<
    Record<string, NodeJS.Timeout>
  >({});

  const getNextMonth = useCallback((monthString: string) => {
    // monthString is already in YYYY-MM-DD format, so we can use it directly
    console.log("getNextMonth input:", monthString);

    // Parse the date string to avoid timezone issues
    const [year, month] = monthString.split("-").map(Number);
    console.log("getNextMonth parsed year:", year, "month:", month);

    // Create date object using local timezone
    const date = new Date(year, month - 1, 1); // month is 0-indexed
    console.log("getNextMonth parsed date:", date);

    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    console.log("getNextMonth next month:", nextMonth);
    const result = nextMonth.toISOString().slice(0, 7); // YYYY-MM format
    console.log("getNextMonth result:", result);
    return result;
  }, []);

  const loadLatestMonth = useCallback(
    async (propertyId: string) => {
      try {
        const data = await api.getLatestBillRunMonth(propertyId);
        if (data.latestMonth) {
          // 次の月を計算
          const nextMonth = getNextMonth(data.latestMonth);
          setSelectedMonth(nextMonth);
        } else {
          // レコードがない場合は現在月
          const now = new Date();
          setSelectedMonth(now.toISOString().slice(0, 7));
        }
      } catch (error) {
        console.error("Error loading latest month:", error);
        // エラー時は現在月
        const now = new Date();
        setSelectedMonth(now.toISOString().slice(0, 7));
      }
    },
    [getNextMonth]
  );

  // Initialize with next month after latest bill run
  useEffect(() => {
    if (property && isOpen) {
      loadLatestMonth(property.property_id);
    }
  }, [property, isOpen, loadLatestMonth]);

  const loadBillLines = useCallback(
    async (propertyId: string) => {
      try {
        setIsLoading(true);
        setMessage("");

        const data = await api.getBillLineData(propertyId);
        console.log("Bill lines data:", data);

        // Filter by selected month
        const filteredBillLines = data.billLines.filter((line: BillLine) => {
          const lineMonth = line.bill_run.month_start.slice(0, 7); // YYYY-MM format
          return lineMonth === selectedMonth;
        });

        setBillLines(filteredBillLines);
      } catch (error) {
        console.error("Error loading bill lines:", error);
        setMessage("Error loading bill data");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedMonth]
  );

  const loadUtilityActuals = useCallback(
    async (propertyId: string) => {
      try {
        const data = await api.getBootstrap(propertyId, selectedMonth + "-01");
        const utilityActuals = data.utilityActuals || [];

        // Initialize utility amounts from existing data
        const amounts: Record<string, string> = {};
        utilityActuals.forEach((actual: UtilityActual) => {
          amounts[actual.utility] = actual.amount.toString();
        });
        setUtilityAmounts(amounts);
      } catch (error) {
        console.error("Error loading utility actuals:", error);
      }
    },
    [selectedMonth]
  );

  useEffect(() => {
    if (property && selectedMonth) {
      loadBillLines(property.property_id);
      loadUtilityActuals(property.property_id);
    }
  }, [property, selectedMonth, loadBillLines, loadUtilityActuals]);

  // クリーンアップ処理
  useEffect(() => {
    return () => {
      Object.values(debounceTimers).forEach((timer) => clearTimeout(timer));
    };
  }, [debounceTimers]);

  // Input validation functions
  const validateUtilityAmount = (amount: string): boolean => {
    if (!amount || amount.trim() === "") return true; // Empty is allowed
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0 && num <= 999999; // 上限設定
  };

  const validateMonth = (month: string): boolean => {
    if (!month) return false;
    const selectedDate = new Date(month + "-01");
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return selectedDate <= currentMonth; // 未来の月は選択不可
  };

  // デバウンス付きの保存関数
  const debouncedSaveUtility = (utility: string, amount: string) => {
    // 既存のタイマーをクリア
    if (debounceTimers[utility]) {
      clearTimeout(debounceTimers[utility]);
    }

    // 新しいタイマーを設定（500ms後）
    const timer = setTimeout(async () => {
      await saveSingleUtility(utility, amount);
    }, 500);

    setDebounceTimers((prev) => ({ ...prev, [utility]: timer }));
  };

  // 単一のutilityを保存する関数
  const saveSingleUtility = async (utility: string, amount: string) => {
    if (!property || !selectedMonth) return;

    setSaveStatus((prev) => ({ ...prev, [utility]: "saving" }));

    try {
      if (amount && amount.trim() !== "") {
        await api.saveUtilityActual({
          property_id: property.property_id,
          month_start: `${selectedMonth}-01`,
          utility,
          amount: parseFloat(amount),
        });
        setSaveStatus((prev) => ({ ...prev, [utility]: "saved" }));
      }
    } catch (error) {
      console.error(`Error saving ${utility}:`, error);
      setSaveStatus((prev) => ({ ...prev, [utility]: "error" }));
    }
  };

  const handleCalculate = async () => {
    if (!property || !selectedMonth) {
      setMessage("Please select property and month");
      return;
    }

    // Validate month (prevent future month calculations)
    if (!validateMonth(selectedMonth)) {
      setMessage("Cannot calculate bills for future months");
      return;
    }

    // Validate utility amounts
    const invalidUtilities: string[] = [];
    for (const [utility, amount] of Object.entries(utilityAmounts)) {
      if (amount && amount.trim() !== "" && !validateUtilityAmount(amount)) {
        invalidUtilities.push(utility);
      }
    }

    if (invalidUtilities.length > 0) {
      setMessage(
        `Invalid amounts for utilities: ${invalidUtilities.join(
          ", "
        )}. Please enter values between 0 and 999,999.`
      );
      return;
    }

    try {
      setIsCalculating(true);
      setMessage("");
      setCalculationResult(null); // Clear previous results

      console.log("=== CALCULATION DEBUG ===");
      console.log("Property ID:", property.property_id);
      console.log("Month:", selectedMonth);

      // Save utility amounts before calculation
      for (const [utility, amount] of Object.entries(utilityAmounts)) {
        if (amount && amount.trim() !== "") {
          await api.saveUtilityActual({
            property_id: property.property_id,
            month_start: `${selectedMonth}-01`,
            utility,
            amount: parseFloat(amount),
          });
        }
      }

      const result = await api.runBillCalculation({
        propertyId: property.property_id,
        monthStart: `${selectedMonth}-01`, // Convert YYYY-MM to YYYY-MM-DD
      });

      console.log("Calculation result:", result);
      setCalculationResult(result);
      setMessage(
        `Calculation completed! Created ${result.lines_created} bill lines and ${result.ledger_records_created} ledger records.`
      );

      // Reload bill lines to show new results
      await loadBillLines(property.property_id);
    } catch (error) {
      console.error("Error running calculation:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Owner access required")) {
        setMessage("Error: Owner access required for bill calculation");
      } else if (errorMessage.includes("Access denied")) {
        setMessage("Error: Access denied to this property");
      } else if (errorMessage.includes("already completed")) {
        setMessage("Error: Bill calculation already completed for this month");
      } else {
        setMessage("Error running calculation");
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatMonth = (monthString: string) => {
    const date = new Date(monthString + "-01");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  // 保存状態表示用のアイコンコンポーネント
  const Spinner = () => (
    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
  );
  const CheckIcon = () => <div className="text-green-500">✓</div>;
  const ErrorIcon = () => <div className="text-red-500">✗</div>;

  // Group bill lines by user
  const groupedBillLines = billLines.reduce((acc, line) => {
    const userId = line.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        user: line.app_user,
        lines: [],
        total: 0,
      };
    }
    acc[userId].lines.push(line);
    acc[userId].total += line.amount;
    return acc;
  }, {} as Record<string, { user: { name: string }; lines: BillLine[]; total: number }>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Calculate Bills for {property.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Month Selection and Calculate Button */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Real-time validation feedback
                    if (value && !validateMonth(value)) {
                      e.target.setCustomValidity("Cannot select future months");
                    } else {
                      e.target.setCustomValidity("");
                    }
                    setSelectedMonth(value);
                  }}
                  className={`px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    selectedMonth && !validateMonth(selectedMonth)
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300"
                  }`}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating || !selectedMonth}
                  className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {isCalculating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                      Calculating...
                    </>
                  ) : (
                    "Calculate Bills"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Utilities Input Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Utility Amounts
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                      Utility
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Amount ($)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {UTILITIES.map((utility) => (
                    <tr key={utility}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize border-r">
                        {utility}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="999999"
                            value={utilityAmounts[utility] || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Real-time validation feedback
                              if (value && !validateUtilityAmount(value)) {
                                e.target.setCustomValidity(
                                  "Please enter a value between 0 and 999,999"
                                );
                              } else {
                                e.target.setCustomValidity("");
                              }
                              setUtilityAmounts((prev) => ({
                                ...prev,
                                [utility]: value,
                              }));

                              // デバウンス付き保存
                              debouncedSaveUtility(utility, value);
                            }}
                            placeholder="Enter amount"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              utilityAmounts[utility] &&
                              !validateUtilityAmount(utilityAmounts[utility])
                                ? "border-red-300 bg-red-50"
                                : "border-gray-300"
                            }`}
                          />
                          <div className="ml-2">
                            {saveStatus[utility] === "saving" && <Spinner />}
                            {saveStatus[utility] === "saved" && <CheckIcon />}
                            {saveStatus[utility] === "error" && <ErrorIcon />}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Enter the actual utility costs for the selected month. These
              amounts will be used for bill calculations.
              <br />
              <span className="text-red-600 font-medium">
                Note: Values must be between 0 and 999,999. Future months cannot
                be calculated.
              </span>
            </p>
          </div>

          {selectedMonth && (
            <p className="text-sm text-gray-600">
              Calculating bills for{" "}
              <strong>{formatMonth(selectedMonth)}</strong>
            </p>
          )}

          {/* Calculation Results */}
          {calculationResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-green-800 mb-4">
                Calculation Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {calculationResult.lines_created}
                  </div>
                  <div className="text-sm text-green-600">Bill Lines</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {calculationResult.headcount}
                  </div>
                  <div className="text-sm text-green-600">Active Tenants</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {calculationResult.total_person_days}
                  </div>
                  <div className="text-sm text-green-600">
                    Total Person Days
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {formatCurrency(calculationResult.totals.grand_total)}
                  </div>
                  <div className="text-sm text-green-600">Grand Total</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border">
                  <div className="text-sm text-gray-600">Rent Total</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(calculationResult.totals.rent)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="text-sm text-gray-600">Utilities Total</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(calculationResult.totals.utilities)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bill Lines Display */}
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2">Loading bill data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {billLines.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
                  <p className="text-gray-600 text-lg">
                    No bill data found for {formatMonth(selectedMonth)}.
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Click &quot;Calculate Bills&quot; to generate bills for this
                    month.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Bill Breakdown for {formatMonth(selectedMonth)}
                  </h2>

                  {Object.entries(groupedBillLines).map(
                    ([userId, userData]) => (
                      <div
                        key={userId}
                        className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {userData.user.name}
                          </h3>
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(userData.total)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {userData.lines.map((line) => (
                            <div
                              key={line.bill_line_id}
                              className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded"
                            >
                              <span className="text-sm text-gray-700">
                                {line.utility === "rent"
                                  ? "Monthly Rent"
                                  : line.utility}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {formatCurrency(line.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div
              className={`mt-4 p-4 rounded-md ${
                message.includes("Error")
                  ? "bg-red-50 border border-red-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <p
                className={
                  message.includes("Error") ? "text-red-800" : "text-green-800"
                }
              >
                {message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
