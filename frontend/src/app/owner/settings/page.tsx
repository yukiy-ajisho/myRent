"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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

interface RepaymentNotificationSettings {
  tenant_user_id: string;
  owner_user_id: string;
  enabled: boolean;
  lead_days: number;
  created_at: string;
  updated_at: string;
}

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  property_id: string;
  property_name: string;
  nick_name?: string | null;
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
  const { userProperties, selectedProperty, setSelectedProperty } =
    useProperty();
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

  // Repayment notification settings state
  const [allTenants, setAllTenants] = useState<
    Array<{
      user_id: string;
      name: string;
      email: string;
      property_id: string;
      property_name: string;
      nick_name: string | null;
    }>
  >([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [repaymentSettings, setRepaymentSettings] = useState<
    Record<string, RepaymentNotificationSettings>
  >({});
  const [repaymentEnabled, setRepaymentEnabled] = useState<
    Record<string, boolean>
  >({});
  const [repaymentLeadDays, setRepaymentLeadDays] = useState<
    Record<string, number>
  >({});
  const [isSavingRepaymentSettings, setIsSavingRepaymentSettings] = useState<
    Record<string, boolean>
  >({});
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const isInitialTenantLoad = useRef(true);

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

  // Handle property change
  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    if (propertyId === "") {
      setSelectedProperty(null);
    } else {
      const property = userProperties.find(
        (p) => p.property_id.toString() === propertyId
      );
      setSelectedProperty(property || null);
    }
  };

  // Load settings when property is selected
  useEffect(() => {
    if (!selectedProperty?.property_id) {
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
          selectedProperty.property_id
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
  }, [selectedProperty]);

  // Fetch tenants for repayment notification settings
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const allPropertiesTenants = await Promise.all(
          userProperties.map(async (p) => {
            const res = await api.getOwnerTenants({
              propertyId: p.property_id,
            });
            return res.tenants.map((t: Tenant) => ({
              user_id: t.user_id,
              name: t.name,
              email: t.email,
              property_id: p.property_id,
              property_name: p.name,
              nick_name: t.nick_name || null,
            }));
          })
        );
        const flatTenants = allPropertiesTenants.flat();

        // Save all tenants for filtering
        setAllTenants(flatTenants);

        // Load repayment notification settings for all tenants
        let settingsList: RepaymentNotificationSettings[] = [];
        try {
          const settingsResponse = await api.getRepaymentNotificationSettings();
          settingsList = settingsResponse.settings || [];
        } catch (error) {
          // If settings endpoint returns 404 or other errors, just use empty array
          // This is fine - it means no settings exist yet
          console.warn(
            "Could not load repayment notification settings:",
            error
          );
          settingsList = [];
        }

        const settingsMap: Record<string, RepaymentNotificationSettings> = {};
        const enabledMap: Record<string, boolean> = {};
        const leadDaysMap: Record<string, number> = {};

        settingsList.forEach((setting: RepaymentNotificationSettings) => {
          settingsMap[setting.tenant_user_id] = setting;
          enabledMap[setting.tenant_user_id] = setting.enabled;
          leadDaysMap[setting.tenant_user_id] = setting.lead_days;
        });

        setRepaymentSettings(settingsMap);
        setRepaymentEnabled(enabledMap);
        setRepaymentLeadDays(leadDaysMap);
      } catch (error) {
        console.error("Error loading tenants:", error);
      }
    };

    if (userProperties.length > 0) {
      fetchTenants();
    }
  }, [userProperties]);

  // Filter and group tenants based on selectedProperty
  const filteredTenants = useMemo(() => {
    if (allTenants.length === 0) return [];

    // If no property selected (All Properties), group all tenants
    if (!selectedProperty?.property_id) {
      // Group by user_id and combine property names
      const grouped = allTenants.reduce((acc, tenant) => {
        if (!acc[tenant.user_id]) {
          acc[tenant.user_id] = {
            user_id: tenant.user_id,
            name: tenant.name,
            email: tenant.email,
            properties: [],
            nick_name: tenant.nick_name,
          };
        }
        acc[tenant.user_id].properties.push(tenant.property_name);
        return acc;
      }, {} as Record<string, { user_id: string; name: string; email: string; properties: string[]; nick_name: string | null }>);

      const groupedArray = Object.values(grouped);

      return groupedArray.map((group) => ({
        user_id: group.user_id,
        name: group.name,
        email: group.email,
        property_id: "",
        property_name: group.properties.join(", "),
        nick_name: group.nick_name,
      }));
    }

    // If specific property selected, filter by property_id
    const selectedPropertyId = selectedProperty.property_id.toString();
    const filtered = allTenants.filter(
      (tenant) => tenant.property_id.toString() === selectedPropertyId
    );

    // Remove duplicates by user_id (in case tenant appears multiple times)
    const uniqueTenants = filtered.reduce((acc, tenant) => {
      if (!acc[tenant.user_id]) {
        acc[tenant.user_id] = tenant;
      }
      return acc;
    }, {} as Record<string, (typeof allTenants)[0]>);

    return Object.values(uniqueTenants).map((tenant) => ({
      user_id: tenant.user_id,
      name: tenant.name,
      email: tenant.email,
      property_id: tenant.property_id,
      property_name: tenant.property_name,
      nick_name: tenant.nick_name,
    }));
  }, [allTenants, selectedProperty]);

  // Update tenants when filteredTenants changes
  useEffect(() => {
    setTenants(filteredTenants);

    // Set defaults for tenants without settings (only if not already set)
    filteredTenants.forEach((tenant) => {
      if (repaymentEnabled[tenant.user_id] === undefined) {
        setRepaymentEnabled((prev) => ({
          ...prev,
          [tenant.user_id]: false,
        }));
      }
      if (repaymentLeadDays[tenant.user_id] === undefined) {
        setRepaymentLeadDays((prev) => ({
          ...prev,
          [tenant.user_id]: 3,
        }));
      }
    });

    // Auto-select first tenant if available (only on initial load)
    if (filteredTenants.length > 0 && isInitialTenantLoad.current) {
      setSelectedTenantId(filteredTenants[0].user_id);
      isInitialTenantLoad.current = false;
    }

    // If selected tenant is not in filtered list, clear selection
    if (
      selectedTenantId &&
      !filteredTenants.find((t) => t.user_id === selectedTenantId)
    ) {
      setSelectedTenantId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTenants]);

  const handleSave = async () => {
    if (!selectedProperty?.property_id) {
      setMessage({ type: "error", text: "Please select a property" });
      return;
    }

    // No validation needed - leadDays can be >= paymentDay (notification will be in previous month)

    try {
      setIsSaving(true);
      setMessage(null);

      const response = await api.updatePropertyBillingSettings({
        property_id: selectedProperty.property_id,
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

      {/* Property Selector - Top Left */}
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
          <span className="ml-2">Loading settings...</span>
        </div>
      ) : (
        <>
          {/* Payment Notification Settings - Only shown when property is selected */}
          {selectedProperty?.property_id ? (
            <>
              {/* Settings Form */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Payment Notification Settings
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
                    disabled={!selectedProperty?.property_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={!selectedProperty?.property_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      {previewDates.notificationDate.toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
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

                {/* Current Settings Info */}
                {settings && (
                  <p className="mt-2 text-xs text-gray-400">
                    Last updated:{" "}
                    {new Date(settings.updated_at).toLocaleString()}
                  </p>
                )}
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
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-center text-gray-500">
              Please select a property to configure settings
            </div>
          )}

          {/* Repayment Notification Settings - Always shown */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Repayment Notification Settings
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure when tenants receive notifications about upcoming loan
              repayments. Settings are applied per tenant.
            </p>

            {tenants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tenants found. Add tenants to properties to configure
                repayment notifications.
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Left Side: Tenant List */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Tenant
                  </label>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    {tenants.map((tenant) => (
                      <button
                        key={tenant.user_id}
                        onClick={() => setSelectedTenantId(tenant.user_id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-200 last:border-b-0 transition-colors ${
                          selectedTenantId === tenant.user_id
                            ? "bg-indigo-50"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900">
                          {tenant.nick_name || tenant.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {tenant.email}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {tenant.property_name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Side: Selected Tenant Settings */}
                <div className="flex-1">
                  {/* Placeholder label to align with left side */}
                  <div
                    className="block text-sm font-medium text-gray-700 mb-2"
                    aria-hidden="true"
                  >
                    &nbsp;
                  </div>
                  {selectedTenantId ? (
                    (() => {
                      const tenant = tenants.find(
                        (t) => t.user_id === selectedTenantId
                      );
                      if (!tenant) return null;

                      return (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {tenant.nick_name || tenant.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {tenant.email}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Properties: {tenant.property_name}
                            </p>
                          </div>

                          {/* Enabled Toggle */}
                          <div className="mb-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={
                                  repaymentEnabled[tenant.user_id] ?? false
                                }
                                onChange={(e) => {
                                  setRepaymentEnabled({
                                    ...repaymentEnabled,
                                    [tenant.user_id]: e.target.checked,
                                  });
                                }}
                                disabled={
                                  isSavingRepaymentSettings[tenant.user_id]
                                }
                                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Enable repayment notifications
                              </span>
                            </label>
                          </div>

                          {/* Lead Days */}
                          <div className="mb-4">
                            <label
                              htmlFor={`lead-days-${tenant.user_id}`}
                              className="block text-sm font-medium text-gray-700 mb-2"
                            >
                              Notification Lead Days (0-31)
                            </label>
                            <select
                              id={`lead-days-${tenant.user_id}`}
                              value={repaymentLeadDays[tenant.user_id] ?? 3}
                              onChange={(e) => {
                                setRepaymentLeadDays({
                                  ...repaymentLeadDays,
                                  [tenant.user_id]: Number(e.target.value),
                                });
                              }}
                              disabled={
                                isSavingRepaymentSettings[tenant.user_id]
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            >
                              {Array.from({ length: 32 }, (_, i) => i).map(
                                (days) => (
                                  <option key={days} value={days}>
                                    {days}
                                  </option>
                                )
                              )}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                              Number of days before repayment due date to send
                              notification
                            </p>
                          </div>

                          {/* Save Button */}
                          <button
                            onClick={async () => {
                              try {
                                setIsSavingRepaymentSettings({
                                  ...isSavingRepaymentSettings,
                                  [tenant.user_id]: true,
                                });
                                setMessage(null);

                                await api.updateRepaymentNotificationSettings({
                                  tenant_user_id: tenant.user_id,
                                  enabled:
                                    repaymentEnabled[tenant.user_id] ?? true,
                                  lead_days:
                                    repaymentLeadDays[tenant.user_id] ?? 3,
                                });

                                // Reload settings
                                try {
                                  const response =
                                    await api.getRepaymentNotificationSettings(
                                      tenant.user_id
                                    );
                                  if (response.settings) {
                                    setRepaymentSettings({
                                      ...repaymentSettings,
                                      [tenant.user_id]: response.settings,
                                    });
                                  }
                                } catch (error) {
                                  console.warn(
                                    "Could not reload settings after save:",
                                    error
                                  );
                                }

                                setMessage({
                                  type: "success",
                                  text: `Settings saved for ${
                                    tenant.nick_name || tenant.name
                                  }`,
                                });

                                setTimeout(() => {
                                  setMessage(null);
                                }, 3000);
                              } catch (error) {
                                console.error(
                                  "Error saving repayment settings:",
                                  error
                                );
                                const errorMessage =
                                  error &&
                                  typeof error === "object" &&
                                  "error" in error
                                    ? String(error.error)
                                    : "Failed to save settings";
                                setMessage({
                                  type: "error",
                                  text: errorMessage,
                                });
                              } finally {
                                setIsSavingRepaymentSettings({
                                  ...isSavingRepaymentSettings,
                                  [tenant.user_id]: false,
                                });
                              }
                            }}
                            disabled={isSavingRepaymentSettings[tenant.user_id]}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            {isSavingRepaymentSettings[tenant.user_id]
                              ? "Saving..."
                              : "Save Settings"}
                          </button>

                          {/* Last Updated Info */}
                          {repaymentSettings[tenant.user_id] && (
                            <p className="mt-2 text-xs text-gray-400">
                              Last updated:{" "}
                              {new Date(
                                repaymentSettings[tenant.user_id].updated_at
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                      Select a tenant from the list to configure settings
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
