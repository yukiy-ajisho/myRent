"use client";

import { useState, useEffect, useMemo } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";
import { getAuthState } from "@/lib/auth-state-client";
import { useRouter } from "next/navigation";
import AccessDenied from "@/components/AccessDenied";

interface BillingSettings {
  property_id: string | number;
  owner_user_id: string;
  payment_day: number;
  notification_lead_days: number;
  created_at: string;
  updated_at: string;
}

// Helper function to calculate effective payment day and notification date
// Handles cases where leadDays >= paymentDay (notification in previous month)
function calculateDates(
  paymentDay: number,
  leadDays: number,
  year: number,
  month: number
) {
  // Payment day is in the NEXT month
  let paymentYear = year;
  let paymentMonth = month + 1;
  if (paymentMonth > 11) {
    paymentMonth = 0; // January
    paymentYear = year + 1;
  }

  // Get last day of payment month (next month)
  const lastDayOfPaymentMonth = new Date(
    paymentYear,
    paymentMonth + 1,
    0
  ).getDate();
  const effectivePaymentDay = Math.min(paymentDay, lastDayOfPaymentMonth);

  // Calculate notification date: payment date minus lead days
  // Start with payment date and subtract lead days
  const paymentDate = new Date(paymentYear, paymentMonth, effectivePaymentDay);
  const notificationDate = new Date(paymentDate);
  notificationDate.setDate(notificationDate.getDate() - leadDays);

  return {
    effectivePaymentDay,
    notificationDay: notificationDate.getDate(),
    paymentDate,
    notificationDate,
  };
}

export default function SettingsPage() {
  const { userProperties } = useProperty();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [paymentDay, setPaymentDay] = useState<number>(5);
  const [leadDays, setLeadDays] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [authState, setAuthState] = useState<"checking" | "denied" | "allowed">(
    "checking"
  );
  const router = useRouter();

  // Calculate preview dates for current month
  const previewDates = useMemo(() => {
    if (!paymentDay || leadDays === undefined) return null;
    const now = new Date();
    return calculateDates(
      paymentDay,
      leadDays,
      now.getFullYear(),
      now.getMonth()
    );
  }, [paymentDay, leadDays]);

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

  // Load settings when property is selected
  useEffect(() => {
    if (!selectedPropertyId) {
      setSettings(null);
      setPaymentDay(5);
      setLeadDays(3);
      return;
    }

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setMessage(null);

        const response = await api.getPropertyBillingSettings(
          selectedPropertyId
        );
        const fetchedSettings = response.settings;

        if (fetchedSettings) {
          setSettings(fetchedSettings);
          setPaymentDay(fetchedSettings.payment_day);
          setLeadDays(fetchedSettings.notification_lead_days);
        } else {
          // No settings yet, use defaults
          setSettings(null);
          setPaymentDay(5);
          setLeadDays(3);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        setMessage({ type: "error", text: "Failed to load settings" });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [selectedPropertyId]);

  // Auto-select first property on mount
  useEffect(() => {
    if (userProperties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(userProperties[0].property_id);
    }
  }, [userProperties, selectedPropertyId]);

  const handleSave = async () => {
    if (!selectedPropertyId) {
      setMessage({ type: "error", text: "Please select a property" });
      return;
    }

    // No validation needed - leadDays can be >= paymentDay (notification will be in previous month)

    try {
      setIsSaving(true);
      setMessage(null);

      const response = await api.updatePropertyBillingSettings({
        property_id: selectedPropertyId,
        payment_day: paymentDay,
        notification_lead_days: leadDays,
      });

      setSettings(response.settings);
      setMessage({ type: "success", text: "Settings saved successfully!" });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      const errorMessage =
        error && typeof error === "object" && "error" in error
          ? String(error.error)
          : "Failed to save settings";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
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
    return <AccessDenied userType="tenant" attemptedPath="/owner/settings" />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Billing Settings
      </h2>

      {/* Property Selector */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label
          htmlFor="property-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Property
        </label>
        <select
          id="property-select"
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Select a property...</option>
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
          <span className="ml-2">Loading settings...</span>
        </div>
      ) : selectedPropertyId ? (
        <>
          {/* Settings Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Payment & Notification Settings
            </h3>

            {/* Payment Day */}
            <div className="mb-4">
              <label
                htmlFor="payment-day"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Payment Day (1-31)
              </label>
              <select
                id="payment-day"
                value={paymentDay}
                onChange={(e) => setPaymentDay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                The day of each month when payment is due
              </p>
            </div>

            {/* Notification Lead Days */}
            <div className="mb-4">
              <label
                htmlFor="lead-days"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Notification Lead Days (0-31)
              </label>
              <select
                id="lead-days"
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Array.from({ length: 32 }, (_, i) => i).map((days) => (
                  <option key={days} value={days}>
                    {days}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Number of days before payment day to send notification. If
                greater than payment day, notification will be sent in the
                previous month.
              </p>
            </div>

            {/* Preview */}
            {previewDates && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  Preview (Current Month)
                </h4>
                <p className="text-sm text-blue-800">
                  <strong>Notification Date:</strong>{" "}
                  {previewDates.notificationDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Payment Due Date:</strong>{" "}
                  {previewDates.paymentDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`p-4 rounded-md mb-4 ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Current Settings Info */}
          {settings && (
            <div className="bg-gray-50 rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">
                <strong>Last updated:</strong>{" "}
                {new Date(settings.updated_at).toLocaleString()}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
          Please select a property to configure settings
        </div>
      )}
    </div>
  );
}
