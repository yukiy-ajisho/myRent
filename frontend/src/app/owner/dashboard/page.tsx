"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

interface DashboardTenant {
  user_id: string;
  name: string;
  email: string;
  current_balance: number;
  last_updated: string | null;
}

export default function Dashboard() {
  const { selectedProperty } = useProperty();
  const [dashboardData, setDashboardData] = useState<DashboardTenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (selectedProperty) {
      loadDashboardData(selectedProperty.property_id);
    }
  }, [selectedProperty]);

  const loadDashboardData = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== DASHBOARD DEBUG ===");
      console.log("Property ID:", propertyId);
      console.log("Starting API call...");

      const data = await api.getDashboardData(propertyId);
      console.log("API Response received:", data);

      const tenants = data.tenants || [];
      console.log("Dashboard tenants from API:", tenants);

      setDashboardData(tenants);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setMessage("Error loading dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No transactions";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-green-600";
    if (balance < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getBalanceBgColor = (balance: number) => {
    if (balance > 0) return "bg-green-50 border-green-200";
    if (balance < 0) return "bg-red-50 border-red-200";
    return "bg-gray-50 border-gray-200";
  };

  if (!selectedProperty) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please select a property to view dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Dashboard - {selectedProperty.name}
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading dashboard...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {dashboardData.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600 text-lg">
                No tenants found for this property.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Add tenants to see their balance information here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {dashboardData.map((tenant) => (
                <div
                  key={tenant.user_id}
                  className={`bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow ${getBalanceBgColor(
                    tenant.current_balance
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {tenant.name}
                      </h3>
                      <p className="text-gray-600 mt-1">{tenant.email}</p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-500">
                          Last updated: {formatDate(tenant.last_updated)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div
                        className={`text-2xl font-bold ${getBalanceColor(
                          tenant.current_balance
                        )}`}
                      >
                        {formatCurrency(tenant.current_balance)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {tenant.current_balance > 0
                          ? "Credit Balance"
                          : tenant.current_balance < 0
                          ? "Outstanding Balance"
                          : "No Balance"}
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
    </div>
  );
}
