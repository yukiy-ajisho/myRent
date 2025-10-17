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

  // フォーム関連の状態
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    personal_multiplier: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      await api.addTenant({
        name: formData.name,
        email: formData.email,
        personal_multiplier: formData.personal_multiplier,
        propertyId: selectedProperty.property_id,
      });

      setMessage("Tenant added successfully!");
      setFormData({ name: "", email: "", personal_multiplier: 1 });
      setShowForm(false);

      // テナント一覧を再読み込み
      loadTenants(selectedProperty.property_id);
    } catch (error) {
      console.error("Error adding tenant:", error);
      setMessage("Error adding tenant");
    } finally {
      setIsSubmitting(false);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Tenants for {selectedProperty.name}
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Tenant
        </button>
      </div>

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

      {/* テナント追加フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">
              Create New Tenant / Add Existing Tenant
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter tenant name"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter tenant email"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Personal Multiplier
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={formData.personal_multiplier}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal_multiplier: parseInt(e.target.value) || 1,
                    })
                  }
                  placeholder="1"
                  className="w-full p-2 border rounded"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Multiplier for utility cost calculation (1 - 10)
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
