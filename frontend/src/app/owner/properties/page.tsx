"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Property {
  property_id: string;
  name: string;
  active: boolean;
  address: string;
  tenants: string[];
}

interface TenantRent {
  user_id: string;
  property_id: string;
  monthly_rent: number;
}

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  user_type: string;
}

interface RentData {
  tenants: Tenant[];
  tenantRents: TenantRent[];
}

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 家賃データ管理
  const [rentData, setRentData] = useState<Record<string, RentData>>({});
  const [currentRents, setCurrentRents] = useState<
    Record<string, Record<string, number>>
  >({});
  const [saveStatus, setSaveStatus] = useState<
    Record<string, "saving" | "saved" | "error">
  >({});

  // プロパティ作成フォーム関連の状態
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProperties = useCallback(async () => {
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

      // 各プロパティの家賃データを取得
      for (const property of data.properties) {
        await loadRentData(property.property_id);
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      setMessage("Error loading properties");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const loadRentData = async (propertyId: string) => {
    try {
      const data = await api.getRentData(propertyId);

      setRentData((prev) => ({
        ...prev,
        [propertyId]: data,
      }));

      // 家賃情報を設定
      const rents: Record<string, number> = {};
      data.tenantRents.forEach((rent: TenantRent) => {
        rents[rent.user_id] = rent.monthly_rent;
      });

      // テナントがいるが家賃設定がない場合は0で初期化
      data.tenants.forEach((tenant: Tenant) => {
        if (!(tenant.user_id in rents)) {
          rents[tenant.user_id] = 0;
        }
      });

      setCurrentRents((prev) => ({
        ...prev,
        [propertyId]: rents,
      }));
    } catch (error) {
      console.error(
        `Error loading rent data for property ${propertyId}:`,
        error
      );
    }
  };

  // デバウンス付きの保存関数
  const debouncedSave = useCallback(
    (propertyId: string, userId: string, rent: number) => {
      const timeouts: Record<string, NodeJS.Timeout> = {};

      // 既存のタイムアウトをクリア
      if (timeouts[`${propertyId}-${userId}`]) {
        clearTimeout(timeouts[`${propertyId}-${userId}`]);
      }

      // 保存ステータスを設定
      setSaveStatus((prev) => ({
        ...prev,
        [`${propertyId}-${userId}`]: "saving",
      }));

      // 500ms後に保存実行
      timeouts[`${propertyId}-${userId}`] = setTimeout(async () => {
        try {
          await api.saveRent({
            property_id: propertyId,
            rent_amounts: { [userId]: rent },
          });

          setSaveStatus((prev) => ({
            ...prev,
            [`${propertyId}-${userId}`]: "saved",
          }));

          // 2秒後にステータスをクリア
          setTimeout(() => {
            setSaveStatus((prev) => {
              const newStatus = { ...prev };
              delete newStatus[`${propertyId}-${userId}`];
              return newStatus;
            });
          }, 2000);
        } catch (error) {
          console.error("Error saving rent:", error);
          setSaveStatus((prev) => ({
            ...prev,
            [`${propertyId}-${userId}`]: "error",
          }));
        }
      }, 500);
    },
    []
  );

  const handleRentChange = (
    propertyId: string,
    userId: string,
    value: string
  ) => {
    // 数値以外の文字を削除（小数点と数字のみ許可）
    const numericValue = value.replace(/[^0-9.]/g, "");

    // 複数の小数点を防ぐ
    const parts = numericValue.split(".");
    const cleanValue =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : numericValue;

    // 空文字列の場合は0に設定
    const finalValue = cleanValue === "" ? "0" : cleanValue;

    const rent = parseFloat(finalValue) || 0;

    // 現在の家賃を更新
    setCurrentRents((prev) => ({
      ...prev,
      [propertyId]: {
        ...prev[propertyId],
        [userId]: rent,
      },
    }));

    // デバウンス付きで保存
    debouncedSave(propertyId, userId, rent);
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

  const getSaveStatusIcon = (propertyId: string, userId: string) => {
    const status = saveStatus[`${propertyId}-${userId}`];
    switch (status) {
      case "saving":
        return <span className="text-blue-500 text-xs">Saving...</span>;
      case "saved":
        return <span className="text-green-500 text-xs">✓ Saved</span>;
      case "error":
        return <span className="text-red-500 text-xs">✗ Error</span>;
      default:
        return null;
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
                          Tenants (
                          {rentData[property.property_id]?.tenants?.length || 0}
                          ):
                        </p>
                        {rentData[property.property_id]?.tenants?.length > 0 ? (
                          <div className="space-y-2">
                            {rentData[property.property_id].tenants.map(
                              (tenant) => (
                                <div
                                  key={tenant.user_id}
                                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                                >
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {tenant.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {tenant.email}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center">
                                      <span className="text-sm text-gray-700 mr-2">
                                        $
                                      </span>
                                      <input
                                        type="text"
                                        value={
                                          currentRents[property.property_id]?.[
                                            tenant.user_id
                                          ] || 0
                                        }
                                        onChange={(e) =>
                                          handleRentChange(
                                            property.property_id,
                                            tenant.user_id,
                                            e.target.value
                                          )
                                        }
                                        onInput={(e) => {
                                          const target =
                                            e.target as HTMLInputElement;
                                          const value = target.value;
                                          // 先頭の0を削除（例: "0200" → "200"）
                                          const cleanValue =
                                            value.replace(/^0+/, "") || "0";
                                          if (value !== cleanValue) {
                                            target.value = cleanValue;
                                            handleRentChange(
                                              property.property_id,
                                              tenant.user_id,
                                              cleanValue
                                            );
                                          }
                                        }}
                                        className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </div>
                                    <div className="w-16">
                                      {getSaveStatusIcon(
                                        property.property_id,
                                        tenant.user_id
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
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
