"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  user_type: string;
  personal_multiplier: number;
}

export default function Tenants() {
  const { selectedProperty } = useProperty();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // プロパティが変更された時の処理
  useEffect(() => {
    if (selectedProperty) {
      loadTenants(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadTenants = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== TENANTS DEBUG ===");
      console.log("Property ID:", propertyId);
      console.log("Starting API call...");

      // 既存のrent-data APIを使用してテナント情報を取得
      const data = await api.getRentData(propertyId);
      console.log("API Response received:", data);

      const tenants = data.tenants || [];
      console.log("Tenants from API:", tenants);

      setTenants(tenants);
    } catch (error) {
      console.error("Error loading tenants:", error);
      setMessage("Error loading tenants");
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Tenants</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to view tenants.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Tenants for {selectedProperty.name}
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading tenants...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600">
                No tenants found for this property.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {tenants.map((tenant) => (
                <div
                  key={tenant.user_id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {tenant.name}
                      </h3>
                      <p className="text-gray-600 mt-1">{tenant.email}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {tenant.user_type}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Multiplier: {tenant.personal_multiplier}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{message}</p>
        </div>
      )}
    </div>
  );
}
