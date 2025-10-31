"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

interface Loan {
  loan_id: string;
  owner_user_id: string;
  tenant_user_id: string;
  amount: number;
  note?: string | null;
  created_date: string;
  tenant?: {
    user_id: string;
    name: string;
    email: string;
  };
}

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  property_id: string;
  property_name: string;
}

interface Repayment {
  repayment_id: string;
  owner_user_id: string;
  tenant_user_id: string;
  amount: number;
  repayment_date: string;
  note?: string | null;
  status: "unpaid" | "pending" | "confirmed";
  confirmed_date?: string | null;
  processed: boolean;
  tenant?: {
    user_id: string;
    name: string;
    email: string;
  };
}

interface ScheduledRepayment {
  repayment_id: string;
  owner_user_id: string;
  tenant_user_id: string;
  loan_id: string;
  amount: number;
  amount_paid?: number;
  is_auto_paid?: boolean;
  repayment_date: string;
  note?: string | null;
  status: "unpaid" | "pending" | "confirmed";
  confirmed_date?: string | null;
  processed: boolean;
  due_date: string;
  tenant?: {
    user_id: string;
    name: string;
    email: string;
    nick_name?: string | null;
  };
  loan: {
    loan_id: string;
    amount: number;
    created_date: string;
    note?: string | null;
  };
  remaining_amount?: number;
}

