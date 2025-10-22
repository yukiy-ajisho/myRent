"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { getAuthState } from "@/lib/auth-state-client";
import AccessDenied from "@/components/AccessDenied";

interface Property {
  property_id: string;
  name: string;
  active: boolean;
  address: string;
}

export default function TenantDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          if (user.user_type !== "tenant") {
            setAuthState("denied");
            return;
          }

          setAuthState("allowed");
          await fetchTenantProperties();
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchTenantProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Fetching tenant properties...");
      const response = await api.getTenantProperties();

      if (response.success) {
        console.log("Tenant properties fetched:", response.properties);
        setProperties(response.properties);
      } else {
        setError(response.error || "Failed to fetch properties");
      }
    } catch (error) {
      console.error("Error fetching tenant properties:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (authState === "denied") {
    return <AccessDenied userType="owner" attemptedPath="/tenant/dashboard" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-800">{error}</p>
          </div>
          <button
            onClick={fetchTenantProperties}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
          >
            Try Again
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
            <svg
              className="mx-auto h-12 w-12 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No Properties Assigned
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              You haven't been assigned to any properties yet. Please contact
              your property manager to get access.
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Tenant Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your properties and view your account information
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Your Properties
          </h2>
          <p className="text-gray-600">
            You have access to {properties.length} propert
            {properties.length === 1 ? "y" : "ies"}
          </p>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <div
              key={property.property_id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {property.name}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>

              {property.address && (
                <p className="text-sm text-gray-600 mb-4">{property.address}</p>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    // TODO: Navigate to property details
                    console.log("Navigate to property:", property.property_id);
                  }}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  View Details
                </button>
                <button
                  onClick={() => {
                    // TODO: Navigate to payment history
                    console.log(
                      "Navigate to payments for property:",
                      property.property_id
                    );
                  }}
                  className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                >
                  Payments
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Account Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Role</p>
              <p className="text-sm text-gray-900">Tenant</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Properties</p>
              <p className="text-sm text-gray-900">{properties.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
