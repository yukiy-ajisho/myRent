"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

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

export default function StayManager() {
  const { selectedProperty } = useProperty();
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

  useEffect(() => {
    if (selectedProperty) {
      loadStayData(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadStayData = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== STAY MANAGER DEBUG ===");
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
    if (!selectedProperty) return;

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
        propertyId: selectedProperty.property_id,
        stayPeriods: cleanedStayPeriods,
        breakPeriods: cleanedBreakPeriods,
      });

      setMessage("Stay periods saved successfully!");
      setOriginalStayPeriods({ ...stayPeriods });
      setOriginalBreakPeriods({ ...breakPeriods });
      setHasChanges(false);
      setIsEditing(false);

      // Reload data to get updated records
      loadStayData(selectedProperty.property_id);
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

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Stay Manager</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to view stay records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Stay Manager for {selectedProperty.name}
        </h1>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading stay data...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {tenants.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600">
                No tenants found for this property.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {tenants.map((tenant) => {
                const stayRecord = getStayRecordForTenant(tenant.user_id);
                const tenantBreakRecords = getBreakRecordsForTenant(
                  tenant.user_id
                );
                const currentStayPeriod = stayPeriods[tenant.user_id];
                const currentBreakPeriods = breakPeriods[tenant.user_id] || [];

                return (
                  <div
                    key={tenant.user_id}
                    className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {tenant.name} ({tenant.email})
                    </h3>

                    {/* Stay Record */}
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-700 mb-2">
                        Stay Period
                      </h4>
                      {isEditing ? (
                        <div className="space-y-2">
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
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-sm">
                            <span className="font-medium">Start:</span>{" "}
                            {stayRecord?.start_date
                              ? new Date(
                                  stayRecord.start_date
                                ).toLocaleDateString()
                              : "Not set"}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">End:</span>{" "}
                            {stayRecord?.end_date
                              ? new Date(
                                  stayRecord.end_date
                                ).toLocaleDateString()
                              : "Ongoing"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Break Records */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-md font-medium text-gray-700">
                          Break Periods (
                          {isEditing
                            ? currentBreakPeriods.length
                            : tenantBreakRecords.length}
                          )
                        </h4>
                        {isEditing && (
                          <button
                            onClick={() => addBreakPeriod(tenant.user_id)}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                          >
                            Add Break
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          {currentBreakPeriods.map((breakPeriod, index) => (
                            <div
                              key={index}
                              className="bg-yellow-50 p-3 rounded-md border border-yellow-200"
                            >
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Break Start
                                  </label>
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
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Break End
                                  </label>
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
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  removeBreakPeriod(tenant.user_id, index)
                                }
                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          {currentBreakPeriods.length === 0 && (
                            <p className="text-sm text-gray-500 italic">
                              No break periods. Click "Add Break" to add one.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tenantBreakRecords.length > 0 ? (
                            tenantBreakRecords.map((breakRecord) => (
                              <div
                                key={breakRecord.break_id}
                                className="bg-yellow-50 p-3 rounded-md border border-yellow-200"
                              >
                                <p className="text-sm">
                                  <span className="font-medium">Start:</span>{" "}
                                  {new Date(
                                    breakRecord.break_start
                                  ).toLocaleDateString()}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">End:</span>{" "}
                                  {new Date(
                                    breakRecord.break_end
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              No break periods found
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
}
