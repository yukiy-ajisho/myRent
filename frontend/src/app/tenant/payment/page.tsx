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

// Scheduled Payment データの型定義
interface ScheduledPayment {
  payment_id: number;
  user_id: string;
  property_id: number;
  amount: number;
  amount_paid: number;
  is_auto_paid: boolean;
  note: string | null;
  paid_at: string | null;
  due_date: string;
  bill_run_id: number;
  property: {
    property_id: number;
    name: string;
  };
  bill_run: {
    bill_run_id: number;
    month_start: string;
  };
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
  const [scheduledPayments, setScheduledPayments] = useState<
    ScheduledPayment[]
  >([]);
  const [creditBalance, setCreditBalance] = useState(0);
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

  // Scheduled payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] =
    useState<ScheduledPayment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

      // Fetch scheduled payments
      const scheduledData = await api.getTenantScheduledPayments();
      console.log("Scheduled Payments Response:", scheduledData);
      setScheduledPayments(scheduledData.payments || []);
      setCreditBalance(scheduledData.creditBalance || 0);
    } catch (err: unknown) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error object:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to fetch data: ${errorMessage}`);
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
    } catch (err: unknown) {
      console.error("Error creating payment:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setCreateError(`Failed to create payment: ${errorMessage}`);
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

  // Open payment modal
  const handleOpenPaymentModal = (payment: ScheduledPayment) => {
    setSelectedPayment(payment);
    const remaining = payment.amount - payment.amount_paid;
    setPaymentAmount(remaining.toFixed(2));
    setPaymentError(null);
    setShowPaymentModal(true);
  };

  // Handle scheduled payment submission
  const handleSubmitScheduledPayment = async () => {
    if (!selectedPayment) return;

    const amount = parseFloat(paymentAmount);
    const remaining = selectedPayment.amount - selectedPayment.amount_paid;

    // Validation
    if (isNaN(amount) || amount <= 0) {
      setPaymentError("Amount must be a positive number");
      return;
    }

    if (amount < remaining) {
      setPaymentError(
        `Amount must be at least $${remaining.toFixed(2)} (remaining balance)`
      );
      return;
    }

    try {
      setIsSubmittingPayment(true);
      setPaymentError(null);

      await api.payScheduledPayment(amount);

      // Close modal and refresh data
      setShowPaymentModal(false);
      setSelectedPayment(null);
      setPaymentAmount("");
      await fetchPaymentData();
    } catch (err: unknown) {
      console.error("Error paying scheduled payment:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setPaymentError(`Failed to process payment: ${errorMessage}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Calculate payment preview
  const calculatePaymentPreview = () => {
    if (!selectedPayment) return null;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return null;

    // Get all unpaid/partially paid scheduled payments for same property, sorted by due date
    const unpaidPayments = scheduledPayments
      .filter(
        (p) =>
          p.property_id === selectedPayment.property_id &&
          p.bill_run_id === selectedPayment.bill_run_id &&
          p.amount_paid < p.amount
      )
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );

    let remaining = amount;
    const allocations: Array<{
      payment: ScheduledPayment;
      applied: number;
      isComplete: boolean;
    }> = [];

    for (const payment of unpaidPayments) {
      if (remaining <= 0) break;

      const needsAmount = payment.amount - payment.amount_paid;
      const appliedAmount = Math.min(needsAmount, remaining);

      allocations.push({
        payment,
        applied: appliedAmount,
        isComplete: appliedAmount >= needsAmount,
      });

      remaining -= appliedAmount;
    }

    return {
      allocations,
      excessCredit: remaining,
    };
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

  // Group scheduled payments by bill
  const groupedScheduledPayments = scheduledPayments.reduce((acc, payment) => {
    const key = `${payment.property_id}-${payment.bill_run_id}`;
    if (!acc[key]) {
      acc[key] = {
        property: payment.property,
        bill_run: payment.bill_run,
        payments: [],
      };
    }
    acc[key].payments.push(payment);
    return acc;
  }, {} as Record<string, { property: { property_id: number; name: string }; bill_run: { bill_run_id: number; month_start: string }; payments: ScheduledPayment[] }>);

  const preview = calculatePaymentPreview();

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

      {/* Scheduled Payments Section */}
      <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            📅 Scheduled Payments
          </h2>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              Credit Balance:{" "}
            </span>
            <span
              className={
                creditBalance > 0
                  ? "text-lg font-bold text-green-600"
                  : "text-lg font-bold text-gray-600"
              }
            >
              ${creditBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {scheduledPayments.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
            <p className="text-gray-600">No scheduled payments found.</p>
            <p className="text-gray-500 text-sm mt-2">
              Payment schedules will appear here once created by the owner.
            </p>
          </div>
        ) : (
          Object.entries(groupedScheduledPayments).map(([key, group]) => (
            <div
              key={key}
              className="mb-6 bg-white border border-gray-200 rounded-lg p-4"
            >
              <h3 className="font-semibold text-lg mb-3">
                {group.property.name} - Bill:{" "}
                {new Date(group.bill_run.month_start).toLocaleDateString(
                  "en-US",
                  { month: "2-digit", year: "numeric" }
                )}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        Due Date
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-right">
                        Scheduled
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-right">
                        Paid
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-center">
                        Status
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.payments
                      .sort(
                        (a, b) =>
                          new Date(a.due_date).getTime() -
                          new Date(b.due_date).getTime()
                      )
                      .map((payment) => {
                        const remaining = payment.amount - payment.amount_paid;
                        const isPaid = payment.amount_paid >= payment.amount;
                        const isPartiallyPaid =
                          payment.amount_paid > 0 &&
                          payment.amount_paid < payment.amount;

                        return (
                          <tr
                            key={payment.payment_id}
                            className="hover:bg-gray-50"
                          >
                            <td className="border border-gray-300 px-4 py-2">
                              {new Date(payment.due_date).toLocaleDateString()}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              ${payment.amount.toFixed(2)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              ${payment.amount_paid.toFixed(2)}
                              {payment.is_auto_paid &&
                                payment.amount_paid > 0 && (
                                  <span className="ml-1 text-xs text-blue-600">
                                    💰
                                  </span>
                                )}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {isPaid ? (
                                <span className="text-green-600 font-semibold">
                                  ✅ Paid
                                </span>
                              ) : isPartiallyPaid ? (
                                <span className="text-blue-600 font-semibold">
                                  🔵 Partially Paid
                                </span>
                              ) : (
                                <span className="text-yellow-600 font-semibold">
                                  ⏳ Unpaid
                                </span>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {!isPaid && (
                                <button
                                  onClick={() =>
                                    handleOpenPaymentModal(payment)
                                  }
                                  className="bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors text-sm"
                                >
                                  Pay ${remaining.toFixed(2)}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Free Payment History List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          💳 Free Payments
        </h2>
        {payments.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-blue-800">No free payment history found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              return (
                <div
                  key={payment.payment_id}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:shadow-md transition-shadow"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Payment Date:
                      </span>
                      <p className="font-semibold">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
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
                          payment.isAccepted
                            ? "text-green-600"
                            : "text-yellow-600"
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
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Pay Scheduled Payment</h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-md">
              <p>
                <strong>Property:</strong> {selectedPayment.property.name}
              </p>
              <p>
                <strong>Bill Month:</strong>{" "}
                {new Date(
                  selectedPayment.bill_run.month_start
                ).toLocaleDateString("en-US", {
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
              <p>
                <strong>Due Date:</strong>{" "}
                {new Date(selectedPayment.due_date).toLocaleDateString()}
              </p>
              <p>
                <strong>Amount Due:</strong> $
                {(selectedPayment.amount - selectedPayment.amount_paid).toFixed(
                  2
                )}
              </p>
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <p className="text-red-800">{paymentError}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Amount: *
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  setPaymentError(null);
                }}
                min={(
                  selectedPayment.amount - selectedPayment.amount_paid
                ).toFixed(2)}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter payment amount"
              />
              <p className="text-sm text-gray-500 mt-1">
                Minimum: $
                {(selectedPayment.amount - selectedPayment.amount_paid).toFixed(
                  2
                )}
              </p>
            </div>

            {/* Payment Preview */}
            {preview && preview.allocations.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="font-semibold mb-2">
                  💡 Your payment will cover:
                </h3>
                <ul className="space-y-1">
                  {preview.allocations.map((alloc, idx) => (
                    <li key={idx} className="text-sm">
                      • {new Date(alloc.payment.due_date).toLocaleDateString()}:
                      ${alloc.applied.toFixed(2)}
                      {alloc.isComplete
                        ? " ✅"
                        : ` ⏳ (partial, $${(
                            alloc.payment.amount -
                            alloc.payment.amount_paid -
                            alloc.applied
                          ).toFixed(2)} remaining)`}
                    </li>
                  ))}
                </ul>
                {preview.excessCredit > 0 && (
                  <p className="text-sm mt-2 font-semibold text-green-600">
                    💰 Credit balance after payment: $
                    {preview.excessCredit.toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPayment(null);
                  setPaymentAmount("");
                  setPaymentError(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                disabled={isSubmittingPayment}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitScheduledPayment}
                disabled={isSubmittingPayment}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingPayment ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
