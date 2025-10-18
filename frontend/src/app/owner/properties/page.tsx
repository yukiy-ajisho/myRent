"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Property {
  property_id: string;
  name: string;
  active: boolean;
  address: string;
  tenants: string[];
}

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // プロパティ作成フォーム関連の状態
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== PROPERTIES DEBUG ===");
      console.log("Loading properties...");

      const data = await api.getProperties();
      console.log("API Response received:", data);

      // データの検証
      if (!data.properties || !Array.isArray(data.properties)) {
        throw new Error("Invalid data format");
      }

      setProperties(data.properties);
      console.log("Properties loaded:", data.properties.length);
    } catch (error) {
      console.error("Error loading properties:", error);
      setMessage("Error loading properties");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.address.trim()) {
      setMessage("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      await api.createPropertyForOwner({
        name: formData.name.trim(),
        address: formData.address.trim(),
      });

      setMessage("Property created successfully!");
      setFormData({ name: "", address: "" });
      setShowForm(false);

      // プロパティ一覧を再読み込み
      loadProperties();
    } catch (error) {
      console.error("Error creating property:", error);
      setMessage("Error creating property");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Properties</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Create Property
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading properties...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600 text-lg">
                No properties found. Create your first property below.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {properties.map((property) => (
                <div
                  key={property.property_id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {property.name}
                      </h3>
                      <p className="text-gray-600 mt-1">{property.address}</p>
                      <div className="mt-2 flex gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            property.active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {property.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Tenants ({property.tenants.length}):
                        </p>
                        {property.tenants.length > 0 ? (
                          <div className="space-y-1">
                            {property.tenants.map((tenant, index) => (
                              <div
                                key={index}
                                className="text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded"
                              >
                                {tenant}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No tenants</p>
                        )}
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

      {/* プロパティ作成フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create New Property</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Property Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter property name"
                  className="w-full p-2 border rounded"
                  required
                  maxLength={100}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Enter property address"
                  className="w-full p-2 border rounded h-20 resize-none"
                  required
                  maxLength={200}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Property"}
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
