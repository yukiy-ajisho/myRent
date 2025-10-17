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

  return (
    <div>
      {sortedBillLines.map((billLine) => (
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
