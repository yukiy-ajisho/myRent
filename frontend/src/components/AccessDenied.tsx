"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";

interface AccessDeniedProps {
  userType: "owner" | "tenant";
  attemptedPath: string;
}

export default function AccessDenied({
  userType,
  attemptedPath,
}: AccessDeniedProps) {
  const router = useRouter();

  const handleGoToDashboard = () => {
    if (userType === "owner") {
      router.push("/owner/dashboard");
    } else {
      router.push("/tenant/dashboard");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white shadow-lg rounded-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
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
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            You are registered as a{" "}
            <span className="font-semibold capitalize">{userType}</span> and
            don&apos;t have permission to access this page.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoToDashboard}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go to {userType === "owner" ? "Owner" : "Tenant"} Dashboard
          </button>

          <button
            onClick={handleSignOut}
            className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign Out
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Attempted to access: {attemptedPath}
          </p>
        </div>
      </div>
    </div>
  );
}
