"use client";

import { useState, useEffect, useMemo } from "react";
import { useProperty } from "@/contexts/PropertyContext";
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
  loan_balance: number;
  loan_last_updated: string | null;
}

export default function Dashboard() {
  const { userProperties, selectedProperty, setSelectedProperty } =
    useProperty();
  const [allDashboardData, setAllDashboardData] = useState<DashboardTenant[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [authState, setAuthState] = useState<"checking" | "denied" | "allowed">(
    "checking"
  );
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
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

          // Authが成功したらデータを取得
          try {
            setIsLoading(true);
            setMessage("");

            console.log("=== DASHBOARD DEBUG ===");
            console.log("Fetching all dashboard data...");

            const data = await api.getAllDashboardData();
            console.log("API Response received:", data);

            const tenants = data.tenants || [];
            console.log("All dashboard tenants from API:", tenants);

            console.log(
              "Setting dashboard data, tenant count:",
              tenants.length
            );
            setAllDashboardData(tenants);
            console.log(
              "Dashboard data set, selectedProperty:",
              selectedProperty
            );
          } catch (error) {
            console.error("Error loading dashboard data:", error);
            setMessage("Error loading dashboard data");
          } finally {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  // プロパティ選択変更
  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    if (propertyId === "") {
      setSelectedProperty(null);
    } else {
      const property = userProperties.find((p) => p.property_id === propertyId);
      setSelectedProperty(property || null);
    }
  };

  // Process confirmed repayments
  const handleProcessRepayments = async () => {
    setIsProcessing(true);
    setMessage("");

    try {
      const result = await api.processRepayments();

      if (result.processedCount > 0) {
        setMessage(`Success! Processed ${result.processedCount} repayment(s).`);
      } else {
        setMessage("No repayments to process.");
      }

      // Refresh dashboard data to show updated loan balances
      const data = await api.getAllDashboardData();
      setAllDashboardData(data.tenants || []);
    } catch (error) {
      console.error("Error processing repayments:", error);
      setMessage("Error processing repayments");
    } finally {
      setIsProcessing(false);
    }
  };

  // フィルタリングされたダッシュボードデータ
  const filteredDashboardData = selectedProperty
    ? allDashboardData.filter(
        (tenant) =>
          tenant.property_id.toString() ===
          selectedProperty.property_id.toString()
      )
    : allDashboardData;

  // Get unique tenants with latest loan data
  const uniqueLoanTenants = useMemo(() => {
    if (!filteredDashboardData || filteredDashboardData.length === 0) return [];

    const tenantMap = new Map<string, DashboardTenant>();

    filteredDashboardData.forEach((tenant) => {
      const existing = tenantMap.get(tenant.user_id);

      if (
        !existing ||
        (tenant.loan_last_updated &&
          existing.loan_last_updated &&
          new Date(tenant.loan_last_updated) >
            new Date(existing.loan_last_updated))
      ) {
        tenantMap.set(tenant.user_id, tenant);
      }
    });

    return Array.from(tenantMap.values());
  }, [filteredDashboardData]);

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
      {/* Property選択を最上部に */}
      <div className="flex items-center gap-2 mb-6">
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
            /* Tenant BalanceとTenant Loan Balanceを横並び */
            <div className="grid grid-cols-2 gap-6 items-start">
              {/* Tenant Balance */}
              <div className="h-full">
                <h2 className="text-2xl font-bold mb-4">
                  Tenant Balance
                  {selectedProperty ? ` - ${selectedProperty.name}` : ""}
                </h2>
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm h-full">
                  <div className="grid grid-cols-4 gap-0">
                    {/* ヘッダー行 */}
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 col-span-2">
                      Name
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-8 overflow-hidden">
                      Last Updated
                    </div>
                    <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-16 overflow-hidden">
                      Balance
                    </div>

                    {/* データ行 */}
                    {filteredDashboardData.map((tenant) => (
                      <div
                        key={`${tenant.user_id}-${tenant.property_id}`}
                        className="contents"
                      >
                        <div className="col-span-2 py-3">
                          <div className="text-lg font-semibold text-gray-900">
                            {tenant.nick_name || tenant.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {tenant.email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tenant.property_name}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 py-3 pl-8 overflow-hidden">
                          {formatDate(tenant.last_updated)}
                        </div>
                        <div
                          className={`text-2xl font-bold py-3 pl-16 overflow-hidden ${getBalanceColor(
                            tenant.current_balance
                          )}`}
                        >
                          {formatCurrency(tenant.current_balance)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tenant Loan Balance */}
              {!isLoading && uniqueLoanTenants.length > 0 && (
                <div className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Tenant Loan Balance</h2>
                    <button
                      onClick={handleProcessRepayments}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? "Processing..." : "Process Repayments"}
                    </button>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm h-full">
                    <div className="grid grid-cols-3 gap-0">
                      {/* ヘッダー行 */}
                      <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
                        Name
                      </div>
                      <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-8 overflow-hidden">
                        Last Updated
                      </div>
                      <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 pl-16 overflow-hidden">
                        Loan Balance
                      </div>

                      {/* データ行 */}
                      {uniqueLoanTenants.map((tenant) => (
                        <div key={tenant.user_id} className="contents">
                          <div className="py-3">
                            <div className="text-lg font-semibold text-gray-900">
                              {tenant.nick_name || tenant.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {tenant.email}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 py-3 pl-8 overflow-hidden">
                            {formatDate(tenant.loan_last_updated)}
                          </div>
                          <div
                            className={`text-2xl font-bold py-3 pl-16 overflow-hidden ${getBalanceColor(
                              tenant.loan_balance
                            )}`}
                          >
                            {formatCurrency(tenant.loan_balance)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
