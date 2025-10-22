"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";

export default function TenantRunningBalance() {
  const { selectedProperty } = useProperty();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (selectedProperty) {
      loadRunningBalance(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadRunningBalance = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      // TODO: Implement running balance loading logic
      console.log("Loading running balance for property:", propertyId);

      // Placeholder for now
      setMessage("Running Balance feature coming soon!");
    } catch (error) {
      console.error("Error loading running balance:", error);
      setMessage("Error loading running balance");
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Running Balance</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to view running balance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Running Balance for {selectedProperty.name}
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading running balance...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Current Balance</h2>
          <p className="text-gray-600">{message}</p>
        </div>
      )}
    </div>
  );
}
