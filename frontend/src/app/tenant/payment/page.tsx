"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getAuthState } from "@/lib/auth-state-client";
import { useRouter } from "next/navigation";
import AccessDenied from "@/components/AccessDenied";

// Payment データの型定義
interface PaymentRecord {
  payment_id: string;
  user_id: string;
  property_id: string;
  amount: number;
  note: string | null;
  paid_at: string;
  property: {
    name: string;
  };
  isAccepted: boolean;
}

// UserProperty データの型定義
interface UserProperty {
  property_id: string;
  property: {
    property_id: string;
    name: string;
    active: boolean;
    address: string;
  };
}

export default function TenantPayment() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
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
          await fetchPaymentData();
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Payment データを取得
  const fetchPaymentData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("=== DEBUG INFO ===");
      console.log("Fetching tenant payment data...");
      console.log(
        "API URL:",
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
      );

      const data = await api.getTenantPayments();
      console.log("API Response:", data);
      console.log("Payments:", data.payments);
      console.log("User Properties:", data.userProperties);

      setPayments(data.payments || []);
      setUserProperties(data.userProperties || []);
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
    return <AccessDenied userType="owner" attemptedPath="/tenant/payment" />;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading payment data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Payment</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Payment</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-blue-800">支払い履歴がありません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Payment</h1>

      {/* Payment History List */}
      <div className="space-y-4">
        {payments.map((payment) => {
          return (
            <div
              key={payment.payment_id}
              className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    支払い日:
                  </span>
                  <p className="font-semibold">
                    {payment.paid_at
                      ? new Date(payment.paid_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    プロパティ:
                  </span>
                  <p className="font-semibold">
                    {payment.property?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    金額:
                  </span>
                  <p className="text-lg font-semibold">
                    ¥{payment.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    メモ:
                  </span>
                  <p>{payment.note || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    ステータス:
                  </span>
                  <p
                    className={`font-semibold ${
                      payment.isAccepted ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {payment.isAccepted ? "✅ 承認済み" : "⏳ 承認待ち"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
