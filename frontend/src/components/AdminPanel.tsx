"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";

interface Property {
  property_id: string;
  name: string;
  timezone: string;
  active: boolean;
}

interface DivisionRule {
  rule_id: string;
  property_id: string;
  utility: string;
  method: string;
}

interface UtilityActual {
  actual_id: string;
  property_id: string;
  month_start: string;
  utility: string;
  amount: number;
}

interface BootstrapData {
  properties: Property[];
  divisionRules: DivisionRule[];
  utilityActuals: UtilityActual[];
}

const UTILITIES = ["electricity", "gas", "water", "internet", "garbage"];
const DIVISION_METHODS = ["fixed", "equalshare", "bydays"];

// JSONデータをテーブル形式に変換する関数
const renderDataAsTable = (data: any, tableName: string) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-gray-500 text-sm">No data available</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r last:border-r-0"
              >
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              {columns.map((column) => (
                <td
                  key={column}
                  className="px-4 py-3 text-sm text-gray-900 border-r last:border-r-0"
                >
                  {typeof row[column] === "object"
                    ? JSON.stringify(row[column])
                    : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function AdminPanel() {
  const [bootstrapData, setBootstrapData] = useState<BootstrapData | null>(
    null
  );
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [divisionRules, setDivisionRules] = useState<Record<string, string>>(
    {}
  );
  const [utilityAmounts, setUtilityAmounts] = useState<Record<string, string>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [runResult, setRunResult] = useState<any>(null);
  const [dumpData, setDumpData] = useState<any>(null);
  const [stayDays, setStayDays] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [stayPeriods, setStayPeriods] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({});
  const [breakPeriods, setBreakPeriods] = useState<
    Record<string, Array<{ breakStart: string; breakEnd: string }>>
  >({});
  const [rentAmounts, setRentAmounts] = useState<Record<string, number>>({});
  const [newTenant, setNewTenant] = useState({
    name: "",
    email: "",
    property_id: "",
  });

  const [newProperty, setNewProperty] = useState({
    name: "",
    timezone: "",
    owner_id: "",
    active: true,
  });

  const [newPayment, setNewPayment] = useState({
    user_id: "",
    property_id: "",
    amount: "",
    note: "",
  });

  // Initialize month to current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;
    setSelectedMonth(currentMonth);
  }, []);

  // Load all users for owner dropdown on component mount
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        const data = await api.dumpAll();
        console.log("DEBUG: Loading all users on mount:", data.app_user);
        setAllUsers(data.app_user || []);
      } catch (error) {
        console.error("Failed to load all users:", error);
      }
    };

    loadAllUsers();
  }, []);

  // Load bootstrap data
  useEffect(() => {
    loadBootstrapData();
  }, []);

  // Load data when property or month changes
  useEffect(() => {
    if (selectedProperty && selectedMonth) {
      loadBootstrapData(selectedProperty, selectedMonth);
      loadUsers(selectedProperty);
    }
  }, [selectedProperty, selectedMonth]);

  const loadUsers = async (propertyId: string) => {
    try {
      console.log("Loading users for property:", propertyId);
      // Get active tenant users for the selected property
      const data = await api.dumpAll();
      console.log("Dump data:", data);

      const allUsers = data.app_user || [];
      const userProperties = data.user_property || [];
      const stayRecords = data.stay_record || [];
      const breakRecords = data.break_record || [];
      const tenantRents = data.tenant_rent || [];
      console.log("All users:", allUsers);
      console.log("User properties:", userProperties);
      console.log("Stay records:", stayRecords);
      console.log("Tenant rents:", tenantRents);

      // Filter users who are active tenants and belong to this property
      const propertyUsers = allUsers.filter((user: any) => {
        const isTenant = user.user_type === "tenant";
        const belongsToProperty = userProperties.some(
          (up: any) =>
            up.user_id === user.user_id &&
            up.property_id === parseInt(propertyId)
        );

        // For now, just check if user is tenant and belongs to property
        // We'll add stay_record check later
        return isTenant && belongsToProperty;
      });
      console.log("Property users:", propertyUsers);

      // Set property users for stay periods, rent, etc.
      setUsers(propertyUsers);

      // Also set all users for owner selection dropdown
      console.log("DEBUG: All users fetched for dropdown:", allUsers);
      setAllUsers(allUsers);

      // Initialize stay periods for these users
      const initialStayPeriods: Record<
        string,
        { startDate: string; endDate: string }
      > = {};
      propertyUsers.forEach((user: any) => {
        // Check if there's existing stay_record data for this user
        const existingStay = stayRecords.find(
          (stay: any) =>
            stay.user_id === user.user_id &&
            stay.property_id === parseInt(propertyId)
        );

        if (existingStay) {
          initialStayPeriods[user.user_id] = {
            startDate: existingStay.start_date,
            endDate: existingStay.end_date,
          };
        } else {
          initialStayPeriods[user.user_id] = stayPeriods[user.user_id] || {
            startDate: "",
            endDate: "",
          };
        }
      });
      setStayPeriods(initialStayPeriods);

      // Initialize break periods for these users
      const initialBreakPeriods: Record<
        string,
        Array<{ breakStart: string; breakEnd: string }>
      > = {};
      propertyUsers.forEach((user: any) => {
        // Check if there are existing break_record data for this user
        // Match break_record with stay_record to get user and property info
        const existingBreaks = breakRecords.filter((breakRecord: any) => {
          const stayRecord = stayRecords.find(
            (stay: any) =>
              stay.stay_id === breakRecord.stay_id &&
              stay.user_id === user.user_id &&
              stay.property_id === parseInt(propertyId)
          );
          return stayRecord !== undefined;
        });

        if (existingBreaks.length > 0) {
          initialBreakPeriods[user.user_id] = existingBreaks.map(
            (breakRecord: any) => ({
              breakStart: breakRecord.break_start,
              breakEnd: breakRecord.break_end,
            })
          );
        } else {
          initialBreakPeriods[user.user_id] = breakPeriods[user.user_id] || [];
        }
      });
      setBreakPeriods(initialBreakPeriods);

      // Initialize rent amounts for these users
      const initialRentAmounts: Record<string, number> = {};
      propertyUsers.forEach((user: any) => {
        // Check if there's existing tenant_rent data for this user
        const existingRent = tenantRents.find(
          (rent: any) =>
            rent.user_id === user.user_id &&
            rent.property_id === parseInt(propertyId)
        );

        if (existingRent) {
          initialRentAmounts[user.user_id] = existingRent.monthly_rent;
        } else {
          initialRentAmounts[user.user_id] = rentAmounts[user.user_id] || 0;
        }
      });
      setRentAmounts(initialRentAmounts);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };
  const loadBootstrapData = async (
    propertyId?: string,
    monthStart?: string
  ) => {
    try {
      setIsLoading(true);
      const data = await api.getBootstrap(propertyId, monthStart);
      setBootstrapData(data);

      // Initialize division rules
      const rules: Record<string, string> = {};
      console.log("Bootstrap data:", data);
      console.log("Division rules:", data.divisionRules);
      console.log("Property ID:", propertyId);
      data.divisionRules.forEach((rule: DivisionRule) => {
        console.log(
          "Rule:",
          rule,
          "Property ID match:",
          String(rule.property_id) === String(propertyId)
        );
        if (String(rule.property_id) === String(propertyId)) {
          rules[rule.utility] = rule.method;
        }
      });
      console.log("Final rules:", rules);
      setDivisionRules(rules);

      // Initialize utility amounts
      const amounts: Record<string, string> = {};
      data.utilityActuals.forEach((actual: UtilityActual) => {
        amounts[actual.utility] = actual.amount.toString();
      });
      setUtilityAmounts(amounts);
    } catch (error) {
      console.error("Error loading bootstrap data:", error);
      setMessage("Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProperty) {
      setMessage("Please select a property");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");

      // Save division rules
      const ruleItems = UTILITIES.map((utility) => ({
        utility,
        method: divisionRules[utility] || "equalshare",
      }));

      await api.saveDivisionRules({
        property_id: selectedProperty,
        items: ruleItems,
      });

      // Save stay periods and break periods
      const validStayPeriods = Object.entries(stayPeriods).reduce(
        (acc, [userId, period]) => {
          if (period.startDate) {
            // Send endDate as is - null if not provided
            const processedPeriod = {
              startDate: period.startDate,
              endDate: period.endDate || null,
            };
            acc[userId] = processedPeriod;
          }
          return acc;
        },
        {} as Record<string, { startDate: string; endDate: string | null }>
      );

      const validBreakPeriods = Object.entries(breakPeriods).reduce(
        (acc, [userId, breaks]) => {
          const validBreaks = breaks.filter(
            (breakPeriod) => breakPeriod.breakStart && breakPeriod.breakEnd
          );
          if (validBreaks.length > 0) {
            acc[userId] = validBreaks;
          }
          return acc;
        },
        {} as Record<string, Array<{ breakStart: string; breakEnd: string }>>
      );

      if (Object.keys(validStayPeriods).length > 0) {
        await api.saveStayPeriods({
          property_id: selectedProperty,
          stay_periods: validStayPeriods,
          break_periods: validBreakPeriods,
        });
      }

      // Save utility amounts (only non-empty values)
      for (const [utility, amount] of Object.entries(utilityAmounts)) {
        if (amount && amount.trim() !== "") {
          await api.saveUtilityActual({
            property_id: selectedProperty,
            month_start: selectedMonth,
            utility,
            amount: parseFloat(amount),
          });
        }
      }

      // Save rent amounts (only non-zero values)
      const validRentAmounts = Object.entries(rentAmounts).reduce(
        (acc, [userId, amount]) => {
          if (amount && amount > 0) {
            acc[userId] = amount;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      if (Object.keys(validRentAmounts).length > 0) {
        await api.saveRent({
          property_id: selectedProperty,
          rent_amounts: validRentAmounts,
        });
      }

      setMessage("Settings saved successfully");

      // Reload data to show saved values
      await loadBootstrapData(selectedProperty, selectedMonth);
    } catch (error) {
      console.error("Error saving:", error);
      setMessage("Error saving settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRun = async () => {
    if (!selectedProperty || !selectedMonth) {
      setMessage("Please select property and month");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");

      const result = await api.runBill({
        property_id: selectedProperty,
        month_start: selectedMonth,
        stay_periods: stayPeriods, // Add stay periods to the request
      });

      setRunResult(result);
      setMessage(
        `Bill calculation completed. Created ${result.lines_created} lines.`
      );
    } catch (error) {
      console.error("Error running bill:", error);
      setMessage("Error running bill calculation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDumpAll = async () => {
    try {
      setIsLoading(true);
      const data = await api.dumpAll();
      setDumpData(data);
    } catch (error) {
      console.error("Error dumping data:", error);
      setMessage("Error loading dump data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleCreateTenant = async () => {
    try {
      // デバッグ情報を追加
      console.log("newTenant:", newTenant);
      console.log("property_id type:", typeof newTenant.property_id);
      console.log("property_id value:", newTenant.property_id);

      // バリデーション
      if (!newTenant.name || !newTenant.email || !newTenant.property_id) {
        setMessage("Please fill in all fields");
        return;
      }

      // property_idを数値に変換
      const propertyId = parseInt(newTenant.property_id);
      console.log("parsed property_id:", propertyId);
      console.log("isNaN:", isNaN(propertyId));

      if (isNaN(propertyId)) {
        setMessage("Please select a valid property");
        return;
      }

      const tenantData = {
        ...newTenant,
        user_type: "tenant",
        property_id: propertyId,
      };

      console.log("tenantData:", tenantData);

      // API呼び出し
      const response = await api.createTenant(tenantData);

      if (response.success) {
        setMessage("Tenant created successfully!");
        // フォームをリセット
        setNewTenant({
          name: "",
          email: "",
          user_type: "tenant",
          property_id: "",
        });
        // データを再読み込み
        loadBootstrapData(selectedProperty, selectedMonth);
        loadUsers(selectedProperty);
      } else {
        setMessage("Error creating tenant: " + response.error);
      }
    } catch (error) {
      console.error("Error creating tenant:", error);
      setMessage("Error creating tenant");
    }
  };

  const handleCancelTenant = () => {
    setNewTenant({
      name: "",
      email: "",
      property_id: "",
    });
  };

  const handleCreateProperty = async () => {
    try {
      console.log("newProperty:", newProperty);

      if (!newProperty.name || !newProperty.timezone || !newProperty.owner_id) {
        console.log("Missing required fields");
        return;
      }

      const response = await api.createProperty(newProperty);

      if (response.success) {
        console.log("Property created successfully!");
        setNewProperty({
          name: "",
          timezone: "",
          owner_id: "",
          active: true,
        });
        loadBootstrapData(selectedProperty, selectedMonth);
      } else {
        console.log("Error creating property:", response.error);
      }
    } catch (error) {
      console.error("Error creating property:", error);
    }
  };

  const handleCancelProperty = () => {
    setNewProperty({
      name: "",
      timezone: "",
      owner_id: "",
      active: true,
    });
  };

  // Break period management functions
  const addBreakPeriod = (userId: string) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] || []), { breakStart: "", breakEnd: "" }],
    }));
  };

  const removeBreakPeriod = (userId: string, index: number) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]: prev[userId]?.filter((_, i) => i !== index) || [],
    }));
  };

  const updateBreakPeriod = (
    userId: string,
    index: number,
    field: "breakStart" | "breakEnd",
    value: string
  ) => {
    setBreakPeriods((prev) => ({
      ...prev,
      [userId]:
        prev[userId]?.map((period, i) =>
          i === index ? { ...period, [field]: value } : period
        ) || [],
    }));
  };

  const handleCreatePayment = async () => {
    try {
      if (
        !newPayment.user_id ||
        !newPayment.property_id ||
        !newPayment.amount
      ) {
        alert("Please fill in all required fields");
        return;
      }

      const paymentData = {
        user_id: newPayment.user_id,
        property_id: parseInt(newPayment.property_id),
        amount: parseFloat(newPayment.amount),
        note: newPayment.note,
      };

      console.log("Creating payment:", paymentData);
      const result = await api.createPayment(paymentData);
      console.log("Payment created:", result);

      if (result.success) {
        alert("Payment created successfully!");
        setNewPayment({
          user_id: "",
          property_id: "",
          amount: "",
          note: "",
        });
        // Reload data to show updated ledger
        await loadUsers(selectedProperty);
      } else {
        alert(`Failed to create payment: ${result.error}`);
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      alert("Failed to create payment");
    }
  };

  const handleCancelPayment = () => {
    setNewPayment({
      user_id: "",
      property_id: "",
      amount: "",
      note: "",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Create New Tenant / Add Property Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Create New Tenant / Add Property
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              type="text"
              value={newTenant.name}
              onChange={(e) =>
                setNewTenant({ ...newTenant, name: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter tenant name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={newTenant.email}
              onChange={(e) =>
                setNewTenant({ ...newTenant, email: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter tenant email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property
            </label>
            <select
              value={newTenant.property_id}
              onChange={(e) =>
                setNewTenant({ ...newTenant, property_id: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Property</option>
              {bootstrapData?.properties?.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCreateTenant}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={handleCancelTenant}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Create New Property Section */}
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Create New Property</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Name
            </label>
            <input
              type="text"
              value={newProperty.name}
              onChange={(e) =>
                setNewProperty({ ...newProperty, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter property name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              value={newProperty.timezone}
              onChange={(e) =>
                setNewProperty({ ...newProperty, timezone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Timezone</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner
            </label>
            <select
              value={newProperty.owner_id}
              onChange={(e) =>
                setNewProperty({ ...newProperty, owner_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Owner</option>
              {allUsers
                .filter((user) => user.user_type === "owner")
                .map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.name} ({user.email})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={newProperty.active}
              onChange={(e) =>
                setNewProperty({ ...newProperty, active: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="active"
              className="ml-2 block text-sm text-gray-700"
            >
              Active
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCreateProperty}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save
          </button>
          <button
            onClick={handleCancelProperty}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Create New Payment Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Create New Payment
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User *
            </label>
            <select
              value={newPayment.user_id}
              onChange={(e) =>
                setNewPayment({ ...newPayment, user_id: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select User</option>
              {allUsers
                .filter((user) => user.user_type === "tenant")
                .map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.name} ({user.email})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property *
            </label>
            <select
              value={newPayment.property_id}
              onChange={(e) =>
                setNewPayment({ ...newPayment, property_id: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Property</option>
              {bootstrapData?.properties?.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              value={newPayment.amount}
              onChange={(e) =>
                setNewPayment({ ...newPayment, amount: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter payment amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note
            </label>
            <input
              type="text"
              value={newPayment.note}
              onChange={(e) =>
                setNewPayment({ ...newPayment, note: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional note"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleCreatePayment}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Create Payment
          </button>
          <button
            onClick={handleCancelPayment}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Context Selection */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Context</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property
            </label>
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Property</option>
              {bootstrapData?.properties?.map((property) => (
                <option key={property.property_id} value={property.property_id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Month
            </label>
            <input
              type="month"
              value={selectedMonth ? selectedMonth.substring(0, 7) : ""}
              onChange={(e) => setSelectedMonth(`${e.target.value}-01`)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Utility Settings Grid */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Utility Settings
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Division Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {UTILITIES.map((utility) => (
                <tr key={utility}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                    {utility}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={divisionRules[utility] || "equalshare"}
                      onChange={(e) =>
                        setDivisionRules((prev) => ({
                          ...prev,
                          [utility]: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DIVISION_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      value={utilityAmounts[utility] || ""}
                      onChange={(e) =>
                        setUtilityAmounts((prev) => ({
                          ...prev,
                          [utility]: e.target.value,
                        }))
                      }
                      placeholder="Enter amount"
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-4">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={handleRun}
            disabled={isLoading || !selectedProperty || !selectedMonth}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Run
          </button>
        </div>
      </div>

      {/* Stay Periods Input */}
      {users.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Stay Periods (for bydays calculation)
          </h2>
          <div className="text-sm text-gray-500 mb-4">
            Debug: Users count: {users.length}, Users:{" "}
            {JSON.stringify(users.map((u) => u.name))}
          </div>
          <div className="space-y-6">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <h3 className="text-md font-medium text-gray-900 mb-4">
                  User: {user.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={stayPeriods[user.user_id]?.startDate || ""}
                      onChange={(e) =>
                        setStayPeriods((prev) => ({
                          ...prev,
                          [user.user_id]: {
                            ...prev[user.user_id],
                            startDate: e.target.value,
                          },
                        }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={stayPeriods[user.user_id]?.endDate || ""}
                      onChange={(e) =>
                        setStayPeriods((prev) => ({
                          ...prev,
                          [user.user_id]: {
                            ...prev[user.user_id],
                            endDate: e.target.value,
                          },
                        }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {stayPeriods[user.user_id]?.startDate &&
                  stayPeriods[user.user_id]?.endDate
                    ? `Period: ${stayPeriods[user.user_id].startDate} to ${
                        stayPeriods[user.user_id].endDate
                      }`
                    : "Please select both start and end dates"}
                </div>

                {/* Break Periods */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Break Periods
                    </h4>
                    <button
                      onClick={() => addBreakPeriod(user.user_id)}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                    >
                      Add Break
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(breakPeriods[user.user_id] || []).map(
                      (breakPeriod, index) => (
                        <div
                          key={index}
                          className="flex gap-2 items-end p-3 bg-gray-50 rounded-md"
                        >
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Break Start
                            </label>
                            <input
                              type="date"
                              value={breakPeriod.breakStart}
                              onChange={(e) =>
                                updateBreakPeriod(
                                  user.user_id,
                                  index,
                                  "breakStart",
                                  e.target.value
                                )
                              }
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Break End
                            </label>
                            <input
                              type="date"
                              value={breakPeriod.breakEnd}
                              onChange={(e) =>
                                updateBreakPeriod(
                                  user.user_id,
                                  index,
                                  "breakEnd",
                                  e.target.value
                                )
                              }
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <button
                            onClick={() =>
                              removeBreakPeriod(user.user_id, index)
                            }
                            className="px-2 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                    {(!breakPeriods[user.user_id] ||
                      breakPeriods[user.user_id].length === 0) && (
                      <div className="text-sm text-gray-500 italic">
                        No break periods added yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rent Section */}
      {users.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Rent (Fixed amount per user)
          </h2>
          <div className="text-sm text-gray-500 mb-4">
            Debug: Users count: {users.length}, Users:{" "}
            {JSON.stringify(users.map((u) => u.name))}
          </div>
          <div className="space-y-6">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <h3 className="text-md font-medium text-gray-900 mb-4">
                  User: {user.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Rent
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rentAmounts[user.user_id] || ""}
                      onChange={(e) =>
                        setRentAmounts((prev) => ({
                          ...prev,
                          [user.user_id]: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {rentAmounts[user.user_id] && rentAmounts[user.user_id] > 0
                    ? `Monthly Rent: $${rentAmounts[user.user_id].toFixed(2)}`
                    : "Please enter monthly rent amount"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run Result */}
      {runResult && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Run Result</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-500">Bill Run ID</div>
              <div className="text-lg font-medium">{runResult.bill_run_id}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-500">Lines Created</div>
              <div className="text-lg font-medium">
                {runResult.lines_created}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-500">Total Rent</div>
              <div className="text-lg font-medium">
                ${runResult.totals.rent.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-500">Grand Total</div>
              <div className="text-lg font-medium">
                ${runResult.totals.grand_total.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-8">
          <p className="text-blue-800">{message}</p>
        </div>
      )}

      {/* Dump All Tables */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">All Tables</h2>
          <button
            onClick={handleDumpAll}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            Load All Data
          </button>
        </div>

        {dumpData && (
          <div className="space-y-4">
            {Object.entries(dumpData).map(
              ([tableName, data]: [string, any]) => (
                <div
                  key={tableName}
                  className="border border-gray-200 rounded-md"
                >
                  <details className="p-4">
                    <summary className="cursor-pointer font-medium text-gray-900">
                      {tableName} ({Array.isArray(data) ? data.length : "error"}{" "}
                      records)
                    </summary>
                    <div className="mt-4">
                      {renderDataAsTable(data, tableName)}
                    </div>
                  </details>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
