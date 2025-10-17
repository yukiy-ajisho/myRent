"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
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
  const { selectedProperty } = useProperty();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (selectedProperty) {
      loadPayments(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadPayments = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== PAYMENT DEBUG ===");
      console.log("Property ID:", propertyId);
      console.log("Starting API call...");

      const data = await api.getPayments(propertyId);
      console.log("API Response received:", data);

      const payments = data.payments || [];
      console.log("Payments from API:", payments);
      console.log("Number of payments:", payments.length);
      payments.forEach((payment, index) => {
        console.log(`Payment ${index + 1}:`, {
          id: payment.payment_id,
          name: payment.app_user?.name,
          amount: payment.amount,
          isAccepted: payment.isAccepted,
        });
      });

      setPayments(payments);
    } catch (error) {
      console.error("Error loading payments:", error);
      setMessage("Error loading payments");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptPayment = async (paymentId: string) => {
    try {
      console.log("=== FRONTEND PAYMENT ACCEPT ===");
      console.log("Accepting payment:", paymentId);

      const response = await api.acceptPayment(paymentId);
      console.log("Accept response:", response);

      setMessage("Payment accepted successfully!");

      // Reload payments to update status
      if (selectedProperty) {
        loadPayments(selectedProperty.property_id);
      }
    } catch (error) {
      console.error("Error accepting payment:", error);
      setMessage("Error occurred while accepting payment");
    }
  };

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Payments</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to view payments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Payments for {selectedProperty.name}
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading payments...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600 text-lg">
                No payment data found for this property.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Payment reports will appear here when tenants submit them.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {payments.map((payment) => (
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
