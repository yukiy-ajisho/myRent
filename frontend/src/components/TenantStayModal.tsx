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

interface TenantStayModalProps {
  property: Property;
  tenant: Tenant;
  isOpen: boolean;
  onClose: () => void;
}

export default function TenantStayModal({
  property,
  tenant,
  isOpen,
  onClose,
}: TenantStayModalProps) {
  const [, setStayRecord] = useState<StayRecord | null>(null);
  const [, setBreakRecords] = useState<BreakRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [stayPeriod, setStayPeriod] = useState<StayPeriod>({
    startDate: "",
    endDate: "",
  });
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriod[]>([]);
  const [originalStayPeriod, setOriginalStayPeriod] = useState<StayPeriod>({
    startDate: "",
    endDate: "",
  });
  const [originalBreakPeriods, setOriginalBreakPeriods] = useState<
    BreakPeriod[]
  >([]);

  // モーダルが開かれた時の処理
  useEffect(() => {
    if (property && tenant && isOpen) {
      loadStayData(property.property_id, tenant.user_id);
    }
  }, [property, tenant, isOpen]);

  const loadStayData = async (propertyId: string, userId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== TENANT STAY MODAL DEBUG ===");
      console.log("Property ID:", propertyId);
      console.log("Tenant ID:", userId);

      const data = await api.getStayData(propertyId);
      console.log("API Response received:", data);

      const stayRecords = data.stayRecords || [];
      const breakRecords = data.breakRecords || [];

      // 特定のテナントのStay記録を取得
      const tenantStayRecord = stayRecords.find(
        (sr: StayRecord) => sr.user_id === userId
      );
      const tenantBreakRecords = breakRecords.filter(
        (br: BreakRecord) => br.stay_record.user_id === userId
      );

      console.log("Tenant Stay Record:", tenantStayRecord);
      console.log("Tenant Break Records:", tenantBreakRecords);

      setStayRecord(tenantStayRecord || null);
      setBreakRecords(tenantBreakRecords);

      // Initialize edit state
      const initialStayPeriod: StayPeriod = {
        startDate: tenantStayRecord?.start_date
          ? tenantStayRecord.start_date.split("T")[0]
          : "",
        endDate: tenantStayRecord?.end_date
          ? tenantStayRecord.end_date.split("T")[0]
          : "",
      };

      const initialBreakPeriods: BreakPeriod[] = tenantBreakRecords.map(
        (br: BreakRecord) => ({
          breakStart: br.break_start.split("T")[0],
          breakEnd: br.break_end.split("T")[0],
        })
      );

      setStayPeriod(initialStayPeriod);
      setBreakPeriods(initialBreakPeriods);
      setOriginalStayPeriod({ ...initialStayPeriod });
      setOriginalBreakPeriods([...initialBreakPeriods]);
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      console.error("Error loading stay data:", error);
      setMessage("Error loading stay data");
    } finally {
      setIsLoading(false);
    }
  };

  // Edit functions
  const handleStartDateChange = (value: string) => {
    setStayPeriod((prev) => ({
      ...prev,
      startDate: value,
    }));
    setHasChanges(true);
  };

  const handleEndDateChange = (value: string) => {
    setStayPeriod((prev) => ({
      ...prev,
      endDate: value,
    }));
    setHasChanges(true);
  };

  const handleBreakStartChange = (breakIndex: number, value: string) => {
    setBreakPeriods((prev) =>
      prev.map((bp, index) =>
        index === breakIndex ? { ...bp, breakStart: value } : bp
      )
    );
    setHasChanges(true);
  };

  const handleBreakEndChange = (breakIndex: number, value: string) => {
    setBreakPeriods((prev) =>
      prev.map((bp, index) =>
        index === breakIndex ? { ...bp, breakEnd: value } : bp
      )
    );
    setHasChanges(true);
  };

  const addBreakPeriod = () => {
    setBreakPeriods((prev) => [...prev, { breakStart: "", breakEnd: "" }]);
    setHasChanges(true);
  };

  const removeBreakPeriod = (index: number) => {
    setBreakPeriods((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges || !property || !tenant) return;

    try {
      setIsLoading(true);
      setMessage("");

      // 全テナントのStay期間を構築（現在のテナントのみ更新）
      const allStayPeriods: Record<
        string,
        { startDate: string; endDate: string | null }
      > = {};
      allStayPeriods[tenant.user_id] = {
        startDate: stayPeriod.startDate || "",
        endDate: stayPeriod.endDate,
      };

      // 全テナントのBreak期間を構築（現在のテナントのみ更新）
      const allBreakPeriods: Record<
        string,
        { breakStart: string; breakEnd: string }[]
      > = {};
      allBreakPeriods[tenant.user_id] = breakPeriods.map((bp) => ({
        breakStart: bp.breakStart || "",
        breakEnd: bp.breakEnd || "",
      }));

      await api.saveStayPeriods({
        propertyId: property.property_id,
        stayPeriods: allStayPeriods,
        breakPeriods: allBreakPeriods,
      });

      setOriginalStayPeriod({ ...stayPeriod });
      setOriginalBreakPeriods([...breakPeriods]);
      setHasChanges(false);
      setIsEditing(false);
      setMessage("Stay periods saved successfully!");
    } catch (error) {
      console.error("Error saving stay periods:", error);
      setMessage("Error saving stay periods");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStayPeriod({ ...originalStayPeriod });
    setBreakPeriods([...originalBreakPeriods]);
    setHasChanges(false);
    setIsEditing(false);
    setMessage("");
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Stay Management - {tenant.name}
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
              {/* Stay Period */}
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Stay Period
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={stayPeriod.startDate || ""}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={stayPeriod.endDate || ""}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      disabled={!isEditing}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Break Periods */}
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Break Periods
                  </h3>
                  {isEditing && (
                    <button
                      onClick={addBreakPeriod}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Add Break
                    </button>
                  )}
                </div>

                {breakPeriods.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No break periods set.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {breakPeriods.map((breakPeriod, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Break Start
                            </label>
                            <input
                              type="date"
                              value={breakPeriod.breakStart || ""}
                              onChange={(e) =>
                                handleBreakStartChange(index, e.target.value)
                              }
                              disabled={!isEditing}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Break End
                            </label>
                            <input
                              type="date"
                              value={breakPeriod.breakEnd || ""}
                              onChange={(e) =>
                                handleBreakEndChange(index, e.target.value)
                              }
                              disabled={!isEditing}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                        {isEditing && (
                          <button
                            onClick={() => removeBreakPeriod(index)}
                            className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || isLoading}
                      className={`px-6 py-2 rounded-md font-medium ${
                        hasChanges && !isLoading
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isLoading ? "Saving..." : "Save Changes"}
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
                  </>
                )}
              </div>

              {/* Message */}
              {message && (
                <div
                  className={`mt-4 p-4 rounded-md ${
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
