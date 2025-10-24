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

interface BreakModalProps {
  property: Property;
  tenant: Tenant;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface BreakRecord {
  user_id: string;
  start_date: string;
  end_date: string;
}

export default function BreakModal({
  property,
  tenant,
  isOpen,
  onClose,
  onSave,
}: BreakModalProps) {
  const [breakRecords, setBreakRecords] = useState<BreakRecord[]>([]);
  const [existingStayPeriods, setExistingStayPeriods] = useState<
    Record<string, { startDate: string; endDate: string | null }>
  >({});
  const [newBreak, setNewBreak] = useState({
    start_date: "",
    end_date: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // モーダルが開かれた時にデータを読み込み
  useEffect(() => {
    if (isOpen) {
      loadBreakData();
    }
  }, [isOpen, property.property_id, tenant.user_id]);

  const loadBreakData = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await api.getStayData(property.property_id);

      // 現在のテナントのbreak recordsを取得
      const tenantBreakRecords = data.breakRecords.filter(
        (record: BreakRecord) => record.user_id === tenant.user_id
      );

      // 既存のstay_periodsを保存
      const stayPeriods: Record<
        string,
        { startDate: string; endDate: string | null }
      > = {};
      data.stayRecords.forEach((record: any) => {
        stayPeriods[record.user_id] = {
          startDate: record.start_date || "",
          endDate: record.end_date,
        };
      });

      setBreakRecords(tenantBreakRecords);
      setExistingStayPeriods(stayPeriods);
    } catch (error) {
      console.error("Error loading break data:", error);
      setMessage("Error loading break data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBreak = () => {
    setNewBreak({
      start_date: "",
      end_date: "",
    });
    setShowAddForm(true);
  };

  const handleSaveBreak = async () => {
    try {
      setIsSaving(true);
      setMessage("");

      // 日付の検証
      if (!newBreak.start_date || !newBreak.end_date) {
        setMessage("Please fill in both start and end dates");
        return;
      }

      if (new Date(newBreak.start_date) > new Date(newBreak.end_date)) {
        setMessage("Start date must be before end date");
        return;
      }

      // 新しいbreak recordを追加
      const updatedBreakRecords = [
        ...breakRecords,
        {
          user_id: tenant.user_id,
          start_date: newBreak.start_date,
          end_date: newBreak.end_date,
        },
      ];

      // Stay periodsは既存のものを保持（Break periodsのみを更新）
      await api.saveStayPeriods({
        propertyId: property.property_id,
        stayPeriods: existingStayPeriods, // 既存のstay_periodsを保持
        breakPeriods: updatedBreakRecords.reduce((acc, period) => {
          if (!acc[period.user_id]) {
            acc[period.user_id] = [];
          }
          acc[period.user_id].push({
            breakStart: period.start_date,
            breakEnd: period.end_date,
          });
          return acc;
        }, {} as Record<string, Array<{ breakStart: string; breakEnd: string }>>),
      });

      setBreakRecords(updatedBreakRecords);
      setNewBreak({
        start_date: "",
        end_date: "",
      });
      setShowAddForm(false);
      setMessage("Break period added successfully!");

      // 親コンポーネントに保存完了を通知
      onSave?.();
    } catch (error) {
      console.error("Error saving break period:", error);
      setMessage("Error saving break period");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBreak = async (index: number) => {
    try {
      setIsSaving(true);
      setMessage("");

      const updatedBreakRecords = breakRecords.filter((_, i) => i !== index);

      // Stay periodsは既存のものを保持（Break periodsのみを更新）
      await api.saveStayPeriods({
        propertyId: property.property_id,
        stayPeriods: existingStayPeriods, // 既存のstay_periodsを保持
        breakPeriods: updatedBreakRecords.reduce((acc, period) => {
          if (!acc[period.user_id]) {
            acc[period.user_id] = [];
          }
          acc[period.user_id].push({
            breakStart: period.start_date,
            breakEnd: period.end_date,
          });
          return acc;
        }, {} as Record<string, Array<{ breakStart: string; breakEnd: string }>>),
      });

      setBreakRecords(updatedBreakRecords);
      setMessage("Break period deleted successfully!");

      // 親コンポーネントに保存完了を通知
      onSave?.();
    } catch (error) {
      console.error("Error deleting break period:", error);
      setMessage("Error deleting break period");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNewBreak({
      start_date: "",
      end_date: "",
    });
    setShowAddForm(false);
    setMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-[600px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Manage Break Periods - {tenant.name}
        </h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 既存のBreak Periods一覧 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Existing Break Periods
              </h3>
              {breakRecords.length === 0 ? (
                <p className="text-gray-500 text-sm">No break periods found</p>
              ) : (
                <div className="space-y-2">
                  {breakRecords.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded"
                    >
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-medium">
                            {record.start_date} to {record.end_date}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBreak(index)}
                        disabled={isSaving}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 新しいBreak Period追加フォーム */}
            {!showAddForm ? (
              <button
                onClick={handleAddBreak}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Add Break Period
              </button>
            ) : (
              <div className="border border-gray-200 p-4 rounded">
                <h4 className="text-md font-semibold mb-3">
                  Add New Break Period
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newBreak.start_date}
                      onChange={(e) =>
                        setNewBreak({ ...newBreak, start_date: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={newBreak.end_date}
                      onChange={(e) =>
                        setNewBreak({ ...newBreak, end_date: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveBreak}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {message && (
              <div
                className={`p-3 rounded-md ${
                  message.includes("Error")
                    ? "bg-red-50 border border-red-200 text-red-800"
                    : "bg-green-50 border border-green-200 text-green-800"
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
