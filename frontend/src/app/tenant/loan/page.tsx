"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function Loan() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // 初期データ読み込み
  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Loans</h1>
      </div>

      {/* Loan Records Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading loans...</div>
        ) : loans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No loans found</div>
        ) : (
          <div className="grid grid-cols-8 gap-0">
            {/* Header row */}
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Owner
            </div>
            <div className="font-semibold text-gray-700 pb-2 border-b border-gray-200 overflow-hidden">
              Amount
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
              Action
            </div>

            {/* Data rows */}
            {loans.map((loan) => (
              <div key={loan.loan_id} className="contents">
                <div className="text-gray-900 py-3 overflow-hidden">
                  {loan.owner?.name || "Unknown"}
                </div>
                <div className="text-gray-600 py-3 overflow-hidden">
                  ${loan.amount.toFixed(2)}
                </div>
                <div
                  className={`py-3 overflow-hidden ${
                    loan.status === "confirmed"
                      ? "text-green-600"
                      : loan.status === "paid"
                      ? "text-yellow-600"
                      : "text-gray-600"
                  }`}
                >
                  {loan.status}
                </div>
                <div className="text-sm text-gray-500 py-3 overflow-hidden">
                  {new Date(loan.created_date).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-500 py-3 overflow-hidden">
                  {loan.paid_date
                    ? new Date(loan.paid_date).toLocaleDateString()
                    : "—"}
                </div>
                <div className="text-sm text-gray-500 py-3 overflow-hidden">
                  {loan.confirmed_date
                    ? new Date(loan.confirmed_date).toLocaleDateString()
                    : "—"}
                </div>
                <div className="text-sm text-gray-500 py-3 overflow-hidden">
                  {loan.note || "—"}
                </div>
                <div className="py-3 overflow-hidden">
                  {loan.status === "pending" && (
                    <button
                      onClick={async () => {
                        try {
                          await api.markLoanAsPaid(loan.loan_id);
                          fetchLoans();
                        } catch (error) {
                          console.error("Error marking loan as paid:", error);
                          alert("Failed to mark loan as paid");
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
