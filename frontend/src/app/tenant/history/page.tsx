"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getAuthState } from "@/lib/auth-state-client";
import { useRouter } from "next/navigation";
import AccessDenied from "@/components/AccessDenied";

// Bill Line データの型定義（app_userは削除）
interface BillLine {
  bill_line_id: string;
  user_id: string;
  utility: string;
  amount: number;
  bill_run_id: string;
  bill_run: {
    month_start: string;
    property_id: string;
    property: {
      name: string;
    };
  };
}

// Property データの型定義
interface Property {
  property_id: string;
  name: string;
  active: boolean;
  address: string;
}

export default function TenantHistoryPage() {
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"checking" | "denied" | "allowed">(
    "checking"
  );
  const router = useRouter();

  // Filter states（名前フィルターは削除）
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedProperty, setSelectedProperty] = useState<string>("");

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { state, user } = await getAuthState();

        if (state === "unauthenticated") {
          router.push("/login");
          return;
        }

        if (state === "authenticating") {
          router.push("/user-type-selection");
          return;
        }

        if (state === "authenticated" && user) {
          if (user.user_type !== "tenant") {
            setAuthState("denied");
            return;
          }

          setAuthState("allowed");
          await fetchTenantBillHistory();
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Tenant Bill History データを取得
  const fetchTenantBillHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("=== DEBUG INFO ===");
      console.log("Fetching tenant bill history...");
      console.log(
        "API URL:",
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
      );

      const data = await api.getTenantBillHistory();
      console.log("API Response:", data);
      console.log("First bill line:", data.billLines?.[0]);
      console.log("Bill run structure:", data.billLines?.[0]?.bill_run);

      setProperties(data.properties || []);
      setBillLines(data.billLines || []);

      // 最初のプロパティを自動選択
      if (data.properties && data.properties.length > 0) {
        setSelectedProperty(data.properties[0].property_id);
      }
    } catch (err) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error object:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      setError(`データの取得に失敗しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (authState === "checking") {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (authState === "denied") {
    return <AccessDenied userType="owner" attemptedPath="/tenant/history" />;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">History</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">History</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            No properties assigned. Please contact your property manager.
          </p>
        </div>
      </div>
    );
  }

  if (billLines.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">History</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-blue-800">No bill history found.</p>
        </div>
      </div>
    );
  }

  // ソートなしでそのまま表示
  const sortedBillLines = billLines;

  // Extract unique values for dropdowns
  const uniqueYears = Array.from(
    new Set(
      sortedBillLines
        .map((billLine) => billLine.bill_run?.month_start?.substring(0, 4))
        .filter(Boolean)
    )
  ).sort();

  const uniqueMonths = Array.from(
    new Set(
      sortedBillLines
        .map((billLine) => billLine.bill_run?.month_start?.substring(5, 7))
        .filter(Boolean)
    )
  ).sort();

  // Filter bill lines based on selected filters
  const filteredBillLines = sortedBillLines.filter((billLine) => {
    const year = billLine.bill_run?.month_start?.substring(0, 4);
    const month = billLine.bill_run?.month_start?.substring(5, 7);
    const propertyId = billLine.bill_run?.property_id;

    const yearMatch = !selectedYear || year === selectedYear;
    const monthMatch = !selectedMonth || month === selectedMonth;
    const propertyMatch = !selectedProperty || propertyId === selectedProperty;

    // デバッグログを追加
    if (selectedProperty && propertyId) {
      console.log(`Property Filter Debug:`, {
        selectedProperty,
        propertyId,
        propertyIdType: typeof propertyId,
        selectedPropertyType: typeof selectedProperty,
        propertyMatch,
        billLineUtility: billLine.utility,
      });
    }

    return yearMatch && monthMatch && propertyMatch;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">History</h1>

      {/* Filter Controls */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="flex gap-4 flex-wrap">
          {/* Property Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property:
            </label>
            <select
              value={selectedProperty}
              onChange={(e) => {
                console.log(`Property selection changed:`, {
                  selectedValue: e.target.value,
                  selectedValueType: typeof e.target.value,
                  availableProperties: properties.map((p) => ({
                    id: p.property_id,
                    name: p.name,
                    idType: typeof p.property_id,
                  })),
                });
                setSelectedProperty(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Properties</option>
              {properties.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {uniqueYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Months</option>
              {uniqueMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedYear("");
                setSelectedMonth("");
                setSelectedProperty("");
              }}
              className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredBillLines.length} of {sortedBillLines.length} records
      </div>

      {/* Bill Lines List */}
      <div className="space-y-4">
        {filteredBillLines.map((billLine) => {
          return (
            <div
              key={billLine.bill_line_id}
              className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Property:
                  </span>
                  <p className="font-semibold">
                    {billLine.bill_run?.property?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Amount:
                  </span>
                  <p className="text-lg font-semibold">
                    ${billLine.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Utility:
                  </span>
                  <p className="capitalize">{billLine.utility}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Month:
                  </span>
                  <p>
                    {billLine.bill_run?.month_start
                      ? billLine.bill_run.month_start.substring(0, 7)
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Bill Run ID:
                  </span>
                  <p className="font-mono text-sm">{billLine.bill_run_id}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
