"use client";

import { useState, useEffect } from "react";
import { useProperty, Property } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  user_type: string;
  personal_multiplier: number;
  property_id: string;
  property_name: string;
}

export default function Tenants() {
  const { userProperties } = useProperty();
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // フォーム関連の状態
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [addedTenantName, setAddedTenantName] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    propertyId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 初期データ読み込み
  useEffect(() => {
    fetchAllTenants();
  }, []);

  const fetchAllTenants = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== TENANTS DEBUG ===");
      console.log("Fetching all tenants...");

      const data = await api.getAllRentData();
      console.log("API Response received:", data);

      const tenants = data.tenants || [];
      console.log("All tenants from API:", tenants);

      setAllTenants(tenants);
    } catch (error) {
      console.error("Error loading tenants:", error);
      setMessage("Error loading tenants");
    } finally {
      setIsLoading(false);
    }
  };

  // プロパティ選択変更
  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    if (propertyId === "") {
      setSelectedProperty(null);
    } else {
      const property = userProperties.find(
        (p) => p.property_id.toString() === propertyId
      );
      setSelectedProperty(property || null);
    }
  };

  // フィルタリングされたテナントデータ
  const filteredTenants = selectedProperty
    ? allTenants.filter(
        (tenant) => tenant.property_id === selectedProperty.property_id
      )
    : allTenants;

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!formData.email.trim()) {
      setMessage("Please enter an email address");
      return;
    }

    if (!formData.propertyId) {
      setMessage("Please select a property");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await api.addTenant({
        email: formData.email,
        propertyId: parseInt(formData.propertyId),
      });

      // 成功時：テナント名を取得して成功画面を表示
      setAddedTenantName(response.tenantName || "Unknown");
      setShowSuccess(true);
      setFormData({ email: "", propertyId: "" });

      // 全テナント一覧を再読み込み
      fetchAllTenants();
    } catch (error: any) {
      // バックエンドからのエラーメッセージを取得
      let errorMessage = "Error: Failed to add tenant";

      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (
        error?.message &&
        !error.message.includes("API request failed")
      ) {
        errorMessage = error.message;
      }

      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccess(false);
    setShowForm(false);
    setAddedTenantName("");
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Tenants{selectedProperty ? ` for ${selectedProperty.name}` : ""}
        </h1>

        <div className="flex items-center gap-4">
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

          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Tenant
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading tenants...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTenants.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600">
                No tenants found
                {selectedProperty ? ` for ${selectedProperty.name}` : ""}.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTenants.map((tenant) => (
                <div
                  key={`${tenant.user_id}-${tenant.property_id}`}
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {tenant.property_name}
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

      {/* テナント追加フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            {showSuccess ? (
              // 成功画面
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-xl font-bold mb-4 text-green-600">
                  <span className="bg-green-100 px-2 py-1 rounded font-bold text-green-800">
                    {addedTenantName}
                  </span>{" "}
                  is added!
                </h2>
                <p className="text-gray-600 mb-6">
                  The tenant has been successfully added to the property.
                </p>
                <button
                  onClick={handleSuccessConfirm}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Confirm
                </button>
              </div>
            ) : (
              // フォーム画面
              <>
                <h2 className="text-xl font-bold mb-4">Add Tenant</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Search for a tenant by email address. If found, they will be
                  added to the selected property.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Email
                    </label>
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
                      Property
                    </label>
                    <select
                      value={formData.propertyId}
                      onChange={(e) =>
                        setFormData({ ...formData, propertyId: e.target.value })
                      }
                      className="w-full p-2 border rounded"
                      required
                    >
                      <option value="">Select Property</option>
                      {userProperties.map((property) => (
                        <option
                          key={property.property_id}
                          value={property.property_id}
                        >
                          {property.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {message && (
                    <div
                      className={`mb-4 p-3 rounded-md ${
                        message.includes("Error") ||
                        message.includes("not found") ||
                        message.includes("already exists") ||
                        message.includes("Cannot add")
                          ? "bg-red-50 border border-red-200"
                          : "bg-green-50 border border-green-200"
                      }`}
                    >
                      <p
                        className={
                          message.includes("Error") ||
                          message.includes("not found") ||
                          message.includes("already exists") ||
                          message.includes("Cannot add")
                            ? "text-red-800"
                            : "text-green-800"
                        }
                      >
                        {message}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                    >
                      {isSubmitting ? "Adding..." : "Add Tenant"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setShowSuccess(false);
                        setFormData({ email: "", propertyId: "" });
                        setMessage("");
                        setAddedTenantName("");
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
