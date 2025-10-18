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

export default function StayManager() {
  const { selectedProperty } = useProperty();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stayRecords, setStayRecords] = useState<StayRecord[]>([]);
  const [breakRecords, setBreakRecords] = useState<BreakRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

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
      <h1 className="text-2xl font-bold mb-6">
        Stay Manager for {selectedProperty.name}
      </h1>

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
                      {stayRecord ? (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-sm">
                            <span className="font-medium">Start:</span>{" "}
                            {new Date(
                              stayRecord.start_date
                            ).toLocaleDateString()}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">End:</span>{" "}
                            {stayRecord.end_date
                              ? new Date(
                                  stayRecord.end_date
                                ).toLocaleDateString()
                              : "Ongoing"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No stay record found
                        </p>
                      )}
                    </div>

                    {/* Break Records */}
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-2">
                        Break Periods ({tenantBreakRecords.length})
                      </h4>
                      {tenantBreakRecords.length > 0 ? (
                        <div className="space-y-2">
                          {tenantBreakRecords.map((breakRecord) => (
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
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No break periods found
                        </p>
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
