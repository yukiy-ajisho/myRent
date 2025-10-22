"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthState } from "@/lib/auth-state-client";

export default function UserTypeSelection() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const { state, user } = await getAuthState();

        if (state === "unauthenticated") {
          router.push("/login");
          return;
        }

        if (state === "authenticated" && user) {
          // 既にユーザータイプが確定済みの場合、適切なダッシュボードにリダイレクト
          if (user.user_type === "owner") {
            router.push("/owner/dashboard");
          } else {
            router.push("/tenant/dashboard");
          }
          return;
        }

        // 状態2（認証中）の場合のみ、ユーザータイプ選択ページを表示
        setIsCheckingAuth(false);
      } catch (error) {
        console.error("Error checking auth state:", error);
        router.push("/login");
      }
    };

    checkAuthState();
  }, [router]);

  const handleUserTypeSelect = async (userType: "owner" | "tenant") => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Selecting user type:", userType);

      const response = await api.selectUserType(userType);

      if (response.success) {
        console.log("User type selected successfully:", response);

        if (userType === "owner") {
          router.push("/owner/dashboard");
        } else {
          router.push("/tenant/dashboard");
        }
      } else {
        setError(response.error || "Failed to select user type");
      }
    } catch (error) {
      console.error("Error selecting user type:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome to RentCalc
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please select your role to continue
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => handleUserTypeSelect("owner")}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                I am an Owner
              </>
            )}
          </button>

          <button
            onClick={() => handleUserTypeSelect("tenant")}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                I am a Tenant
              </>
            )}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push("/login")}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    </div>
  );
}
