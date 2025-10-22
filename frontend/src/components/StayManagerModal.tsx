"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Property {
  property_id: string;
  name: string;
  timezone: string;
  active: boolean;
}

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  user_type: string;
}

interface StayRecord {
  stay_id: string;
  user_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
}

interface BreakRecord {
  break_id: string;
  stay_id: string;
  break_start: string;
  break_end: string;
  stay_record: {
    user_id: string;
    property_id: string;
  };
}

interface StayPeriod {
  startDate: string | null;
  endDate: string | null;
}

interface BreakPeriod {
  breakStart: string | null;
  breakEnd: string | null;
}

interface StayManagerModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export default function StayManagerModal({
  property,
  isOpen,
  onClose,
}: StayManagerModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stayRecords, setStayRecords] = useState<StayRecord[]>([]);
  const [breakRecords, setBreakRecords] = useState<BreakRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // プロパティが変更された時の処理
  useEffect(() => {
    if (property && isOpen) {
      loadStayData(property.property_id);
    }
  }, [property, isOpen]);

  const loadStayData = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await api.getStayData(propertyId);

      setTenants(data.tenants || []);
      setStayRecords(data.stayRecords || []);
      setBreakRecords(data.breakRecords || []);
    } catch (error) {
      console.error("Error loading stay data:", error);
      setMessage("Error loading stay data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      // 滞在期間データを準備
      const stayPeriods: Record<string, StayPeriod> = {};
      const breakPeriods: Record<string, BreakPeriod[]> = {};

      // 各テナントの滞在期間を設定
      tenants.forEach((tenant) => {
        const stayRecord = stayRecords.find(
          (record) => record.user_id === tenant.user_id
        );
        if (stayRecord) {
          stayPeriods[tenant.user_id] = {
            startDate: stayRecord.start_date,
            endDate: stayRecord.end_date,
          };
        } else {
          stayPeriods[tenant.user_id] = {
            startDate: null,
            endDate: null,
          };
        }

        // 休暇期間を設定
        const userBreakRecords = breakRecords.filter(
          (record) => record.stay_record.user_id === tenant.user_id
        );
        breakPeriods[tenant.user_id] = userBreakRecords.map((record) => ({
          breakStart: record.break_start,
          breakEnd: record.break_end,
        }));
      });

      await api.saveStayPeriods({
        propertyId: property.property_id,
        stayPeriods,
        breakPeriods,
      });

      setMessage("Stay periods saved successfully!");
    } catch (error) {
      console.error("Error saving stay periods:", error);
      setMessage("Error saving stay periods");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Stay Manager for {property.name}
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
              <div className="text-lg">Loading stay data...</div>
            </div>
          ) : (
            <>
              {/* 滞在期間管理 */}
              <div className="bg-white shadow rounded-lg p-6 mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-6">
                  Stay Periods
                </h3>

                {tenants.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No tenants found for this property.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tenants.map((tenant) => {
                      const stayRecord = stayRecords.find(
                        (record) => record.user_id === tenant.user_id
                      );
                      const userBreakRecords = breakRecords.filter(
                        (record) =>
                          record.stay_record.user_id === tenant.user_id
                      );

                      return (
                        <div
                          key={tenant.user_id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">
                                {tenant.name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {tenant.email}
                              </p>
                            </div>
                          </div>

                          {/* 滞在期間 */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Date
                              </label>
                              <input
                                type="date"
                                value={stayRecord?.start_date || ""}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Date
                              </label>
                              <input
                                type="date"
                                value={stayRecord?.end_date || ""}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                readOnly
                              />
                            </div>
                          </div>

                          {/* 休暇期間 */}
                          {userBreakRecords.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">
                                Break Periods
                              </h5>
                              <div className="space-y-2">
                                {userBreakRecords.map((breakRecord, index) => (
                                  <div
                                    key={breakRecord.break_id}
                                    className="flex gap-2 items-center"
                                  >
                                    <input
                                      type="date"
                                      value={breakRecord.break_start}
                                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      readOnly
                                    />
                                    <span className="text-gray-500">to</span>
                                    <input
                                      type="date"
                                      value={breakRecord.break_end}
                                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      readOnly
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ボタン */}
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className={`px-6 py-2 rounded-md font-medium ${
                      !isLoading
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {isLoading ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-md font-medium bg-gray-600 text-white hover:bg-gray-700"
                  >
                    Close
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
