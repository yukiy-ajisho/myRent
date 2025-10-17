"use client";

import { useState, useEffect, useCallback } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

// Bill Line データの型定義
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

export default function History() {
  const { selectedProperty, isLoading: propertyLoading } = useProperty();
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedName, setSelectedName] = useState<string>("");

  const fetchBillLineData = useCallback(async () => {
    if (!selectedProperty) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log("=== DEBUG INFO ===");
      console.log("Selected property:", selectedProperty);
      console.log("Property ID:", selectedProperty.property_id);
      console.log(
        "API URL:",
        `http://localhost:4000/bill-line/${selectedProperty.property_id}`
      );

      const data = await api.getBillLineData(selectedProperty.property_id);
      console.log("API Response:", data);
      console.log("Bill Lines:", data.billLines);
      if (data.billLines && data.billLines.length > 0) {
        console.log("First bill line:", data.billLines[0]);
        console.log("app_user:", data.billLines[0].app_user);
        console.log("bill_run:", data.billLines[0].bill_run);
      }
      setBillLines(data.billLines || []);
    } catch (err) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error object:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      setError(`データの取得に失敗しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProperty]);

  // プロパティが選択されたときにデータを取得
  useEffect(() => {
    if (selectedProperty && !propertyLoading) {
      fetchBillLineData();
    }
  }, [selectedProperty, propertyLoading, fetchBillLineData]);

  if (propertyLoading) {
    return <div>プロパティを読み込み中...</div>;
  }

  if (!selectedProperty) {
    return <div>プロパティが選択されていません</div>;
  }

  if (isLoading) {
    return <div>データを読み込み中...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (billLines.length === 0) {
    return <div>データがありません</div>;
  }

  // Sort bill lines: first by bill_run_id (ascending), then by name (ascending)
  const sortedBillLines = billLines.sort((a, b) => {
    // First priority: bill_run_id ascending
    if (a.bill_run_id !== b.bill_run_id) {
      return a.bill_run_id - b.bill_run_id;
    }

    // Second priority: name ascending within same bill_run_id
    return a.app_user?.name?.localeCompare(b.app_user?.name || "") || 0;
  });

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

  const uniqueNames = Array.from(
    new Set(
      sortedBillLines.map((billLine) => billLine.app_user?.name).filter(Boolean)
    )
  ).sort();

  // Filter bill lines based on selected filters
  const filteredBillLines = sortedBillLines.filter((billLine) => {
    const year = billLine.bill_run?.month_start?.substring(0, 4);
    const month = billLine.bill_run?.month_start?.substring(5, 7);
    const name = billLine.app_user?.name;

    const yearMatch = !selectedYear || year === selectedYear;
    const monthMatch = !selectedMonth || month === selectedMonth;
    const nameMatch = !selectedName || name === selectedName;

    return yearMatch && monthMatch && nameMatch;
  });

  return (
    <div>
      {/* Filter Controls */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      >
        <h3 style={{ marginBottom: "15px" }}>Filters</h3>
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
          {/* Year Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: "5px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
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
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Month:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "5px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            >
              <option value="">All Months</option>
              {uniqueMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Name Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Name:
            </label>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
              style={{
                padding: "5px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            >
              <option value="">All Names</option>
              {uniqueNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          <div style={{ alignSelf: "end" }}>
            <button
              onClick={() => {
                setSelectedYear("");
                setSelectedMonth("");
                setSelectedName("");
              }}
              style={{
                padding: "5px 15px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div style={{ marginBottom: "15px", fontSize: "14px", color: "#666" }}>
        Showing {filteredBillLines.length} of {sortedBillLines.length} records
      </div>

      {/* Bill Lines List */}
      {filteredBillLines.map((billLine) => (
        <div
          key={billLine.bill_line_id}
          style={{
            marginBottom: "10px",
            padding: "10px",
            border: "1px solid #ccc",
          }}
        >
          <div>Tenant name: {billLine.app_user?.name || "Unknown"}</div>
          <div>Amount: ${billLine.amount.toLocaleString()}</div>
          <div>
            Utility:{" "}
            {billLine.utility.charAt(0).toUpperCase() +
              billLine.utility.slice(1)}
          </div>
          <div>
            Month:{" "}
            {billLine.bill_run?.month_start
              ? billLine.bill_run.month_start.substring(0, 7)
              : "Unknown"}
          </div>
        </div>
      ))}
    </div>
  );
}
