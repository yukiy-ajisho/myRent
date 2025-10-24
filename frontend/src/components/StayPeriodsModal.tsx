"use client";

import { useState, useEffect, useCallback } from "react";
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

interface StayPeriodsModalProps {
  property: Property;
  tenant: Tenant;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface StayRecord {
  user_id: string;
  start_date: string | null;
  end_date: string | null;
}

export default function StayPeriodsModal({
  property,
  tenant,
  isOpen,
  onClose,
  onSave,
}: StayPeriodsModalProps) {
  const [stayRecord, setStayRecord] = useState<StayRecord | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadStayData = useCallback(async () => {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await api.getStayData(property.property_id);

      // 現在のテナントのstay recordを探す
      const tenantStayRecord = data.stayRecords.find(
        (record: StayRecord) => record.user_id === tenant.user_id
      );

      if (tenantStayRecord) {
        setStayRecord(tenantStayRecord);
        setStartDate(tenantStayRecord.start_date || "");
        setEndDate(tenantStayRecord.end_date || "");
      } else {
        setStayRecord(null);
        setStartDate("");
        setEndDate("");
      }
    } catch (error) {
      console.error("Error loading stay data:", error);
      setMessage("Error loading stay data");
    } finally {
      setIsLoading(false);
    }
  }, [property.property_id, tenant.user_id]);

  // モーダルが開かれた時にデータを読み込み
  useEffect(() => {
    console.log("=== StayPeriodsModal useEffect DEBUG ===");
    console.log("isOpen:", isOpen);
    console.log("property:", property);
    console.log("property.property_id:", property.property_id);
    console.log("tenant:", tenant);
    console.log("tenant.user_id:", tenant.user_id);

    if (isOpen) {
      loadStayData();
    }
  }, [isOpen, loadStayData]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage("");

      console.log("=== StayPeriodsModal DEBUG ===");
      console.log("property:", property);
      console.log("property.property_id:", property.property_id);
      console.log("tenant:", tenant);
      console.log("startDate:", startDate);
      console.log("endDate:", endDate);

      // 日付の検証
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        setMessage("Start date must be before end date");
        return;
      }

      // Stay periodsのデータを準備
      const stayPeriods = [
        {
          user_id: tenant.user_id,
          start_date: startDate || null,
          end_date: endDate || null,
        },
      ];

      console.log("Calling api.saveStayPeriods with:", {
        propertyId: property.property_id,
        data: { stayPeriods },
      });

      await api.saveStayPeriods({
        propertyId: property.property_id,
        stayPeriods: stayPeriods.reduce((acc, period) => {
          acc[period.user_id] = {
            startDate: period.start_date || "",
            endDate: period.end_date,
          };
          return acc;
        }, {} as Record<string, { startDate: string; endDate: string | null }>),
        breakPeriods: {},
      });

      setMessage("Stay periods saved successfully!");

      // 2秒後にモーダルを閉じる
      setTimeout(() => {
        onClose();
        onSave?.(); // 親コンポーネントに保存完了を通知
      }, 2000);
    } catch (error) {
      console.error("Error saving stay periods:", error);
      setMessage("Error saving stay periods");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // 元のデータに戻す
    if (stayRecord) {
      setStartDate(stayRecord.start_date || "");
      setEndDate(stayRecord.end_date || "");
    } else {
      setStartDate("");
      setEndDate("");
    }
    setMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Edit Stay Periods - {tenant.name}
        </h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Start Date (Commencement Date)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                End Date (Expiration Date)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

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
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
