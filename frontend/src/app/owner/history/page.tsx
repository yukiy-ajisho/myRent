"use client";

import { useState, useEffect } from "react";
import { useProperty, Property } from "@/contexts/PropertyContext";
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
    property_id: string;
  };
}

export default function History() {
  const { userProperties } = useProperty();
  const [allBillLines, setAllBillLines] = useState<BillLine[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedName, setSelectedName] = useState<string>("");

  // 初回ロード時のみ全データを取得
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("=== FETCHING ALL BILL LINE DATA ===");

        const data = await api.getBillLineData(); // property_idなし
        console.log("API Response:", data);
        console.log("All Bill Lines:", data.billLines?.length || 0);

        setAllBillLines(data.billLines || []);
      } catch (err) {
        console.error("=== ERROR DETAILS ===");
        console.error("Error object:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        console.error("Error message:", errorMessage);
        setError(`データの取得に失敗しました: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // プロパティ選択のハンドラー
  const handlePropertyChange = (propertyId: string) => {
    console.log("=== PROPERTY CHANGE DEBUG ===");
    console.log("Selected propertyId:", propertyId);
    console.log("userProperties:", userProperties);

    if (propertyId === "") {
      console.log("Setting selectedProperty to null");
      setSelectedProperty(null);
      return;
    }

    // 文字列を数値に変換してから比較
    const property = userProperties.find(
      (p) => p.property_id === parseInt(propertyId)
    );
    console.log("Found property:", property);
    setSelectedProperty(property || null);
  };

  if (isLoading) {
    return <div>データを読み込み中...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (allBillLines.length === 0) {
    return <div>データがありません</div>;
  }

  // プロパティでフィルタリング
  const propertyFilteredBillLines = selectedProperty
    ? allBillLines.filter(
        (billLine) =>
          billLine.bill_run?.property_id === selectedProperty.property_id
      )
    : allBillLines;

  // Sort bill lines: first by bill_run_id (ascending), then by name (ascending)
  const sortedBillLines = propertyFilteredBillLines.sort((a, b) => {
    // First priority: bill_run_id ascending
    if (a.bill_run_id !== b.bill_run_id) {
      return parseInt(a.bill_run_id) - parseInt(b.bill_run_id);
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

  console.log("=== RENDER DEBUG ===");
  console.log("selectedProperty:", selectedProperty);
  console.log("userProperties:", userProperties);
  if (userProperties.length > 0) {
    console.log("First userProperty structure:", userProperties[0]);
    console.log(
      "First userProperty property_id type:",
      typeof userProperties[0].property_id
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">History</h1>
        <div className="flex items-center space-x-2">
          <label
            htmlFor="property-select"
            className="text-sm font-medium text-gray-700"
          >
            Property:
          </label>
          <select
            id="property-select"
            value={selectedProperty?.property_id || ""}
            onChange={(e) => handlePropertyChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Properties</option>
            {userProperties.map((property) => (
              <option key={property.property_id} value={property.property_id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
      </div>
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
    </div>
  );
}
