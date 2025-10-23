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

  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [stayPeriods, setStayPeriods] = useState<Record<string, StayPeriod>>(
    {}
  );
  const [breakPeriods, setBreakPeriods] = useState<
    Record<string, BreakPeriod[]>
  >({});
  const [originalStayPeriods, setOriginalStayPeriods] = useState<
    Record<string, StayPeriod>
  >({});
  const [originalBreakPeriods, setOriginalBreakPeriods] = useState<
    Record<string, BreakPeriod[]>
  >({});

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

      console.log("=== STAY MANAGER MODAL DEBUG ===");
      console.log("Property ID:", propertyId);
      console.log("Starting API call...");

      const data = await api.getStayData(propertyId);
      console.log("API Response received:", data);

      const tenants = data.tenants || [];
      const stayRecords = data.stayRecords || [];
      const breakRecords = data.breakRecords || [];

      console.log("Tenants:", tenants);
      console.log("Stay Records:", stayRecords);
      console.log("Break Records:", breakRecords);

      setTenants(tenants);
      setStayRecords(stayRecords);
      setBreakRecords(breakRecords);

      // Initialize edit state
      const initialStayPeriods: Record<string, StayPeriod> = {};
      const initialBreakPeriods: Record<string, BreakPeriod[]> = {};

      tenants.forEach((tenant: Tenant) => {
        const stayRecord = stayRecords.find(
          (sr: StayRecord) => sr.user_id === tenant.user_id
        );
        initialStayPeriods[tenant.user_id] = {
          startDate: stayRecord?.start_date
            ? stayRecord.start_date.split("T")[0]
            : "",
          endDate: stayRecord?.end_date
            ? stayRecord.end_date.split("T")[0]
            : "",
        };

        const tenantBreakRecords = breakRecords.filter(
          (br: BreakRecord) => br.stay_record.user_id === tenant.user_id
        );
        initialBreakPeriods[tenant.user_id] = tenantBreakRecords.map(
          (br: BreakRecord) => ({
            breakStart: br.break_start.split("T")[0],
            breakEnd: br.break_end.split("T")[0],
          })
        );
      });

      setStayPeriods(initialStayPeriods);
      setBreakPeriods(initialBreakPeriods);
      setOriginalStayPeriods({ ...initialStayPeriods });
      setOriginalBreakPeriods({ ...initialBreakPeriods });
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      console.error("Error loading stay data:", error);
      setMessage("Error loading stay data");
    } finally {
      setIsLoading(false);
    }
  };

  const getBreakRecordsForTenant = (userId: string) => {
    return breakRecords.filter(
      (breakRecord) => breakRecord.stay_record.user_id === userId
    );
  };

  const getStayRecordForTenant = (userId: string) => {
    return stayRecords.find((stay) => stay.user_id === userId);
  };

  // Edit functions
  const handleStartDateChange = (userId: string, value: string) => {
    setStayPeriods((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], startDate: value },
    }));
    setHasChanges(true);
  };

  const handleEndDateChange = (userId: string, value: string) => {
    setStayPeriods((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], endDate: value },
    }));
    setHasChanges(true);
  };

  const handleBreakStartChange = (
    userId: string,
    breakIndex: number,
    value: string
  ) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]: prev[userId].map((bp, index) =>
        index === breakIndex ? { ...bp, breakStart: value } : bp
      ),
    }));
    setHasChanges(true);
  };

  const handleBreakEndChange = (
    userId: string,
    breakIndex: number,
    value: string
  ) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]: prev[userId].map((bp, index) =>
        index === breakIndex ? { ...bp, breakEnd: value } : bp
      ),
    }));
    setHasChanges(true);
  };

  const addBreakPeriod = (userId: string) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] || []), { breakStart: "", breakEnd: "" }],
    }));
    setHasChanges(true);
  };

  const removeBreakPeriod = (userId: string, breakIndex: number) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]: prev[userId].filter((_, index) => index !== breakIndex),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!property) return;

    try {
      setIsLoading(true);
      setMessage("");

      // Only send data for tenants with at least a start date
      const cleanedStayPeriods: Record<
        string,
        { startDate: string; endDate: string | null }
      > = {};
      const cleanedBreakPeriods: Record<
        string,
        Array<{ breakStart: string; breakEnd: string }>
      > = {};

      Object.entries(stayPeriods).forEach(([userId, period]) => {
        // Only include if start date is provided
        if (period.startDate) {
          cleanedStayPeriods[userId] = {
            startDate: period.startDate,
            endDate: period.endDate || null,
          };
        }
      });

      Object.entries(breakPeriods).forEach(([userId, periods]) => {
        // Only include break periods with both dates
        const validBreaks = periods.filter(
          (period) => period.breakStart && period.breakEnd
        );
        if (validBreaks.length > 0) {
          cleanedBreakPeriods[userId] = validBreaks.map((period) => ({
            breakStart: period.breakStart!,
            breakEnd: period.breakEnd!,
          }));
        }
      });

      await api.saveStayPeriods({
        propertyId: property.property_id,
        stayPeriods: cleanedStayPeriods,
        breakPeriods: cleanedBreakPeriods,
      });

      setMessage("Stay periods saved successfully!");
      setOriginalStayPeriods({ ...stayPeriods });
      setOriginalBreakPeriods({ ...breakPeriods });
      setHasChanges(false);
      setIsEditing(false);

      // Reload data to get updated records
      loadStayData(property.property_id);
    } catch (error) {
      console.error("Error saving stay periods:", error);
      setMessage("Error saving stay periods");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStayPeriods({ ...originalStayPeriods });
    setBreakPeriods({ ...originalBreakPeriods });
    setHasChanges(false);
    setIsEditing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Stay Manager for {property.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-lg">Loading...</div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Edit Stay Periods
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isLoading || !hasChanges}
                        className={`px-4 py-2 rounded-md font-medium ${
                          !isLoading && hasChanges
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {isLoading ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {tenants.map((tenant) => {
                  const userBreakRecords = getBreakRecordsForTenant(
                    tenant.user_id
                  );
                  const stayRecord = getStayRecordForTenant(tenant.user_id);
                  const currentStayPeriod = stayPeriods[tenant.user_id];
                  const currentBreakPeriods =
                    breakPeriods[tenant.user_id] || [];

                  return (
                    <div key={tenant.user_id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">{tenant.name}</h3>
                        <span className="text-sm text-gray-500">
                          {tenant.email}
                        </span>
                      </div>

                      {/* Stay Period */}
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-gray-700 mb-2">
                          Stay Period
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={currentStayPeriod?.startDate || ""}
                              onChange={(e) =>
                                handleStartDateChange(
                                  tenant.user_id,
                                  e.target.value || ""
                                )
                              }
                              disabled={!isEditing}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={currentStayPeriod?.endDate || ""}
                              onChange={(e) =>
                                handleEndDateChange(
                                  tenant.user_id,
                                  e.target.value || ""
                                )
                              }
                              disabled={!isEditing}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Break Periods */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-md font-medium text-gray-700">
                            Break Periods
                          </h4>
                          {isEditing && (
                            <button
                              onClick={() => addBreakPeriod(tenant.user_id)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              + Add Break
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {currentBreakPeriods.map((breakPeriod, index) => (
                            <div
                              key={index}
                              className="flex gap-2 items-center"
                            >
                              <input
                                type="date"
                                value={breakPeriod.breakStart || ""}
                                onChange={(e) =>
                                  handleBreakStartChange(
                                    tenant.user_id,
                                    index,
                                    e.target.value || ""
                                  )
                                }
                                disabled={!isEditing}
                                className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                              <span className="text-gray-500">to</span>
                              <input
                                type="date"
                                value={breakPeriod.breakEnd || ""}
                                onChange={(e) =>
                                  handleBreakEndChange(
                                    tenant.user_id,
                                    index,
                                    e.target.value || ""
                                  )
                                }
                                disabled={!isEditing}
                                className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                              {isEditing && (
                                <button
                                  onClick={() =>
                                    removeBreakPeriod(tenant.user_id, index)
                                  }
                                  className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
