"use client";

import { useState, useEffect } from "react";
import { useProperty, Property } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";
import PaymentScheduleModal from "@/components/PaymentScheduleModal";

// Bill Line データの型定義
interface BillLine {
  bill_line_id: string;
  user_id: string;
  utility: string;
  amount: number;
  bill_run_id: string;
  app_user: {
    name: string;
    nick_name?: string | null;
  };
  bill_run: {
    month_start: string;
    property_id: string;
  };
}

// Payment データの型定義
interface Payment {
  payment_id: string;
  user_id: string;
  property_id: string;
  amount: number;
  note: string;
  paid_at: string;
  app_user: {
    name: string;
    email: string;
    nick_name?: string | null;
  };
  isAccepted: boolean;
  confirmedAt: string | null;
}

// Scheduled Payment データの型定義
interface ScheduledPayment {
  payment_id: string;
  user_id: string;
  property_id: string;
  amount: number;
  amount_paid: number;
  is_auto_paid: boolean;
  note: string;
  paid_at: string | null;
  due_date: string;
  bill_run_id: number;
  app_user: {
    name: string;
    email: string;
    nick_name?: string | null;
  };
  bill_run: {
    month_start: string;
  };
  isAccepted: boolean;
  confirmedAt: string | null;
}

export default function History() {
  const { userProperties } = useProperty();

  // タブ切り替えの状態
  const [activeTab, setActiveTab] = useState<"bill" | "payment">("payment");

  // Bill History の状態
  const [allBillLines, setAllBillLines] = useState<BillLine[]>([]);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  // Payment History の状態
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  // Scheduled Payments の状態
  const [scheduledPayments, setScheduledPayments] = useState<
    ScheduledPayment[]
  >([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // 共通の状態
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );

  // Bill History のフィルター状態
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedName, setSelectedName] = useState<string>("");

  // 初回ロード時に両方のデータを取得
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    // Bill History データを取得
    await fetchBillData();
    // Payment History データを取得
    await fetchPaymentData();
    // Scheduled Payments データを取得
    await fetchScheduledPayments();
  };

  const fetchBillData = async () => {
    try {
      setBillLoading(true);
      setBillError(null);
      console.log("=== FETCHING ALL BILL LINE DATA ===");

      const data = await api.getBillLineData();
      console.log("API Response:", data);
      console.log("All Bill Lines:", data.billLines?.length || 0);

      setAllBillLines(data.billLines || []);
    } catch (err) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error object:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error message:", errorMessage);
      setBillError(`データの取得に失敗しました: ${errorMessage}`);
    } finally {
      setBillLoading(false);
    }
  };

  const fetchPaymentData = async () => {
    try {
      setPaymentLoading(true);
      setPaymentMessage("");

      console.log("=== PAYMENT DEBUG ===");
      console.log("Fetching all payments...");

      const data = await api.getAllPayments();
      console.log("API Response received:", data);

      const payments = data.payments || [];
      console.log("All payments from API:", payments);
      console.log("Number of payments:", payments.length);

      setAllPayments(payments);
    } catch (error) {
      console.error("Error loading payments:", error);
      setPaymentMessage("Error loading payments");
    } finally {
      setPaymentLoading(false);
    }
  };

  const fetchScheduledPayments = async () => {
    try {
      console.log("=== SCHEDULED PAYMENTS DEBUG ===");
      console.log("Fetching scheduled payments...");

      const data = await api.getScheduledPayments();
      console.log("Scheduled payments response:", data);

      const scheduled = data.scheduled_payments || [];
      console.log("Number of scheduled payments:", scheduled.length);

      setScheduledPayments(scheduled);
    } catch (error) {
      console.error("Error loading scheduled payments:", error);
    }
  };

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

    // Find property by ID
    const property = userProperties.find((p) => p.property_id === propertyId);
    console.log("Found property:", property);
    setSelectedProperty(property || null);
  };

  // Payment の Accept ハンドラー
  const handleAcceptPayment = async (paymentId: string) => {
    try {
      console.log("=== FRONTEND PAYMENT ACCEPT ===");
      console.log("Accepting payment:", paymentId);

      const response = await api.acceptPayment(paymentId);
      console.log("Accept response:", response);

      setPaymentMessage("Payment accepted successfully!");

      // Reload all payments to update status
      fetchPaymentData();
      fetchScheduledPayments();
    } catch (error) {
      console.error("Error accepting payment:", error);
      setPaymentMessage("Error occurred while accepting payment");
    }
  };

  const handleScheduleSuccess = () => {
    setPaymentMessage("Payment schedule created successfully!");
    fetchScheduledPayments();
  };

  // Bill History のフィルタリング
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
      sortedBillLines
        .map(
          (billLine) => billLine.app_user?.nick_name || billLine.app_user?.name
        )
        .filter(Boolean)
    )
  ).sort();

  // Filter bill lines based on selected filters
  const filteredBillLines = sortedBillLines.filter((billLine) => {
    const year = billLine.bill_run?.month_start?.substring(0, 4);
    const month = billLine.bill_run?.month_start?.substring(5, 7);
    const name = billLine.app_user?.nick_name || billLine.app_user?.name;

    const yearMatch = !selectedYear || year === selectedYear;
    const monthMatch = !selectedMonth || month === selectedMonth;
    const nameMatch = !selectedName || name === selectedName;

    return yearMatch && monthMatch && nameMatch;
  });

  // Payment History のフィルタリング
  const filteredPayments = selectedProperty
    ? allPayments.filter(
        (payment) => payment.property_id === selectedProperty.property_id
      )
    : allPayments;

  // Scheduled Payments のフィルタリング
  const filteredScheduledPayments = selectedProperty
    ? scheduledPayments.filter(
        (payment) => payment.property_id === selectedProperty.property_id
      )
    : scheduledPayments;

  // デバッグログ
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
      <div className="mb-4">
        {/* タブボタン */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4 w-fit">
          <button
            onClick={() => setActiveTab("payment")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === "payment"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Payment History
          </button>
          <button
            onClick={() => setActiveTab("bill")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === "bill"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Bill History
          </button>
        </div>

        {/* プロパティ選択ドロップダウン */}
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

      {/* Bill History タブのコンテンツ */}
      {activeTab === "bill" && (
        <div>
          {billLoading ? (
            <div>データを読み込み中...</div>
          ) : billError ? (
            <div>{billError}</div>
          ) : allBillLines.length === 0 ? (
            <div>データがありません</div>
          ) : (
            <div>
              {/* Filter Controls */}
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                  {/* Year Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Bill Lines Table */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="grid grid-cols-5 gap-0">
                  {/* ヘッダー行 */}
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
                    Name
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Property
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Utility
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Month
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-20">
                    Amount
                  </div>

                  {/* データ行 */}
                  {filteredBillLines.map((billLine) => (
                    <div key={billLine.bill_line_id} className="contents">
                      <div className="text-left py-3">
                        <div className="text-lg font-semibold text-gray-900">
                          {billLine.app_user?.nick_name ||
                            billLine.app_user?.name ||
                            "Unknown"}
                        </div>
                      </div>
                      <div className="text-gray-600 py-3 pl-9">
                        {userProperties.find(
                          (p) =>
                            p.property_id === billLine.bill_run?.property_id
                        )?.name || "Unknown Property"}
                      </div>
                      <div className="text-gray-600 py-3 pl-9">
                        {billLine.utility.charAt(0).toUpperCase() +
                          billLine.utility.slice(1)}
                      </div>
                      <div className="text-gray-600 py-3 pl-9">
                        {billLine.bill_run?.month_start
                          ? billLine.bill_run.month_start.substring(0, 7)
                          : "Unknown"}
                      </div>
                      <div className="text-2xl font-bold py-3 pl-20">
                        ${billLine.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Results Count - 一番下に表示 */}
              <div
                style={{
                  marginTop: "15px",
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                Showing {filteredBillLines.length} of {sortedBillLines.length}{" "}
                records
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment History タブのコンテンツ */}
      {activeTab === "payment" && (
        <div>
          {paymentLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2">Loading payments...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
                  <p className="text-gray-600 text-lg">
                    No payment data found
                    {selectedProperty ? ` for ${selectedProperty.name}` : ""}.
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Payment reports will appear here when tenants submit them.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="grid grid-cols-6 gap-0">
                    {/* ヘッダー行 */}
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
                      Name
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                      Property
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                      Payment Date
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                      Confirmation Date
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-24">
                      Amount
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-28">
                      Action
                    </div>

                    {/* データ行 */}
                    {filteredPayments.map((payment) => (
                      <div key={payment.payment_id} className="contents">
                        <div className="text-left py-3">
                          <div className="text-lg font-semibold text-gray-900">
                            {payment.app_user.nick_name ||
                              payment.app_user.name}
                          </div>
                          <div className="text-gray-600 text-sm">
                            {payment.app_user.email}
                          </div>
                        </div>
                        <div className="text-gray-600 py-3 pl-9">
                          {userProperties.find(
                            (p) => p.property_id === payment.property_id
                          )?.name || "Unknown Property"}
                        </div>
                        <div className="text-gray-600 py-3 pl-9">
                          {new Date(payment.paid_at).toLocaleDateString()}
                        </div>
                        <div className="text-gray-600 py-3 pl-9">
                          {payment.isAccepted && payment.confirmedAt
                            ? new Date(payment.confirmedAt).toLocaleDateString()
                            : payment.isAccepted
                            ? "Confirmed"
                            : "Pending"}
                        </div>
                        <div className="text-2xl font-bold py-3 pl-20">
                          ${payment.amount.toLocaleString()}
                        </div>
                        <div className="text-center py-3 pl-6">
                          {!payment.isAccepted ? (
                            <button
                              onClick={() =>
                                handleAcceptPayment(payment.payment_id)
                              }
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              Confirm
                            </button>
                          ) : (
                            <span className="text-green-600 text-sm font-medium">
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentMessage && (
            <div
              className={`mt-4 p-4 rounded-md ${
                paymentMessage.includes("Error")
                  ? "bg-red-50 border border-red-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <p
                className={
                  paymentMessage.includes("Error")
                    ? "text-red-800"
                    : "text-green-800"
                }
              >
                {paymentMessage}
              </p>
            </div>
          )}

          {/* Scheduled Payments Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Scheduled Payments
              </h3>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Schedule
              </button>
            </div>

            {filteredScheduledPayments.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
                <p className="text-gray-600">
                  No scheduled payments found
                  {selectedProperty ? ` for ${selectedProperty.name}` : ""}.
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Create a payment schedule to set up installments for tenants.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="grid grid-cols-8 gap-0">
                  {/* ヘッダー行 */}
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
                    Name
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Property
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Bill Month
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Due Date
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-12">
                    Scheduled
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-16">
                    Paid
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-9">
                    Status
                  </div>
                  <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-16">
                    Action
                  </div>

                  {/* データ行 */}
                  {filteredScheduledPayments.map((payment) => {
                    const isPaid =
                      payment.isAccepted ||
                      payment.amount_paid >= payment.amount;
                    const isPartiallyPaid =
                      (payment.amount_paid || 0) > 0 && !isPaid;
                    const isPending = payment.paid_at && !payment.isAccepted;

                    return (
                      <div key={payment.payment_id} className="contents">
                        <div className="text-left py-3">
                          <div className="text-lg font-semibold text-gray-900">
                            {payment.app_user.nick_name ||
                              payment.app_user.name}
                          </div>
                        </div>
                        <div className="text-gray-600 py-3 pl-9">
                          {userProperties.find(
                            (p) => p.property_id === payment.property_id
                          )?.name || "Unknown Property"}
                        </div>
                        <div className="text-gray-600 py-3 pl-9">
                          {payment.bill_run?.month_start
                            ? payment.bill_run.month_start.substring(0, 7)
                            : "N/A"}
                        </div>
                        <div className="text-gray-600 py-3 pl-9">
                          {new Date(payment.due_date).toLocaleDateString()}
                        </div>
                        <div className="py-3 pl-12">
                          <div className="text-lg font-bold">
                            ${payment.amount.toFixed(2)}
                          </div>
                        </div>
                        <div className="py-3 pl-16">
                          <div className="text-lg font-bold text-green-600">
                            ${(payment.amount_paid || 0).toFixed(2)}
                            {payment.is_auto_paid &&
                              (payment.amount_paid || 0) > 0 && (
                                <span className="ml-1 text-xs text-blue-600">
                                  💰
                                </span>
                              )}
                          </div>
                        </div>
                        <div className="py-3 pl-9">
                          {isPaid && (
                            <span className="text-green-600 text-sm font-medium">
                              ✅ Paid
                            </span>
                          )}
                          {isPending && (
                            <span className="text-yellow-600 text-sm font-medium">
                              ⏳ Pending
                            </span>
                          )}
                          {isPartiallyPaid && (
                            <span className="text-blue-600 text-sm font-medium">
                              🔵 Partial
                            </span>
                          )}
                          {!isPaid && !isPending && !isPartiallyPaid && (
                            <span className="text-red-600 text-sm font-medium">
                              ❌ Unpaid
                            </span>
                          )}
                        </div>
                        <div className="text-center py-3 pl-6">
                          {isPending ? (
                            <button
                              onClick={() =>
                                handleAcceptPayment(payment.payment_id)
                              }
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              Confirm
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Payment Schedule Modal */}
          <PaymentScheduleModal
            isOpen={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSuccess={handleScheduleSuccess}
          />
        </div>
      )}
    </div>
  );
}
