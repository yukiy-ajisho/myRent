"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  owner?: {
    user_id: string;
    name: string;
    email: string;
  };
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
  owner?: {
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
  repayment_date: string;
  note?: string | null;
  status: "pending" | "confirmed";
  confirmed_date?: string | null;
  due_date: string;
  owner?: {
    user_id: string;
    name: string;
    email: string;
  };
  loan: {
    loan_id: string;
    amount: number;
    created_date: string;
    note?: string | null;
  };
}

export default function Loan() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [scheduledRepayments, setScheduledRepayments] = useState<
    ScheduledRepayment[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRepayments, setIsLoadingRepayments] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);

  const fetchLoans = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getTenantLoans();
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
      const data = await api.getTenantRepayments();
      setRepayments(data.repayments);
    } catch (error) {
      console.error("Error loading repayments:", error);
    } finally {
      setIsLoadingRepayments(false);
    }
  }, []);

  const fetchScheduledRepayments = useCallback(async () => {
    try {
      const data = await api.getTenantScheduledRepayments();
      setScheduledRepayments(data.repayments || []);
    } catch (error) {
      console.error("Error loading scheduled repayments:", error);
    }
  }, []);

  // Get unique owners from loans (for repayment modal dropdown)
  const uniqueOwners = useMemo(() => {
    const ownersMap = new Map();
    loans.forEach((loan) => {
      if (loan.owner && !ownersMap.has(loan.owner.user_id)) {
        ownersMap.set(loan.owner.user_id, loan.owner);
      }
    });
    return Array.from(ownersMap.values());
  }, [loans]);

  // 初期データ読み込み
  useEffect(() => {
    fetchLoans();
    fetchRepayments();
    fetchScheduledRepayments();
  }, [fetchLoans, fetchRepayments, fetchScheduledRepayments]);

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header with Repayment Button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Loans</h1>
        <button
          onClick={() => setShowRepaymentModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Repayment
        </button>
      </div>

      {/* Loans Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Loans</h2>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading loans...</div>
        ) : loans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No loans found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Owner
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
                {loans.map((loan) => (
                  <tr
                    key={loan.loan_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {loan.owner?.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {loan.owner?.email || "N/A"}
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
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Scheduled Repayments
        </h2>
        {scheduledRepayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No scheduled repayments found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Owner
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Loan Created
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Due Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {scheduledRepayments.map((repayment) => (
                  <tr
                    key={repayment.repayment_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {repayment.owner?.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {repayment.owner?.email || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {repayment.loan?.created_date
                        ? new Date(
                            repayment.loan.created_date
                          ).toLocaleDateString()
                        : "N/A"}
                      {repayment.loan?.note && (
                        <div className="text-xs text-gray-500 mt-1">
                          {repayment.loan.note}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(repayment.due_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-semibold">
                      ${repayment.amount.toFixed(2)}
                      {repayment.loan && (
                        <div className="text-xs text-gray-500">
                          Loan: ${repayment.loan.amount.toFixed(2)}
                        </div>
                      )}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Free Repayments Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Free Repayments
        </h2>
        {isLoadingRepayments ? (
          <div className="text-center py-8 text-gray-500">
            Loading repayments...
          </div>
        ) : repayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No repayments found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Owner
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
                </tr>
              </thead>
              <tbody>
                {repayments.map((repayment) => (
                  <tr
                    key={repayment.repayment_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {repayment.owner?.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {repayment.owner?.email || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-semibold">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Repayment Modal */}
      {showRepaymentModal && (
        <RepaymentModal
          owners={uniqueOwners}
          onClose={() => setShowRepaymentModal(false)}
          onSuccess={() => {
            setShowRepaymentModal(false);
            fetchRepayments();
            fetchScheduledRepayments();
          }}
        />
      )}
    </div>
  );
}

interface RepaymentModalProps {
  owners: Array<{
    user_id: string;
    name: string;
    email: string;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

function RepaymentModal({ owners, onClose, onSuccess }: RepaymentModalProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOwnerId || !amount) {
      alert("Please select an owner and enter an amount.");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createRepayment({
        owner_user_id: selectedOwnerId,
        amount: amountNum,
        note: note || null,
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating repayment:", error);
      alert("Failed to submit repayment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Make Repayment</h2>

        <div className="mb-4">
          <label
            htmlFor="owner"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Owner:
          </label>
          <select
            id="owner"
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Select an owner</option>
            {owners.map((owner) => (
              <option key={owner.user_id} value={owner.user_id}>
                {owner.name}
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
            placeholder="Enter payment amount"
            min="0"
            step="0.01"
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
            placeholder="Add a note for the payment"
          ></textarea>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            disabled={isSubmitting || !selectedOwnerId || !amount}
          >
            {isSubmitting ? "Submitting..." : "Submit Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
