"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";

export default function TenantPayment() {
  const { selectedProperty } = useProperty();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (selectedProperty) {
      loadPaymentInfo(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadPaymentInfo = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      // TODO: Implement payment info loading logic
      console.log("Loading payment info for property:", propertyId);

      // Placeholder for now
      setMessage("Payment feature coming soon!");
    } catch (error) {
      console.error("Error loading payment info:", error);
      setMessage("Error loading payment information");
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Payment</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to view payment information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Payment for {selectedProperty.name}
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading payment information...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Payment Information Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
            <p className="text-gray-600">{message}</p>
          </div>

          {/* Payment Methods Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Methods</h2>
            <p className="text-gray-600">
              Payment methods feature coming soon!
            </p>
          </div>

          {/* Payment History Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
            <p className="text-gray-600">
              Recent payments feature coming soon!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
