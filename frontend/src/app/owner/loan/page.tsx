"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

interface Loan {
  loan_id: string;
  owner_user_id: string;
  tenant_user_id: string;
  amount: number;
  status: "pending" | "paid" | "confirmed";
  note?: string | null;
  created_date: string;
  paid_date?: string | null;
  confirmed_date?: string | null;
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
  status: "pending" | "confirmed";
  confirmed_date?: string | null;
  processed: boolean;
  tenant?: {
    user_id: string;
    name: string;
    email: string;
  };
}

export default function Loan() {
  const { userProperties, selectedProperty, setSelectedProperty } =
    useProperty();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
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

  // 初期データ読み込み
  useEffect(() => {
    fetchLoans();
    fetchRepayments();
    fetchTenants();
    // PropertyContextが既に初期設定をしているので、ここでは何もしない
  }, [fetchTenants, fetchLoans, fetchRepayments]);

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

  // Confirm repayment handler
  const handleConfirmRepayment = async (repaymentId: string) => {
    try {
      await api.confirmRepayment(repaymentId);
      fetchRepayments();
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
          <div className="grid grid-cols-8 gap-0">
            {/* Header row */}
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Tenant
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Status
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Created Date
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Paid Date
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Confirmed Date
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Note
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Amount
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Action
            </div>

            {/* Data rows */}
            {filteredLoans.map((loan) => (
              <div key={loan.loan_id} className="contents">
                <div className="py-3 overflow-hidden">
                  <div className="text-lg font-semibold text-gray-900">
                    {loan.tenant?.name || "Unknown"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {loan.tenant?.email || "N/A"}
                  </div>
                </div>
                <div
                  className={`py-3 overflow-hidden ${
                    loan.status === "confirmed"
                      ? "text-green-600"
                      : loan.status === "paid"
                      ? "text-yellow-600"
                      : "text-orange-600"
                  }`}
                >
                  {loan.status}
                </div>
                <div className="text-sm text-gray-500 py-3 overflow-hidden pl-4">
                  {new Date(loan.created_date).toLocaleDateString()}
                </div>
                <div
                  className={`text-sm text-gray-500 py-3 overflow-hidden ${
                    !loan.paid_date ? "pl-3" : ""
                  }`}
                >
                  {loan.paid_date
                    ? new Date(loan.paid_date).toLocaleDateString()
                    : "--/--/--"}
                </div>
                <div
                  className={`text-sm text-gray-500 py-3 overflow-hidden ${
                    loan.confirmed_date ? "pl-5" : "pl-8"
                  }`}
                >
                  {loan.confirmed_date
                    ? new Date(loan.confirmed_date).toLocaleDateString()
                    : "--/--/--"}
                </div>
                <div className="text-sm text-gray-500 py-3 overflow-hidden">
                  {loan.note || "—"}
                </div>
                <div
                  className={`py-3 overflow-hidden ${
                    loan.status === "pending"
                      ? "text-orange-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  ${loan.amount.toFixed(2)}
                </div>
                <div className="py-3 overflow-hidden">
                  {loan.status === "paid" && (
                    <button
                      onClick={async () => {
                        try {
                          await api.confirmLoan(loan.loan_id);
                          fetchLoans();
                        } catch (error) {
                          console.error("Error confirming loan:", error);
                          alert("Failed to confirm loan");
                        }
                      }}
                      className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repayments Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mt-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Repayments</h2>
        {isLoadingRepayments ? (
          <div className="text-center py-8 text-gray-500">
            Loading repayments...
          </div>
        ) : filteredRepayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No repayments found
          </div>
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
                    Repayment Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Confirmed Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Note
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRepayments.map((repayment) => (
                  <tr
                    key={repayment.repayment_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {repayment.tenant?.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {repayment.tenant?.email || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      ${repayment.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(repayment.repayment_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {repayment.confirmed_date
                        ? new Date(
                            repayment.confirmed_date
                          ).toLocaleDateString()
                        : "--/--/--"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {repayment.note || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          repayment.status === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {repayment.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {repayment.status === "pending" && (
                        <button
                          onClick={() =>
                            handleConfirmRepayment(repayment.repayment_id)
                          }
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

  const handleCreateLoan = async () => {
    if (!selectedTenantId || !amount) {
      alert("Please select a tenant and enter an amount.");
      return;
    }

    setIsCreating(true);
    try {
      await api.createLoan({
        tenant_user_id: selectedTenantId,
        amount: parseFloat(amount),
        note,
      });
      onCreateSuccess();
    } catch (error) {
      console.error("Error creating loan:", error);
      alert("Failed to create loan.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Create Loan</h2>
        <div className="mb-4">
          <label
            htmlFor="tenant"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Tenant:
          </label>
          <select
            id="tenant"
            value={selectedTenantId || ""}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Select a tenant</option>
            {groupedTenants.map((tenant) => (
              <option key={tenant.user_id} value={tenant.user_id}>
                {tenant.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label
            htmlFor="amount"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Amount:
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter loan amount"
            min="0"
          />
        </div>
        <div className="mb-6">
          <label
            htmlFor="note"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Note (Optional):
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
            placeholder="Add a note for the loan"
          ></textarea>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateLoan}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            disabled={isCreating || !selectedTenantId || !amount}
          >
            {isCreating ? "Creating..." : "Create Loan"}
          </button>
        </div>
      </div>
    </div>
  );
}
