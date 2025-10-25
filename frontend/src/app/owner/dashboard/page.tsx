"use client";

import { useState, useEffect } from "react";
import { useProperty, Property } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";
import { getAuthState } from "@/lib/auth-state-client";
import { useRouter } from "next/navigation";
import AccessDenied from "@/components/AccessDenied";

interface DashboardTenant {
  user_id: string;
  name: string;
  email: string;
  nick_name?: string | null;
  current_balance: number;
  last_updated: string | null;
  property_id: string;
  property_name: string;
}

export default function Dashboard() {
  const { userProperties, selectedProperty, setSelectedProperty } =
    useProperty();
  const [allDashboardData, setAllDashboardData] = useState<DashboardTenant[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [authState, setAuthState] = useState<"checking" | "denied" | "allowed">(
    "checking"
  );
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { state, user } = await getAuthState();

        if (state === "unauthenticated") {
          router.push("/login");
          return;
        }

        if (state === "authenticating") {
          router.push("/user-type-selection");
          return;
        }

        if (state === "authenticated" && user) {
          if (user.user_type !== "owner") {
            setAuthState("denied");
            return;
          }

          setAuthState("allowed");
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // 初期データ読み込み
  useEffect(() => {
    if (authState === "allowed") {
      fetchAllDashboardData();
    }
  }, [authState]);

  const fetchAllDashboardData = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== DASHBOARD DEBUG ===");
      console.log("Fetching all dashboard data...");

      const data = await api.getAllDashboardData();
      console.log("API Response received:", data);

      const tenants = data.tenants || [];
      console.log("All dashboard tenants from API:", tenants);

      setAllDashboardData(tenants);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setMessage("Error loading dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  // プロパティ選択変更
  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    if (propertyId === "") {
      setSelectedProperty(null);
    } else {
      const property = userProperties.find(
        (p) => p.property_id === parseInt(propertyId)
      );
      setSelectedProperty(property || null);
    }
  };

  // フィルタリングされたダッシュボードデータ
  const filteredDashboardData = selectedProperty
    ? allDashboardData.filter(
        (tenant) =>
          tenant.property_id === selectedProperty.property_id.toString()
      )
    : allDashboardData;

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

  if (authState === "checking") {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (authState === "denied") {
    return <AccessDenied userType="tenant" attemptedPath="/owner/dashboard" />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">
          Tenant Balance{selectedProperty ? ` - ${selectedProperty.name}` : ""}
        </h1>

        {/* プロパティ選択ドロップダウン */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="property-select"
            className="text-sm font-medium text-gray-700"
          >
            Property:
          </label>
          <select
            id="property-select"
            value={selectedProperty?.property_id || ""}
            onChange={handlePropertyChange}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Properties</option>
            {userProperties.map((property) => (
              <option key={property.property_id} value={property.property_id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading dashboard...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDashboardData.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600 text-lg">
                No tenants found
                {selectedProperty ? ` for ${selectedProperty.name}` : ""}.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Add tenants to see their balance information here.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="grid grid-cols-5 gap-0">
                {/* ヘッダー行 */}
                <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
                  Name
                </div>
                <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
                  Property
                </div>
                <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
                  Email
                </div>
                <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-20 overflow-hidden">
                  Last Updated
                </div>
                <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-40 overflow-hidden">
                  Balance
                </div>

                {/* データ行 */}
                {filteredDashboardData.map((tenant) => (
                  <div
                    key={`${tenant.user_id}-${tenant.property_id}`}
                    className="contents"
                  >
                    <div className="text-lg font-semibold text-gray-900 py-3">
                      {tenant.nick_name || tenant.name}
                    </div>
                    <div className="text-gray-600 py-3">
                      {tenant.property_name}
                    </div>
                    <div className="text-gray-600 py-3 pl-15 overflow-hidden">
                      {tenant.email}
                    </div>
                    <div className="text-sm text-gray-500 py-3 pl-20 overflow-hidden">
                      {formatDate(tenant.last_updated)}
                    </div>
                    <div
                      className={`text-2xl font-bold py-3 pl-36 overflow-hidden ${getBalanceColor(
                        tenant.current_balance
                      )}`}
                    >
                      {formatCurrency(tenant.current_balance)}
                    </div>
                  </div>
                ))}
              </div>
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
