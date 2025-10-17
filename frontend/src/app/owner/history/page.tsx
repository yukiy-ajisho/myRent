"use client";

import { useState, useEffect, useCallback } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

// Bill Line データの型定義
interface BillLine {
  bill_line_id: string;
  property_id: string;
  user_id: string;
  utility_id: string;
  amount: number;
  created_at: string;
  property: {
    property_id: string;
    name: string;
    timezone: string;
  };
  user: {
    user_id: string;
    name: string;
    email: string;
  };
  utility: {
    utility_id: string;
    name: string;
    unit: string;
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

  return (
    <div>
      {billLines.map((billLine) => (
        <div
          key={billLine.bill_line_id}
          style={{
            marginBottom: "10px",
            padding: "10px",
            border: "1px solid #ccc",
          }}
        >
          <div>ID: {billLine.bill_line_id}</div>
          <div>金額: ¥{billLine.amount.toLocaleString()}</div>
          <div>ユーザーID: {billLine.user_id}</div>
          <div>ユーティリティID: {billLine.utility_id}</div>
          <div>Bill Run ID: {billLine.bill_run_id}</div>
        </div>
      ))}
    </div>
  );
}
