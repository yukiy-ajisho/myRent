"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

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

export default function RentManager() {
  const { selectedProperty } = useProperty();
  const [originalRents, setOriginalRents] = useState<Record<string, number>>(
    {}
  );
  const [currentRents, setCurrentRents] = useState<Record<string, number>>({});
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 変更検知
  useEffect(() => {
    const changed = Object.keys(currentRents).some(
      (userId) => currentRents[userId] !== originalRents[userId]
    );
    setHasChanges(changed);
  }, [currentRents, originalRents]);

  // プロパティが変更された時の処理
  useEffect(() => {
    if (selectedProperty) {
      loadRentData(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadRentData = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== RENT MANAGER DEBUG ===");
      console.log("Property ID:", propertyId);
      console.log("Property ID type:", typeof propertyId);
      console.log("Starting API call...");

      // プロパティ固有のデータを取得（Historyページと同じ方法）
      const data = await api.getRentData(propertyId);
      console.log("API Response received:", data);
      console.log("API Response keys:", Object.keys(data));
      console.log("tenants in response:", data.tenants);
      console.log("tenantRents in response:", data.tenantRents);

      // テナント情報と家賃データを取得
      const tenants = data.tenants || [];
      const tenantRents = data.tenantRents || [];

      console.log("Tenants from API:", tenants);
      console.log("Tenant Rents from API:", tenantRents);

      console.log("Setting tenants:", tenants);
      setTenants(tenants);

      // 家賃データを抽出
      const rents: Record<string, number> = {};
      tenants.forEach((tenant: Tenant) => {
        const existingRent = tenantRents.find(
          (rent: TenantRent) =>
            rent.user_id === tenant.user_id &&
            String(rent.property_id) === String(propertyId)
        );
        rents[tenant.user_id] = existingRent ? existingRent.monthly_rent : 0;
        console.log(`Tenant ${tenant.name}: rent=${rents[tenant.user_id]}`);
      });

      console.log("Final rents object:", rents);
      setOriginalRents({ ...rents });
      setCurrentRents({ ...rents });
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading rent data:", error);
      console.error("Error details:", error);
      setMessage("Error loading rent data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRentChange = (userId: string, amount: string) => {
    const numericAmount = parseFloat(amount) || 0;
    setCurrentRents((prev) => ({
      ...prev,
      [userId]: numericAmount,
    }));
  };

  const handleSave = async () => {
    if (!hasChanges || !selectedProperty) return;

    try {
      setIsSaving(true);
      setMessage("");

      // 変更された家賃のみを抽出（0より大きい値のみ）
      const validRents = Object.entries(currentRents).reduce(
        (acc, [userId, amount]) => {
          if (amount > 0) {
            acc[userId] = amount;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      if (Object.keys(validRents).length > 0) {
        await api.saveRent({
          property_id: selectedProperty.property_id,
          rent_amounts: validRents,
        });
      }

      setOriginalRents({ ...currentRents });
      setHasChanges(false);
      setMessage("Rent amounts saved successfully!");
    } catch (error) {
      console.error("Error saving rent amounts:", error);
      setMessage("Error saving rent amounts");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrentRents({ ...originalRents });
    setHasChanges(false);
    setMessage("");
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading rent data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Rent Manager</h1>

        {/* 家賃設定 */}
        {selectedProperty && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-6">
              Monthly Rent for {selectedProperty.name}
            </h2>

            {tenants.length > 0 ? (
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.user_id}
                    className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex-1">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {tenant.name}
                        </span>
                        {/* <span className="text-sm text-gray-500">
                          {tenant.email}
                        </span> */}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={currentRents[tenant.user_id] || ""}
                        onChange={(e) =>
                          handleRentChange(tenant.user_id, e.target.value)
                        }
                        placeholder="0.00"
                        className="w-32 border border-gray-300 rounded-md px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No tenants found for this property.
              </div>
            )}

            {/* ボタン */}
            {tenants.length > 0 && (
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={`px-6 py-2 rounded-md font-medium ${
                    hasChanges && !isSaving
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!hasChanges}
                  className={`px-6 py-2 rounded-md font-medium ${
                    hasChanges
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* メッセージ */}
        {message && (
          <div
            className={`p-4 rounded-md ${
              message.includes("Error")
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-green-50 border border-green-200 text-green-800"
            }`}
          >
            {message}
          </div>
        )}

        {/* プロパティが選択されていない場合 */}
        {!selectedProperty && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center text-gray-500">
              Please select a property to manage rent amounts.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