export default function Loan() {
  const { userProperties, selectedProperty, setSelectedProperty } =
    useProperty();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [scheduledRepayments, setScheduledRepayments] = useState<
    ScheduledRepayment[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRepayments, setIsLoadingRepayments] = useState(false);
  const [showCreateLoanModal, setShowCreateLoanModal] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]); // Add state for all tenants

  const fetchTenants = useCallback(async () => {
    try {
      const allPropertiesTenants = await Promise.all(
        userProperties.map(async (p) => {
          const res = await api.getOwnerTenants({ propertyId: p.property_id });
          return res.tenants.map((t: Tenant) => ({
            user_id: t.user_id,
            name: t.name,
            email: t.email,
            property_id: p.property_id,
            property_name: p.name,
          }));
        })
      );
      setTenants(allPropertiesTenants.flat());
    } catch (error) {
      console.error("Error loading tenants:", error);
    }
  }, [userProperties]);

  const fetchLoans = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getLoans();
      setLoans(data.loans);
    } catch (error) {
      console.error("Error loading loans:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRepayments = useCallback(async () => {
    try {
      setIsLoadingRepayments(true);
      const data = await api.getRepayments();
      setRepayments(data.repayments);
    } catch (error) {
      console.error("Error loading repayments:", error);
    } finally {
      setIsLoadingRepayments(false);
    }
  }, []);

  const fetchScheduledRepayments = useCallback(async () => {
    try {
      const data = await api.getScheduledRepayments();
      setScheduledRepayments(data.scheduled_repayments || []);
    } catch (error) {
      console.error("Error loading scheduled repayments:", error);
    }
  }, []);

  // 初期データ読み込み
  useEffect(() => {
    fetchLoans();
    fetchRepayments();
    fetchScheduledRepayments();
    fetchTenants();
    // PropertyContextが既に初期設定をしているので、ここでは何もしない
  }, [fetchTenants, fetchLoans, fetchRepayments, fetchScheduledRepayments]);

  // Filter and group tenants based on selected property
  const { groupedTenants } = useMemo(() => {
    const filtered = selectedProperty
      ? tenants.filter(
          (t) =>
            t.property_id.toString() === selectedProperty.property_id.toString()
        )
      : tenants;

    // Group tenants by user_id and combine property names
    const grouped = filtered.reduce((acc, tenant) => {
      if (!acc[tenant.user_id]) {
        acc[tenant.user_id] = {
          user_id: tenant.user_id,
          name: tenant.name,
          email: tenant.email,
          properties: [],
        };
      }
      acc[tenant.user_id].properties.push(tenant.property_name);
      return acc;
    }, {} as Record<string, { user_id: string; name: string; email: string; properties: string[] }>);

    const finalGrouped = Object.values(grouped).map((group) => ({
      ...group,
      display_name: `${group.name} (${group.properties.join(", ")})`,
    }));

    return {
      groupedTenants: finalGrouped,
    };
  }, [selectedProperty, tenants]);

  // Filter loans based on selected property
  const filteredLoans = useMemo(() => {
    // All Propertiesが選択されている場合
    if (!selectedProperty) {
      return loans;
    }

    // 選択されたプロパティのテナントID一覧を取得
    const targetTenantIds = tenants
      .filter(
        (t) =>
          t.property_id.toString() === selectedProperty.property_id.toString()
      )
      .map((t) => t.user_id);

    // そのテナントのloansだけをフィルタリング
    return loans.filter((loan) =>
      targetTenantIds.includes(loan.tenant_user_id)
    );
  }, [loans, tenants, selectedProperty]);

  // Filter repayments based on selected property
  const filteredRepayments = useMemo(() => {
    // All Propertiesが選択されている場合
    if (!selectedProperty) {
      return repayments;
    }

    // 選択されたプロパティのテナントID一覧を取得
    const targetTenantIds = tenants
      .filter(
        (t) =>
          t.property_id.toString() === selectedProperty.property_id.toString()
      )
      .map((t) => t.user_id);

    // そのテナントのrepaymentsだけをフィルタリング
    return repayments.filter((repayment) =>
      targetTenantIds.includes(repayment.tenant_user_id)
    );
  }, [repayments, tenants, selectedProperty]);

  // Filter scheduled repayments based on selected property
  const filteredScheduledRepayments = useMemo(() => {
    if (!selectedProperty) {
      return scheduledRepayments;
    }
    const targetTenantIds = tenants
      .filter(
        (t) =>
          t.property_id.toString() === selectedProperty.property_id.toString()
      )
      .map((t) => t.user_id);
    return scheduledRepayments.filter((repayment) =>
      targetTenantIds.includes(repayment.tenant_user_id)
    );
  }, [scheduledRepayments, tenants, selectedProperty]);

  // Confirm repayment handler
  const handleConfirmRepayment = async (repaymentId: string) => {
    try {
      await api.confirmRepayment(repaymentId);
      fetchRepayments();
      fetchScheduledRepayments();
    } catch (error) {
      console.error("Error confirming repayment:", error);
      alert("Failed to confirm repayment");
    }
  };

  // プロパティ選択変更
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

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header with Property Dropdown and Create Loan Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <label className="text-gray-700 font-semibold">Property:</label>
          <select
            value={selectedProperty?.property_id || ""}
            onChange={handlePropertyChange}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Properties</option>
            {userProperties.map((property) => (
              <option key={property.property_id} value={property.property_id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowCreateLoanModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Create Loan
        </button>
      </div>

      {/* Loan Records Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Loans</h2>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading loans...</div>
        ) : filteredLoans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No loans found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Tenant
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Created Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => (
                  <tr
                    key={loan.loan_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {loan.tenant?.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {loan.tenant?.email || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-semibold">
                      ${loan.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(loan.created_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {loan.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scheduled Repayments Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Scheduled Repayments
          </h2>
        </div>

        {filteredScheduledRepayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No scheduled repayments found
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0">
            {/* Header */}
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Tenant
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Loan Created
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Due Date
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Amount
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Status
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Confirmed Date
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Progress
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200">
              Action
            </div>

            {/* Data rows */}
            {filteredScheduledRepayments.map((repayment) => (
              <div key={repayment.repayment_id} className="contents">
                <div className="text-left py-3">
                  <div className="font-semibold text-gray-900">
                    {repayment.tenant?.nick_name ||
                      repayment.tenant?.name ||
                      "Unknown"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {repayment.tenant?.email || "N/A"}
                  </div>
                </div>
                <div className="text-gray-600 py-3">
                  {repayment.loan?.created_date
                    ? new Date(repayment.loan.created_date).toLocaleDateString()
                    : "N/A"}
                  {repayment.loan?.note && (
                    <div className="text-xs text-gray-500 mt-1">
                      {repayment.loan.note}
                    </div>
                  )}
                </div>
                <div className="text-gray-600 py-3">
                  {new Date(repayment.due_date).toLocaleDateString()}
                </div>
                <div className="py-3">
                  <div className="text-lg font-bold">
                    ${repayment.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Loan: $
                    {repayment.loan?.amount != null
                      ? Number(repayment.loan.amount).toFixed(2)
                      : "0.00"}
                  </div>
                </div>
                <div className="py-3">
                  {(() => {
                    const paid = Number(repayment.amount_paid || 0);
                    const total = Number(repayment.amount);
                    const isConfirmed = repayment.status === "confirmed";
                    const isPending = repayment.status === "pending";
                    const isPartial =
                      (repayment.status as string) === "partially_paid" ||
                      (isPending && paid > 0 && paid < total);

                    const badgeClass = isConfirmed
                      ? "bg-green-100 text-green-700"
                      : isPartial
                      ? "bg-blue-100 text-blue-700"
                      : isPending
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700";

                    const label = isConfirmed
                      ? "confirmed"
                      : isPartial
                      ? "Partially Paid"
                      : isPending
                      ? "pending"
                      : "unpaid";

                    return (
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${badgeClass}`}
                      >
                        {label}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-sm text-gray-600 py-3">
                  {repayment.confirmed_date
                    ? new Date(repayment.confirmed_date).toLocaleDateString()
                    : "--/--/--"}
                </div>
                <div className="py-3 text-sm text-gray-700">
                  <div>
                    Paid: ${Number(repayment.amount_paid || 0).toFixed(2)}
                    {"  "}Remaining: $
                    {Number(
                      repayment.remaining_amount ??
                        repayment.amount - Number(repayment.amount_paid || 0)
                    ).toFixed(2)}
                    {repayment.is_auto_paid ? (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        auto
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="py-3">
                  {repayment.status === "pending" &&
                  Number(repayment.amount_paid || 0) >=
                    Number(repayment.amount) ? (
                    <button
                      onClick={() =>
                        handleConfirmRepayment(repayment.repayment_id)
                      }
                      className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                    >
                      Confirm
                    </button>
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Loan Modal */}
      {showCreateLoanModal && (
        <CreateLoanModal
          groupedTenants={groupedTenants}
          onClose={() => setShowCreateLoanModal(false)}
          onCreateSuccess={() => {
            setShowCreateLoanModal(false);
            fetchLoans();
            fetchScheduledRepayments();
          }}
        />
      )}
    </div>
  );
}

interface CreateLoanModalProps {
  groupedTenants: Array<{
    user_id: string;
    name: string;
    email: string;
    properties: string[];
    display_name: string;
  }>;
  onClose: () => void;
  onCreateSuccess: () => void;
}

function CreateLoanModal({
  groupedTenants,
  onClose,
  onCreateSuccess,
}: CreateLoanModalProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [scheduleType, setScheduleType] = useState<
    "month_start" | "month_end" | "specific_date" | "installment" | ""
  >("");
  const [monthStartMonth, setMonthStartMonth] = useState<string>("");
  const [monthStartCount, setMonthStartCount] = useState<number>(2);
  const [monthStartCountInput, setMonthStartCountInput] = useState<string>("2");
  const [monthEndMonth, setMonthEndMonth] = useState<string>("");
  const [monthEndCount, setMonthEndCount] = useState<number>(2);
  const [monthEndCountInput, setMonthEndCountInput] = useState<string>("2");
  const [specificDate, setSpecificDate] = useState<string>("");
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentCountInput, setInstallmentCountInput] =
    useState<string>("2");
  const [installmentStartDate, setInstallmentStartDate] = useState<string>("");
  const [installmentPeriodDays, setInstallmentPeriodDays] =
    useState<number>(30);
  const [installmentPeriodDaysInput, setInstallmentPeriodDaysInput] =
    useState<string>("30");
  const [preview, setPreview] = useState<
    Array<{
      installment_number: number;
      due_date: string;
      amount: number;
    }>
  >([]);
  const [error, setError] = useState<string>("");

  // Initialize dates when modal opens (runs every time component mounts)
  useEffect(() => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthString = `${nextMonth.getFullYear()}-${String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0")}-${String(nextMonth.getDate()).padStart(2, "0")}`;

    // Month Start: always next month
    const nextMonthStringForMonth = `${nextMonth.getFullYear()}-${String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0")}`;

    // Month End: current month if today is not the last day, otherwise next month
    const lastDayOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();
    const isLastDayOfMonth = today.getDate() === lastDayOfCurrentMonth;
    const monthEndDefaultMonth = isLastDayOfMonth ? nextMonth : today;
    const monthEndMonthString = `${monthEndDefaultMonth.getFullYear()}-${String(
      monthEndDefaultMonth.getMonth() + 1
    ).padStart(2, "0")}`;

    setSpecificDate(nextMonthString);
    setInstallmentStartDate(todayString);
    setInstallmentCount(2);
    setInstallmentCountInput("2");
    setMonthStartMonth(nextMonthStringForMonth); // Next month for Month Start
    setMonthStartCount(2);
    setMonthStartCountInput("2");
    setMonthEndMonth(monthEndMonthString); // Current month if not last day, else next month
    setMonthEndCount(2);
    setMonthEndCountInput("2");
    // Reset other states when modal opens
    setSelectedTenantId(null);
    setAmount("");
    setNote("");
    setScheduleType("");
    setError("");
    setPreview([]);
  }, []);

  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  // Calculate preview based on amount input
  const calculatePreview = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0 || !scheduleType) {
      setPreview([]);
      return;
    }

    const totalAmount = parseFloat(amount);
    let previews: Array<{
      installment_number: number;
      due_date: string;
      amount: number;
    }> = [];

    if (scheduleType === "month_start") {
      if (!monthStartMonth) {
        setPreview([]);
        return;
      }
      const [year, month] = monthStartMonth.split("-").map(Number);
      const baseAmount = Math.floor(totalAmount / monthStartCount);
      const remainder = totalAmount - baseAmount * monthStartCount;

      for (let i = 0; i < monthStartCount; i++) {
        const dueDate = new Date(year, month - 1 + i, 1);
        const installmentAmount =
          i === monthStartCount - 1 ? baseAmount + remainder : baseAmount;
        previews.push({
          installment_number: i + 1,
          due_date: formatDate(dueDate),
          amount: installmentAmount,
        });
      }
    } else if (scheduleType === "month_end") {
      if (!monthEndMonth) {
        setPreview([]);
        return;
      }
      const [year, month] = monthEndMonth.split("-").map(Number);
      const baseAmount = Math.floor(totalAmount / monthEndCount);
      const remainder = totalAmount - baseAmount * monthEndCount;

      for (let i = 0; i < monthEndCount; i++) {
        const dueDate = new Date(year, month + i, 0); // Last day of month
        const installmentAmount =
          i === monthEndCount - 1 ? baseAmount + remainder : baseAmount;
        previews.push({
          installment_number: i + 1,
          due_date: formatDate(dueDate),
          amount: installmentAmount,
        });
      }
    } else if (scheduleType === "specific_date") {
      if (!specificDate) {
        setPreview([]);
        return;
      }
      const [year, month, day] = specificDate.split("-").map(Number);
      const dueDate = new Date(year, month - 1, day);
      previews = [
        {
          installment_number: 1,
          due_date: formatDate(dueDate),
          amount: totalAmount,
        },
      ];
    } else if (scheduleType === "installment") {
      if (!installmentStartDate) {
        setPreview([]);
        return;
      }
      const [year, month, day] = installmentStartDate.split("-").map(Number);
      const start = new Date(year, month - 1, day);
      const totalDays = Math.max(1, installmentPeriodDays);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + (totalDays - 1));

      const baseAmount = Math.floor(totalAmount / installmentCount);
      const remainder = totalAmount - baseAmount * installmentCount;

      // 新しい順方向ロジック: 期間内を均等に分割
      const interval = totalDays / installmentCount;

      for (let i = 1; i <= installmentCount; i++) {
        let dueDate: Date;
        if (i === installmentCount) {
          // 最後の支払いは必ずendDate
          dueDate = new Date(endDate);
        } else {
          // Installment i: start + (i * interval) - 1日
          const daysOffset = i * interval - 1;
          dueDate = new Date(start);
          dueDate.setDate(dueDate.getDate() + Math.round(daysOffset));
        }

        const installmentAmount =
          i === installmentCount ? baseAmount + remainder : baseAmount;
        previews.push({
          installment_number: i,
          due_date: formatDate(dueDate),
          amount: installmentAmount,
        });
      }
    }

    setPreview(previews);
  }, [
    amount,
    scheduleType,
    monthStartMonth,
    monthStartCount,
    monthEndMonth,
    monthEndCount,
    specificDate,
    installmentCount,
    installmentStartDate,
    installmentPeriodDays,
  ]);

  // Update preview when inputs change
  useEffect(() => {
    if (amount && scheduleType) {
      calculatePreview();
    } else {
      setPreview([]);
    }
  }, [amount, scheduleType, calculatePreview]);

  const validateSchedule = (): string | null => {
    if (!scheduleType) return null;

    if (scheduleType === "month_start") {
      if (!monthStartMonth) {
        return "Please select a start month";
      }
      if (monthStartCount < 2) {
        return "Installment count must be at least 2";
      }
      if (monthStartCount > 24) {
        return "Installment count cannot exceed 24 (2 years)";
      }
    }

    if (scheduleType === "month_end") {
      if (!monthEndMonth) {
        return "Please select a start month";
      }
      if (monthEndCount < 2) {
        return "Installment count must be at least 2";
      }
      if (monthEndCount > 24) {
        return "Installment count cannot exceed 24 (2 years)";
      }
    }

    if (scheduleType === "specific_date") {
      if (!specificDate) {
        return "Please select a date";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [year, month, day] = specificDate.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return "Cannot select a date in the past";
      }
    }

    if (scheduleType === "installment") {
      if (!installmentStartDate) {
        return "Please select a start date";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [year, month, day] = installmentStartDate.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return "Cannot select a date in the past";
      }
      if (installmentCount < 2) {
        return "Installment count must be at least 2";
      }
      if (installmentCount > installmentPeriodDays) {
        return `Installment count cannot exceed payment period (${installmentPeriodDays} days)`;
      }
      if (installmentPeriodDays < 1 || installmentPeriodDays > 365) {
        return "Payment period must be between 1 and 365 days";
      }
    }

    return null;
  };

  const handleCreateLoan = async () => {
    if (!selectedTenantId || !amount) {
      setError("Please select a tenant and enter an amount.");
      return;
    }

    if (!scheduleType) {
      setError("Please select a repayment schedule plan.");
      return;
    }

    const scheduleError = validateSchedule();
    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      // Create loan
      const loanResponse = await api.createLoan({
        tenant_user_id: selectedTenantId,
        amount: parseFloat(amount),
        note,
      });

      const loanId = loanResponse.loan?.loan_id;

      if (!loanId) {
        throw new Error("Failed to get loan ID after creation");
      }

      // Create schedule if enabled
      if (scheduleType && loanId) {
        try {
          await api.createRepaymentSchedule({
            loan_id: loanId,
            schedule_type: scheduleType,
            specific_month:
              scheduleType === "specific_date"
                ? specificDate.substring(0, 7)
                : scheduleType === "month_start"
                ? monthStartMonth
                : scheduleType === "month_end"
                ? monthEndMonth
                : undefined,
            specific_date:
              scheduleType === "specific_date"
                ? parseInt(specificDate.substring(8, 10))
                : undefined,
            installment_count:
              scheduleType === "installment"
                ? installmentCount
                : scheduleType === "month_start"
                ? monthStartCount
                : scheduleType === "month_end"
                ? monthEndCount
                : undefined,
            installment_start_date:
              scheduleType === "installment" ? installmentStartDate : undefined,
            installment_period_days:
              scheduleType === "installment"
                ? installmentPeriodDays
                : undefined,
          });
        } catch (scheduleError) {
          console.error("Error creating schedule:", scheduleError);
          alert(
            "Loan created successfully, but failed to create repayment schedule. You can create it later from the Scheduled Repayments section."
          );
        }
      }

      onCreateSuccess();
    } catch (error) {
      console.error("Error creating loan:", error);
      setError("Failed to create loan.");
    } finally {
      setIsCreating(false);
    }
  };

  const todayString = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create Loan</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={isCreating}
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Loan Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Loan Information
              </h3>
              <div className="space-y-4">
                <div>
          <label
            htmlFor="tenant"
                    className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tenant:
          </label>
          <select
            id="tenant"
            value={selectedTenantId || ""}
            onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isCreating}
          >
            <option value="">Select a tenant</option>
            {groupedTenants.map((tenant) => (
              <option key={tenant.user_id} value={tenant.user_id}>
                {tenant.display_name}
              </option>
            ))}
          </select>
        </div>
                <div>
          <label
            htmlFor="amount"
                    className="block text-sm font-medium text-gray-700 mb-1"
          >
            Amount:
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter loan amount"
            min="0"
                    step="0.01"
                    disabled={isCreating}
          />
        </div>
                <div>
          <label
            htmlFor="note"
                    className="block text-sm font-medium text-gray-700 mb-1"
          >
            Note (Optional):
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="Add a note for the loan"
                    disabled={isCreating}
          ></textarea>
        </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Repayment Schedule Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Repayment Schedule
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repayment Plan:
                  </label>
                  <div className="space-y-2">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="month_start"
                          checked={scheduleType === "month_start"}
                          onChange={(e) =>
                            setScheduleType(
                              e.target.value as typeof scheduleType
                            )
                          }
                          className="mr-2"
                          disabled={isCreating}
                        />
                        <span>Month Start</span>
                      </label>
                      {scheduleType === "month_start" && (
                        <div className="ml-6 mt-2 space-y-2">
                          <div>
                            <label className="text-sm text-gray-600">
                              Start Month:
                            </label>
                            <input
                              type="month"
                              value={monthStartMonth}
                              onChange={(e) =>
                                setMonthStartMonth(e.target.value)
                              }
                              min={(() => {
                                // Month Start: always next month
                                const today = new Date();
                                const nextMonth = new Date(
                                  today.getFullYear(),
                                  today.getMonth() + 1,
                                  1
                                );
                                return `${nextMonth.getFullYear()}-${String(
                                  nextMonth.getMonth() + 1
                                ).padStart(2, "0")}`;
                              })()}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                              disabled={isCreating}
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Installments:
                            </label>
                            <input
                              type="number"
                              value={monthStartCountInput}
                              onChange={(e) => {
                                const v = e.target.value;
                                setMonthStartCountInput(v);
                                const n = parseInt(v, 10);
                                if (!Number.isNaN(n)) {
                                  const clamped = Math.min(24, Math.max(2, n));
                                  setMonthStartCount(clamped);
                                }
                              }}
                              onBlur={() => {
                                const n = parseInt(monthStartCountInput, 10);
                                if (Number.isNaN(n)) {
                                  setMonthStartCountInput(
                                    String(monthStartCount)
                                  );
                                } else {
                                  const clamped = Math.min(24, Math.max(2, n));
                                  setMonthStartCount(clamped);
                                  setMonthStartCountInput(String(clamped));
                                }
                              }}
                              min={2}
                              max={24}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded w-24"
                              disabled={isCreating}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Number of installments (2-24)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="month_end"
                          checked={scheduleType === "month_end"}
                          onChange={(e) =>
                            setScheduleType(
                              e.target.value as typeof scheduleType
                            )
                          }
                          className="mr-2"
                          disabled={isCreating}
                        />
                        <span>Month End</span>
                      </label>
                      {scheduleType === "month_end" && (
                        <div className="ml-6 mt-2 space-y-2">
                          <div>
                            <label className="text-sm text-gray-600">
                              Start Month:
                            </label>
                            <input
                              type="month"
                              value={monthEndMonth}
                              onChange={(e) => setMonthEndMonth(e.target.value)}
                              min={(() => {
                                // Month End: current month if today is not the last day, otherwise next month
                                const today = new Date();
                                const lastDayOfCurrentMonth = new Date(
                                  today.getFullYear(),
                                  today.getMonth() + 1,
                                  0
                                ).getDate();
                                const isLastDayOfMonth =
                                  today.getDate() === lastDayOfCurrentMonth;
                                const minMonth = isLastDayOfMonth
                                  ? new Date(
                                      today.getFullYear(),
                                      today.getMonth() + 1,
                                      1
                                    )
                                  : today;
                                return `${minMonth.getFullYear()}-${String(
                                  minMonth.getMonth() + 1
                                ).padStart(2, "0")}`;
                              })()}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                              disabled={isCreating}
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Installments:
                            </label>
                            <input
                              type="number"
                              value={monthEndCountInput}
                              onChange={(e) => {
                                const v = e.target.value;
                                setMonthEndCountInput(v);
                                const n = parseInt(v, 10);
                                if (!Number.isNaN(n)) {
                                  const clamped = Math.min(24, Math.max(2, n));
                                  setMonthEndCount(clamped);
                                }
                              }}
                              onBlur={() => {
                                const n = parseInt(monthEndCountInput, 10);
                                if (Number.isNaN(n)) {
                                  setMonthEndCountInput(String(monthEndCount));
                                } else {
                                  const clamped = Math.min(24, Math.max(2, n));
                                  setMonthEndCount(clamped);
                                  setMonthEndCountInput(String(clamped));
                                }
                              }}
                              min={2}
                              max={24}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded w-24"
                              disabled={isCreating}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Number of installments (2-24)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="specific_date"
                          checked={scheduleType === "specific_date"}
                          onChange={(e) =>
                            setScheduleType(
                              e.target.value as typeof scheduleType
                            )
                          }
                          className="mr-2"
                          disabled={isCreating}
                        />
                        <span>Specific Date - Lump Sum</span>
                      </label>
                      {scheduleType === "specific_date" && (
                        <div className="ml-6 mt-2 space-y-2">
                          <div>
                            <label className="text-sm text-gray-600">
                              Select Date:
                            </label>
                            <input
                              type="date"
                              value={specificDate}
                              onChange={(e) => setSpecificDate(e.target.value)}
                              min={todayString}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                              disabled={isCreating}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="installment"
                          checked={scheduleType === "installment"}
                          onChange={(e) =>
                            setScheduleType(
                              e.target.value as typeof scheduleType
                            )
                          }
                          className="mr-2"
                          disabled={isCreating}
                        />
                        <span>Installment</span>
                      </label>
                      {scheduleType === "installment" && (
                        <div className="ml-6 mt-2 space-y-2">
                          <div>
                            <label className="text-sm text-gray-600">
                              Select Start Date:
                            </label>
                            <input
                              type="date"
                              value={installmentStartDate}
                              onChange={(e) =>
                                setInstallmentStartDate(e.target.value)
                              }
                              min={todayString}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                              disabled={isCreating}
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Installments:
                            </label>
                            <input
                              type="number"
                              value={installmentCountInput}
                              onChange={(e) => {
                                const v = e.target.value;
                                setInstallmentCountInput(v);
                                const n = parseInt(v, 10);
                                if (!Number.isNaN(n)) {
                                  const clamped = Math.min(
                                    installmentPeriodDays,
                                    Math.max(2, n)
                                  );
                                  setInstallmentCount(clamped);
                                }
                              }}
                              onBlur={() => {
                                const n = parseInt(installmentCountInput, 10);
                                if (Number.isNaN(n)) {
                                  setInstallmentCountInput(
                                    String(installmentCount)
                                  );
                                } else {
                                  const clamped = Math.min(
                                    installmentPeriodDays,
                                    Math.max(2, n)
                                  );
                                  setInstallmentCount(clamped);
                                  setInstallmentCountInput(String(clamped));
                                }
                              }}
                              min={2}
                              max={installmentPeriodDays}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded w-24"
                              disabled={isCreating}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Number of installments (2-{installmentPeriodDays})
                            </p>
                          </div>
                          <div>
                            <label className="text-sm text-gray-600">
                              Payment Period (Days):
                            </label>
                            <input
                              type="number"
                              value={installmentPeriodDaysInput}
                              onChange={(e) => {
                                const v = e.target.value;
                                setInstallmentPeriodDaysInput(v);
                                const n = parseInt(v, 10);
                                if (!Number.isNaN(n)) {
                                  const clamped = Math.min(365, Math.max(1, n));
                                  setInstallmentPeriodDays(clamped);
                                  // Payment Periodが変更されたら、installmentCountを調整
                                  if (installmentCount > clamped) {
                                    setInstallmentCount(clamped);
                                    setInstallmentCountInput(String(clamped));
                                  }
                                }
                              }}
                              onBlur={() => {
                                const n = parseInt(
                                  installmentPeriodDaysInput,
                                  10
                                );
                                if (Number.isNaN(n)) {
                                  setInstallmentPeriodDaysInput(
                                    String(installmentPeriodDays)
                                  );
                                } else {
                                  const clamped = Math.min(365, Math.max(1, n));
                                  setInstallmentPeriodDays(clamped);
                                  setInstallmentPeriodDaysInput(
                                    String(clamped)
                                  );
                                  // Payment Periodが変更されたら、installmentCountを調整
                                  if (installmentCount > clamped) {
                                    setInstallmentCount(clamped);
                                    setInstallmentCountInput(String(clamped));
                                  }
                                }
                              }}
                              min={1}
                              max={365}
                              className="ml-2 px-2 py-1 border border-gray-300 rounded"
                              disabled={isCreating}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Number of days from start date to final payment
                              (1-365)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {scheduleType && preview.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <h3 className="font-semibold mb-2">Preview:</h3>
                    <div className="space-y-1 text-sm max-h-[200px] overflow-y-auto pr-2">
                      {preview.map((p) => {
                        const [year, month, day] = p.due_date.split("-");
                        const displayDate = `${month}/${day}/${year}`;
                        return (
                          <div
                            key={p.installment_number}
                            className="flex justify-between"
                          >
                            <span>
                              {preview.length > 1
                                ? `Installment ${p.installment_number}: `
                                : ""}
                              {displayDate}
                            </span>
                            <span className="font-semibold">
                              ${p.amount.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-2 mt-2 border-t border-gray-300 flex justify-between font-bold text-sm">
                      <span>Total:</span>
                      <span>
                        $
                        {preview
                          .reduce((sum, p) => sum + p.amount, 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateLoan}
              disabled={
                isCreating ||
                !selectedTenantId ||
                !amount ||
                !scheduleType ||
                (scheduleType === "installment" && !installmentStartDate) ||
                (scheduleType === "specific_date" && !specificDate) ||
                (scheduleType === "month_start" && !monthStartMonth) ||
                (scheduleType === "month_end" && !monthEndMonth)
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create Loan"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
