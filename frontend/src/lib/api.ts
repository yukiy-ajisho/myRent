import { createClient } from "@/lib/supabase-client";

const API_BASE_URL = "http://localhost:4000";

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No session found");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "API request failed");
  }

  return response.json();
}

export const api = {
  // Bootstrap data
  getBootstrap: (propertyId?: string, monthStart?: string) => {
    const params = new URLSearchParams();
    if (propertyId) params.append("property_id", propertyId);
    if (monthStart) params.append("month_start", monthStart);

    return apiRequest(`/bootstrap?${params.toString()}`);
  },

  // Save division rules
  saveDivisionRules: (data: {
    property_id: string;
    items: Array<{ utility: string; method: string }>;
  }) => {
    return apiRequest("/save-division-rules", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Save stay periods
  saveStayPeriods: (data: {
    property_id: string;
    stay_periods: Record<string, { startDate: string; endDate: string }>;
    break_periods?: Record<
      string,
      Array<{ breakStart: string; breakEnd: string }>
    >;
  }) => {
    return apiRequest("/save-stay-periods", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Save utility actual
  saveUtilityActual: (data: {
    property_id: string;
    month_start: string;
    utility: string;
    amount: number | null;
  }) => {
    return apiRequest("/utility-actual", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Save rent
  saveRent: (data: {
    property_id: string;
    rent_amounts: Record<string, number>;
  }) => {
    return apiRequest("/save-rent", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Run bill calculation
  runBill: (data: {
    property_id: string;
    month_start: string;
    stay_periods?: Record<string, { startDate: string; endDate: string }>;
  }) => {
    return apiRequest("/run-bill", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Dump all tables
  dumpAll: () => {
    return apiRequest("/dump-all");
  },

  // Create tenant
  createTenant: (data: {
    name: string;
    email: string;
    user_type: string;
    property_id: string;
  }) => {
    return apiRequest("/create-tenant", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Create property
  createProperty: (data: {
    name: string;
    timezone: string;
    owner_id: string;
    active?: boolean;
  }) => {
    return apiRequest("/create-property", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Create payment
  createPayment: (data: {
    user_id: string;
    property_id: number;
    amount: number;
    note?: string;
  }) => {
    return apiRequest("/create-payment", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get user properties
  getUserProperties: () => {
    return apiRequest("/user-properties");
  },

  // Check user exists
  checkUser: (userId: string) => {
    return apiRequest("/check-user", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  // Get bill line data for a specific property
  getBillLineData: (propertyId: string) => {
    return apiRequest(`/bill-line/${propertyId}`);
  },

  // Get rent data for a specific property
  getRentData: (propertyId: string) => {
    return apiRequest(`/rent-data/${propertyId}`);
  },

  // Add tenant (new or existing)
  addTenant: (data: {
    name: string;
    email: string;
    personal_multiplier: number;
    propertyId: string;
  }) => {
    return apiRequest("/add-tenant", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get payments for a specific property
  getPayments: (propertyId: string) => {
    return apiRequest(`/payments/${propertyId}`);
  },

  // Accept payment (add to ledger)
  acceptPayment: (paymentId: string) => {
    return apiRequest(`/payments/${paymentId}/accept`, {
      method: "POST",
    });
  },

  // Get owner's properties
  getProperties: () => {
    return apiRequest("/properties");
  },

  // Create new property
  createProperty: (data: { name: string; address: string }) => {
    return apiRequest("/properties", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
