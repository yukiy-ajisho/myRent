"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  previewData: {
    previewData: {
      billLines: unknown[];
      ledgerRecords: unknown[];
    };
    lines_created: number;
    ledger_records_created: number;
    totals: {
      rent: number;
      utilities: number;
      grand_total: number;
    };
    user_days: Record<string, number>;
    headcount: number;
    total_person_days: number;
  } | null;
  property: {
    property_id: string;
    name: string;
  };
  month: string;
}

export default function PreviewModal({
  isOpen,
  onClose,
  onConfirm,
  previewData,
  property,
  month,
}: PreviewModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [isLoadingUserNames, setIsLoadingUserNames] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  // Fetch user names for all unique user IDs
  const fetchUserNames = async (userIds: string[]) => {
    setIsLoadingUserNames(true);
    try {
      const names: Record<string, string> = {};

      // Fetch user names in parallel
      const promises = userIds.map(async (userId) => {
        try {
          console.log(`[DEBUG] Fetching user name for: ${userId}`);
          const response = await api.getUserById(userId);
          console.log(`[DEBUG] User response for ${userId}:`, response);
          names[userId] = response.name || `User ${userId.slice(0, 8)}`;
        } catch (error: any) {
          console.error(`Failed to fetch user ${userId}:`, error);
          console.error(`Error details:`, {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
          });

          // より詳細なフォールバック表示
          if (
            error.message.includes("Tenant not found") ||
            error.message.includes("User not found")
          ) {
            names[userId] = `Unknown User (${userId.slice(0, 8)})`;
          } else {
            names[userId] = `User ${userId.slice(0, 8)}`;
          }
        }
      });

      await Promise.all(promises);
      setUserNames(names);
    } catch (error) {
      console.error("Error fetching user names:", error);
    } finally {
      setIsLoadingUserNames(false);
    }
  };

  // Fetch user names when previewData changes
  useEffect(() => {
    if (previewData?.previewData?.billLines) {
      const userIds = Array.from(
        new Set(
          previewData.previewData.billLines
            .map((line: unknown) => (line as { user_id: string }).user_id)
            .filter(Boolean)
        )
      );

      if (userIds.length > 0) {
        fetchUserNames(userIds);
      }
    }
  }, [previewData]);

  if (!isOpen || !previewData) return null;

  // Group bill lines by user
  const billLinesByUser =
    previewData.previewData?.billLines?.reduce(
      (
        acc: Record<
          string,
          { user_id: string; lines: unknown[]; total: number }
        >,
        line: unknown
      ) => {
        const billLine = line as { user_id: string; amount: number };
        if (!acc[billLine.user_id]) {
          acc[billLine.user_id] = {
            user_id: billLine.user_id,
            lines: [],
            total: 0,
          };
        }
        acc[billLine.user_id].lines.push(line);
        acc[billLine.user_id].total += billLine.amount;
        return acc;
      },
      {}
    ) || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Calculation Preview
            </h2>
            <p className="text-gray-600 mt-1">
              {property?.name} - {formatDate(month + "-01")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(previewData.totals?.rent || 0)}
              </div>
              <div className="text-sm text-gray-600">Total Rent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(previewData.totals?.utilities || 0)}
              </div>
              <div className="text-sm text-gray-600">Total Utilities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(previewData.totals?.grand_total || 0)}
              </div>
              <div className="text-sm text-gray-600">Grand Total</div>
            </div>
          </div>
        </div>

        {/* Bill Lines Details */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Bill Details by Tenant
          </h3>
          <div className="space-y-4">
            {Object.values(billLinesByUser).map(
              (userData: {
                user_id: string;
                lines: unknown[];
                total: number;
              }) => (
                <div
                  key={userData.user_id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900">
                      {isLoadingUserNames ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                          Loading user name...
                        </div>
                      ) : (
                        userNames[userData.user_id] ||
                        `User ${userData.user_id.slice(0, 8)}`
                      )}
                    </h4>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(userData.total)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {userData.lines.map((line: unknown, index: number) => {
                      const billLine = line as {
                        utility: string;
                        amount: number;
                        detail_json?: { method: string };
                      };
                      return (
                        <div
                          key={index}
                          className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {billLine.utility}
                            </span>
                            {billLine.detail_json && (
                              <span className="text-sm text-gray-600">
                                {billLine.detail_json.method}
                              </span>
                            )}
                          </div>
                          <div className="font-medium">
                            {formatCurrency(billLine.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isConfirming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                <span>Confirm Calculation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
