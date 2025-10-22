"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getAuthState } from "@/lib/auth-state-client";
import { useRouter } from "next/navigation";
import AccessDenied from "@/components/AccessDenied";

// LedgerRecord データの型定義
interface LedgerRecord {
  ledger_id: string;
  user_id: string;
  property_id: string;
  amount: number;
  posted_at: string;
  source_type: string;
  source_id: string;
  running_balance: number;
  property: {
    name: string;
  };
}

// UserProperty データの型定義（フィルター用）
interface UserProperty {
  property_id: string;
  property: {
    property_id: string;
    name: string;
    active: boolean;
    address: string;
  };
}

export default function TenantRunningBalance() {
  const [ledgerRecords, setLedgerRecords] = useState<LedgerRecord[]>([]);
  const [userProperties, setUserProperties] = useState<UserProperty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"checking" | "denied" | "allowed">(
    "checking"
  );
  const router = useRouter();

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
          await fetchRunningBalanceData();
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Running balance データを取得
  const fetchRunningBalanceData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("=== DEBUG INFO ===");
      console.log("Fetching tenant running balance data...");
      console.log(
        "API URL:",
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
      );

      const data = await api.getTenantRunningBalance();
      console.log("API Response:", data);
      console.log("Ledger Records:", data.ledgerRecords);
      console.log("User Properties:", data.userProperties);

      setLedgerRecords(data.ledgerRecords || []);
      setUserProperties(data.userProperties || []);
    } catch (err) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error object:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      setError(`Failed to fetch running balance: ${err.message}`);
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
    return (
      <AccessDenied userType="owner" attemptedPath="/tenant/running-balance" />
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading running balance...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Running Balance</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (ledgerRecords.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Running Balance</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-blue-800">No ledger records found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Running Balance</h1>

      {/* Ledger Records List */}
      <div className="space-y-4">
        {ledgerRecords.map((record) => (
          <div
            key={record.ledger_id}
            className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Date:</span>
                <p className="font-semibold">
                  {new Date(record.posted_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Property:
                </span>
                <p className="font-semibold">
                  {record.property?.name || "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Amount:
                </span>
                <p
                  className={`text-lg font-semibold ${
                    record.amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ${record.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Running Balance:
                </span>
                <p className="text-lg font-bold">
                  ${record.running_balance.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Source:
                </span>
                <p className="font-semibold">{record.source_type}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
