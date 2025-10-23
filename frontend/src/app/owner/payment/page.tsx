"use client";

import { useState, useEffect } from "react";
import { useProperty, Property } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

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
  };
  isAccepted: boolean;
}

export default function Payment() {
  const { userProperties } = useProperty();
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 初期データ読み込み
  useEffect(() => {
    fetchAllPayments();
  }, []);

  const fetchAllPayments = async () => {
    try {
      setIsLoading(true);
      setMessage("");

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
      setMessage("Error loading payments");
    } finally {
      setIsLoading(false);
    }
  };

  // プロパティ選択変更
  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    console.log("=== PROPERTY SELECTION DEBUG ===");
    console.log("Selected propertyId:", propertyId);
    console.log("userProperties:", userProperties);

    if (propertyId === "") {
      setSelectedProperty(null);
    } else {
      const property = userProperties.find(
        (p) => p.property_id === parseInt(propertyId)
      );
      console.log("Found property:", property);
      setSelectedProperty(property || null);
    }
  };

  // フィルタリングされた支払いデータ
  const filteredPayments = selectedProperty
    ? allPayments.filter(
        (payment) => payment.property_id === selectedProperty.property_id
      )
    : allPayments;

  // デバッグログ
  console.log("=== FILTERING DEBUG ===");
  console.log("selectedProperty:", selectedProperty);
  console.log("allPayments count:", allPayments.length);
  console.log("filteredPayments count:", filteredPayments.length);
  if (selectedProperty) {
    console.log("Filtering by property_id:", selectedProperty.property_id);
    console.log("Sample payment property_id:", allPayments[0]?.property_id);
  }

  const handleAcceptPayment = async (paymentId: string) => {
    try {
      console.log("=== FRONTEND PAYMENT ACCEPT ===");
      console.log("Accepting payment:", paymentId);

      const response = await api.acceptPayment(paymentId);
      console.log("Accept response:", response);

      setMessage("Payment accepted successfully!");

      // Reload all payments to update status
      fetchAllPayments();
    } catch (error) {
      console.error("Error accepting payment:", error);
      setMessage("Error occurred while accepting payment");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Payments{selectedProperty ? ` for ${selectedProperty.name}` : ""}
        </h1>

        {/* プロパティ選択ドロップダウン */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="property-select"
            className="text-sm font-medium text-gray-700"
          >
            Property:
          </label>
          <select
            id="property-select"
            value={selectedProperty?.property_id || ""}
            onChange={handlePropertyChange}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {isLoading ? (
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
            <div className="grid gap-4">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.payment_id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {payment.app_user.name}
                      </h3>
                      <p className="text-gray-600 mt-1">
                        {payment.app_user.email}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          ${payment.amount}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {new Date(payment.paid_at).toLocaleDateString()}
                        </span>
                        {payment.isAccepted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Accepted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </div>
                      {payment.note && (
                        <p className="text-sm text-gray-600 mt-2">
                          {payment.note}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      {!payment.isAccepted ? (
                        <button
                          onClick={() =>
                            handleAcceptPayment(payment.payment_id)
                          }
                          className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold text-lg hover:bg-green-600 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                        >
                          ✅ Accept
                        </button>
                      ) : (
                        <div className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-semibold text-lg border-2 border-gray-300">
                          ✓ Accepted
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mt-4 p-4 rounded-md ${
            message.includes("Error")
              ? "bg-red-50 border border-red-200"
              : "bg-green-50 border border-green-200"
          }`}
        >
          <p
            className={
              message.includes("Error") ? "text-red-800" : "text-green-800"
            }
          >
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
