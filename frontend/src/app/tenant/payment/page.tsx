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

  // 支払い作成フォームの状態
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    property_id: "",
    amount: "",
    note: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 支払い作成
  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.property_id || !formData.amount) {
      setCreateError("Please enter property and amount");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setCreateError("Amount must be a positive number");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const result = await api.createTenantPayment({
        property_id: formData.property_id,
        amount: amount,
        note: formData.note || undefined,
      });

      console.log("Payment created successfully:", result);

      // Reset form
      setFormData({
        property_id: "",
        amount: "",
        note: "",
      });
      setShowCreateForm(false);

      // Reload payment history
      await fetchPaymentData();
    } catch (err) {
      console.error("Error creating payment:", err);
      setCreateError(`Failed to create payment: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // フォーム入力ハンドラー
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error
    if (createError) {
      setCreateError(null);
    }
  };

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
          <p className="text-blue-800">No payment history found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Payment</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          {showCreateForm ? "Cancel" : "New Payment"}
        </button>
      </div>

      {/* Payment Creation Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Payment</h2>

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800">{createError}</p>
            </div>
          )}

          <form onSubmit={handleCreatePayment} className="space-y-4">
            <div>
              <label
                htmlFor="property_id"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Property *
              </label>
              <select
                id="property_id"
                name="property_id"
                value={formData.property_id}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Please select a property</option>
                {userProperties
                  .filter((userProperty) => userProperty.property)
                  .map((userProperty) => (
                    <option
                      key={userProperty.property.property_id}
                      value={userProperty.property.property_id}
                    >
                      {userProperty.property.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Amount *
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter payment amount"
              />
            </div>

            <div>
              <label
                htmlFor="note"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Note
              </label>
              <textarea
                id="note"
                name="note"
                value={formData.note}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Payment note (optional)"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

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
                    Payment Date:
                  </span>
                  <p className="font-semibold">
                    {payment.paid_at
                      ? new Date(payment.paid_at).toLocaleDateString("en-US", {
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
                    Property:
                  </span>
                  <p className="font-semibold">
                    {payment.property?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Amount:
                  </span>
                  <p className="text-lg font-semibold">
                    ${payment.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Note:
                  </span>
                  <p>{payment.note || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Status:
                  </span>
                  <p
                    className={`font-semibold ${
                      payment.isAccepted ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {payment.isAccepted ? "✅ Confirmed" : "⏳ Pending"}
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
