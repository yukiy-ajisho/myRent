"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

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

const UTILITIES = ["electricity", "gas", "water", "internet", "garbage"];
const DIVISION_METHODS = [
  { value: "", label: "Select Method", description: "" },
  { value: "fixed", label: "Fixed", description: "Split by fixed amount" },
  {
    value: "equalshare",
    label: "Headcounts",
    description: "Split equally by number of people",
  },
  {
    value: "bydays",
    label: "Days Present",
    description: "Split by percentage of days stayed",
  },
];

interface DivisionMethodsModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
}

export default function DivisionMethodsModal({
  property,
  isOpen,
  onClose,
}: DivisionMethodsModalProps) {
  const [originalRules, setOriginalRules] = useState<Record<string, string>>(
    {}
  );
  const [currentRules, setCurrentRules] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 変更検知
  useEffect(() => {
    const changed = Object.keys(currentRules).some(
      (utility) => currentRules[utility] !== originalRules[utility]
    );
    setHasChanges(changed);
  }, [currentRules, originalRules]);

  // プロパティが変更された時の処理
  useEffect(() => {
    if (property && isOpen) {
      loadDivisionRules(property.property_id);
    }
  }, [property, isOpen]);

  const loadDivisionRules = async (propertyId: string) => {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await api.getBootstrap(propertyId);

      // 既存設定を抽出
      const rules: Record<string, string> = {};
      data.divisionRules.forEach((rule: DivisionRule) => {
        if (String(rule.property_id) === String(propertyId)) {
          rules[rule.utility] = rule.method;
        }
      });

      // 未設定は空文字（Select Method表示）
      UTILITIES.forEach((utility) => {
        if (!rules[utility]) {
          rules[utility] = "";
        }
      });

      setOriginalRules({ ...rules });
      setCurrentRules({ ...rules });
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading division rules:", error);
      setMessage("Error loading split preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMethodChange = (utility: string, method: string) => {
    setCurrentRules((prev) => ({
      ...prev,
      [utility]: method,
    }));
  };

  const handleSave = async () => {
    if (!hasChanges || !property) return;

    try {
      setIsSaving(true);
      setMessage("");

      // 変更されたルールのみを抽出
      const changedRules = Object.entries(currentRules)
        .filter(([utility, method]) => method !== originalRules[utility])
        .map(([utility, method]) => ({ utility, method }));

      if (changedRules.length > 0) {
        await api.saveDivisionRules({
          property_id: property.property_id,
          items: changedRules,
        });
      }

      setOriginalRules({ ...currentRules });
      setHasChanges(false);
      setMessage("Split preferences saved successfully!");
    } catch (error) {
      console.error("Error saving division rules:", error);
      setMessage("Error saving split preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrentRules({ ...originalRules });
    setHasChanges(false);
    setMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Split Preference for {property.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading split preferences...</div>
            </div>
          ) : (
            <>
              {/* 分割方法設定 */}
              <div className="bg-white shadow rounded-lg p-6 mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Utility
                        </th>
                        {DIVISION_METHODS.filter(
                          (method) => method.value !== ""
                        ).map((method) => (
                          <th
                            key={method.value}
                            className="text-center py-3 px-4 font-medium text-gray-700 relative"
                          >
                            <span>{method.label}</span>
                            {method.description && (
                              <div className="absolute top-1 right-1">
                                <div className="relative group">
                                  <span className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600 hover:bg-gray-400 hover:text-gray-700 cursor-help">
                                    ?
                                  </span>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                    {method.description}
                                  </div>
                                </div>
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {UTILITIES.map((utility) => (
                        <tr
                          key={utility}
                          className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                        >
                          <td className="py-4 px-4 font-medium text-gray-700 capitalize">
                            {utility}
                          </td>
                          {DIVISION_METHODS.filter(
                            (method) => method.value !== ""
                          ).map((method) => (
                            <td
                              key={method.value}
                              className="py-4 px-4 text-center"
                            >
                              <label className="flex items-center justify-center">
                                <input
                                  type="radio"
                                  name={utility}
                                  value={method.value}
                                  checked={
                                    currentRules[utility] === method.value
                                  }
                                  onChange={(e) =>
                                    handleMethodChange(utility, e.target.value)
                                  }
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                />
                              </label>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ボタン */}
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={`px-6 py-2 rounded-md font-medium ${
                      hasChanges && !isSaving
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {isSaving ? "Saving..." : "Save Split Preferences"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={!hasChanges}
                    className={`px-6 py-2 rounded-md font-medium ${
                      hasChanges
                        ? "bg-gray-600 text-white hover:bg-gray-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* メッセージ */}
              {message && (
                <div
                  className={`p-4 rounded-md ${
                    message.includes("Error")
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-green-50 border border-green-200 text-green-800"
                  }`}
                >
                  {message}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
