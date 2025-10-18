"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

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

export default function Calculate() {
  const { selectedProperty } = useProperty();
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

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM format
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (selectedProperty && selectedMonth) {
      loadBillLines(selectedProperty.property_id);
      loadUtilityActuals(selectedProperty.property_id);
    }
  }, [selectedProperty, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBillLines = async (propertyId: string) => {
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
  };

  const loadUtilityActuals = async (propertyId: string) => {
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
  };

  const handleCalculate = async () => {
    if (!selectedProperty || !selectedMonth) {
      setMessage("Please select property and month");
      return;
    }

    try {
      setIsCalculating(true);
      setMessage("");

      console.log("=== CALCULATION DEBUG ===");
      console.log("Property ID:", selectedProperty.property_id);
      console.log("Month:", selectedMonth);

      // Save utility amounts before calculation
      for (const [utility, amount] of Object.entries(utilityAmounts)) {
        if (amount && amount.trim() !== "") {
          await api.saveUtilityActual({
            property_id: selectedProperty.property_id,
            month_start: `${selectedMonth}-01`,
            utility,
            amount: parseFloat(amount),
          });
        }
      }

      const result = await api.runBillCalculation({
        propertyId: selectedProperty.property_id,
        monthStart: `${selectedMonth}-01`, // Convert YYYY-MM to YYYY-MM-DD
      });

      console.log("Calculation result:", result);
      setCalculationResult(result);
      setMessage(
        `Calculation completed! Created ${result.lines_created} bill lines and ${result.ledger_records_created} ledger records.`
      );

      // Reload bill lines to show new results
      await loadBillLines(selectedProperty.property_id);
    } catch (error) {
      console.error("Error running calculation:", error);
      setMessage("Error running calculation");
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

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Calculate Bills</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to calculate bills.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Calculate Bills for {selectedProperty.name}
        </h1>
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
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={utilityAmounts[utility] || ""}
                      onChange={(e) =>
                        setUtilityAmounts((prev) => ({
                          ...prev,
                          [utility]: e.target.value,
                        }))
                      }
                      placeholder="Enter amount"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Enter the actual utility costs for the selected month. These amounts
          will be used for bill calculations.
        </p>
      </div>

      {selectedMonth && (
        <p className="text-sm text-gray-600">
          Calculating bills for <strong>{formatMonth(selectedMonth)}</strong>
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
              <div className="text-sm text-green-600">Total Person Days</div>
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

              {Object.entries(groupedBillLines).map(([userId, userData]) => (
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
              ))}
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
  );
}
