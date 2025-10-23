"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Property {
  property_id: string;
  name: string;
  timezone: string;
  active: boolean;
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

interface RentManagerModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export default function RentManagerModal({
  property,
  isOpen,
  onClose,
}: RentManagerModalProps) {
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
    if (property && isOpen) {
      loadRentData(property.property_id);
    }
  }, [property, isOpen]);

  const loadRentData = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await api.getRentData(propertyId);

      // テナント情報を設定
      setTenants(data.tenants || []);

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

      setOriginalRents({ ...rents });
      setCurrentRents({ ...rents });
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading rent data:", error);
      setMessage("Error loading rent data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRentChange = (userId: string, value: string) => {
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
    setCurrentRents((prev) => ({
      ...prev,
      [userId]: rent,
    }));
  };

  const handleSave = async () => {
    if (!hasChanges || !property) return;

    try {
      setIsSaving(true);
      setMessage("");

      // 変更された家賃のみを抽出
      const changedRents: Record<string, number> = {};
      Object.keys(currentRents).forEach((userId) => {
        if (currentRents[userId] !== originalRents[userId]) {
          changedRents[userId] = currentRents[userId];
        }
      });

      if (Object.keys(changedRents).length > 0) {
        await api.saveRent({
          property_id: property.property_id,
          rent_amounts: changedRents,
        });
      }

      setOriginalRents({ ...currentRents });
      setHasChanges(false);
      setMessage("Rent amounts saved successfully!");
    } catch (error) {
      console.error("Error saving rent data:", error);
      setMessage("Error saving rent data");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrentRents({ ...originalRents });
    setHasChanges(false);
    setMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Rent Manager for {property.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading rent data...</div>
            </div>
          ) : (
            <>
              {/* 家賃設定 */}
              <div className="bg-white shadow rounded-lg p-6 mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-6">
                  Monthly Rent Amounts
                </h3>

                {tenants.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No tenants found for this property.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tenants.map((tenant) => (
                      <div
                        key={tenant.user_id}
                        className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {tenant.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {tenant.email}
                          </div>
                        </div>
                        <div className="flex-1 max-w-xs">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-700 mr-2">
                              $
                            </span>
                            <input
                              type="text"
                              value={currentRents[tenant.user_id] || 0}
                              onChange={(e) =>
                                handleRentChange(tenant.user_id, e.target.value)
                              }
                              onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                const value = target.value;
                                // 先頭の0を削除（例: "0200" → "200"）
                                const cleanValue =
                                  value.replace(/^0+/, "") || "0";
                                if (value !== cleanValue) {
                                  target.value = cleanValue;
                                  handleRentChange(tenant.user_id, cleanValue);
                                }
                              }}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ボタン */}
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
              </div>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
