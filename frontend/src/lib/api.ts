import { createClient } from "@/lib/supabase-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("=== API REQUEST DEBUG ===");
  console.log("Endpoint:", endpoint);
  console.log("Session:", session);
  console.log("Access token:", session?.access_token);

  if (!session) {
    console.error("No session found");
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
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      // JSONパースに失敗した場合は、ステータスコードに基づいてエラーメッセージを生成
      if (response.status === 404) {
        errorData = { error: `Endpoint not found: ${endpoint}` };
      } else if (response.status === 400) {
        errorData = { error: "Bad request." };
      } else {
        errorData = {
          error: `API request failed: ${response.status} ${response.statusText}`,
        };
      }
    }

    const apiError = new Error(errorData.error || "API request failed");
    (apiError as Error & { response: { data: unknown } }).response = {
      data: errorData,
    };
    throw apiError;
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

  // Get bill line data for a specific property or all properties
  getBillLineData: (propertyId?: string) => {
    return apiRequest(`/bill-line${propertyId ? `/${propertyId}` : ""}`);
  },

  // Get rent data for a specific property
  getRentData: (propertyId: string) => {
    return apiRequest(`/rent-data/${propertyId}`);
  },

  // Get all rent data for all properties
  getAllRentData: () => {
    return apiRequest("/rent-data");
  },

  // Add tenant (existing only)
  addTenant: (data: { email: string; propertyId: number }) => {
    return apiRequest("/add-tenant", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get payments for a specific property
  getPayments: (propertyId: string) => {
    return apiRequest(`/payments/${propertyId}`);
  },

  // Get all payments for all properties
  getAllPayments: () => {
    return apiRequest("/payments");
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
  createPropertyForOwner: (data: { name: string; address: string }) => {
    return apiRequest("/properties", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get stay data for a specific property
  getStayData: (propertyId: string) => {
    return apiRequest(`/stay-data/${propertyId}`);
  },

  // Save stay periods
  saveStayPeriods: (data: {
    propertyId: string;
    stayPeriods: Record<string, { startDate: string; endDate: string | null }>;
    breakPeriods?: Record<
      string,
      Array<{ breakStart: string; breakEnd: string }>
    >;
  }) => {
    return apiRequest("/save-stay-periods", {
      method: "POST",
      body: JSON.stringify({
        property_id: data.propertyId,
        stay_periods: data.stayPeriods,
        break_periods: data.breakPeriods,
      }),
    });
  },

  // Run bill calculation
  runBillCalculation: (data: {
    propertyId: string;
    monthStart: string;
    stayPeriods?: Record<string, { startDate: string; endDate: string | null }>;
  }) => {
    return apiRequest("/run-bill", {
      method: "POST",
      body: JSON.stringify({
        property_id: data.propertyId,
        month_start: data.monthStart,
        stay_periods: data.stayPeriods,
      }),
    });
  },

  // Get dashboard data for a specific property
  getDashboardData: (propertyId: string) => {
    return apiRequest(`/dashboard/${propertyId}`);
  },

  // Get all dashboard data for all properties
  getAllDashboardData: () => {
    return apiRequest("/dashboard");
  },

  // Select user type
  selectUserType: (userType: "owner" | "tenant") => {
    return apiRequest("/select-user-type", {
      method: "POST",
      body: JSON.stringify({ user_type: userType }),
    });
  },

  // Get tenant properties
  getTenantProperties: () => {
    return apiRequest("/tenant-properties");
  },

  // Get tenant bill history
  getTenantBillHistory: () => {
    return apiRequest("/tenant-bill-history");
  },

  // Get tenant payments
  getTenantPayments: () => {
    return apiRequest("/tenant-payments");
  },

  // Create tenant payment
  createTenantPayment: (data: {
    property_id: string;
    amount: number;
    note?: string;
  }) => {
    return apiRequest("/create-tenant-payment", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get tenant running balance
  getTenantRunningBalance: () => {
    return apiRequest("/tenant-running-balance");
  },

  // Get nickname for a tenant
  getNickname: (tenantId: string) => {
    return apiRequest(`/owner-tenant/${tenantId}`);
  },

  // Save nickname for a tenant
  saveNickname: (data: { tenant_id: string; nick_name: string }) => {
    return apiRequest("/owner-tenant", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get bill runs for a property
  getBillRuns: (propertyId: string) => {
    return apiRequest(`/bill-runs/${propertyId}`);
  },

  // Calculate bills preview (no DB writes)
  calculateBillsPreview: (data: {
    property_id: string;
    month_start: string;
    stay_periods?: Record<string, unknown>;
  }) => {
    return apiRequest("/calculate-bills-preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Confirm bills calculation (write to DB)
  confirmBillsCalculation: (data: {
    property_id: string;
    month_start: string;
    stay_periods?: Record<string, unknown>;
    previewData: {
      billLines: unknown[];
      ledgerRecords: unknown[];
    };
  }) => {
    return apiRequest("/confirm-bills-calculation", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get latest bill run month for a property
  getLatestBillRunMonth: (propertyId: string) => {
    return apiRequest(`/latest-bill-run-month/${propertyId}`);
  },

  // Get user by ID
  getUserById: (userId: string) => {
    return apiRequest(`/user/${userId}`);
  },

  // Break Period専用のAPI関数
  addBreakPeriod: (data: {
    property_id: string;
    user_id: string;
    break_start: string;
    break_end: string;
  }) => {
    return apiRequest("/break-periods", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteBreakPeriod: (breakRecordId: string) => {
    return apiRequest(`/break-periods/${breakRecordId}`, {
      method: "DELETE",
    });
  },

  // Loan functions
  getLoans: () => {
    return apiRequest("/loans");
  },

  getTenantLoans: () => {
    return apiRequest("/tenant/loans");
  },

  createLoan: (data: {
    tenant_user_id: string;
    amount: number;
    note?: string;
  }) => {
    return apiRequest("/loans", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  markLoanAsPaid: (loanId: string) => {
    return apiRequest(`/loans/${loanId}/paid`, {
      method: "PUT",
    });
  },

  confirmLoan: (loanId: string) => {
    return apiRequest(`/loans/${loanId}/confirm`, {
      method: "PUT",
    });
  },

  // Repayment functions
  getRepayments: () => {
    return apiRequest("/repayments");
  },

  getTenantRepayments: () => {
    return apiRequest("/tenant/repayments");
  },

  createRepayment: (data: {
    owner_user_id: string;
    amount: number;
    note?: string | null;
  }) => {
    return apiRequest("/repayments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  confirmRepayment: (repaymentId: string) => {
    return apiRequest(`/repayments/${repaymentId}/confirm`, {
      method: "PUT",
    });
  },

  // Notification functions
  getNotifications: () => {
    return apiRequest("/notifications");
  },

  markNotificationAsRead: (notificationId: string) => {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  },

  deleteNotification: (notificationId: string) => {
    return apiRequest(`/notifications/${notificationId}`, {
      method: "DELETE",
    });
  },

  // Property billing settings functions
  getPropertyBillingSettings: (propertyId?: string) => {
    const url = propertyId
      ? `/owner/property-billing-settings?property_id=${propertyId}`
      : "/owner/property-billing-settings";
    return apiRequest(url);
  },

  updatePropertyBillingSettings: (data: {
    property_id: string | number;
    payment_day: number;
    notification_lead_days: number;
  }) => {
    return apiRequest("/owner/property-billing-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Get repayment notification settings
  getRepaymentNotificationSettings: (tenantUserId?: string) => {
    const url = tenantUserId
      ? `/owner/repayment-notification-settings?tenant_user_id=${tenantUserId}`
      : "/owner/repayment-notification-settings";
    return apiRequest(url);
  },

  // Update repayment notification settings
  updateRepaymentNotificationSettings: (data: {
    tenant_user_id: string;
    enabled: boolean;
    lead_days: number;
  }) => {
    return apiRequest("/owner/repayment-notification-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Tenant functions
  getOwnerTenants: ({ propertyId }: { propertyId?: string }) => {
    const url = propertyId ? `/rent-data/${propertyId}` : "/rent-data";
    return apiRequest(url);
  },

  // Payment Schedule functions
  getBillRunsForSchedule: () => {
    return apiRequest("/owner/bill-runs-for-schedule");
  },

  getScheduledPayments: () => {
    return apiRequest("/owner/scheduled-payments");
  },

  createPaymentSchedule: (data: {
    bill_run_id: number;
    tenant_user_id: string;
    property_id: number;
    total_amount: number;
    schedule_type: string;
    reference_date_type?: string;
    specific_month?: string;
    specific_date?: number;
    installment_count?: number;
  }) => {
    return apiRequest("/owner/create-payment-schedule", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Tenant Payment Schedule functions
  getTenantScheduledPayments: () => {
    return apiRequest("/tenant/scheduled-payments");
  },

  // payScheduledPayment: REMOVED - Auto-allocation feature has been removed

  // Owner Repayment Schedule functions
  getLoansForSchedule: () => {
    return apiRequest("/owner/loans-for-schedule");
  },

  getScheduledRepayments: () => {
    return apiRequest("/owner/scheduled-repayments");
  },

  createRepaymentSchedule: (data: {
    loan_id: string;
    schedule_type:
      | "month_start"
      | "month_end"
      | "specific_date"
      | "installment";
    specific_month?: string;
    specific_date?: number;
    installment_count?: number;
    installment_start_date?: string;
    installment_period_days?: number;
  }) => {
    return apiRequest("/owner/create-repayment-schedule", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Tenant pays a specific scheduled repayment
  payScheduledRepayment: (data: {
    target_repayment_id: string;
    amount: number;
    note?: string;
  }) => {
    return apiRequest("/tenant/pay-scheduled-repayment", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Tenant Repayment Schedule functions
  getTenantScheduledRepayments: () => {
    return apiRequest("/tenant/scheduled-repayments");
  },
};
