"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { api } from "@/lib/api";

interface DivisionRule {
  rule_id: string;
  property_id: string;
  utility: string;
  method: string;
}

const UTILITIES = ["electricity", "gas", "water", "internet", "garbage"];
const DIVISION_METHODS = [
  { value: "", label: "Select Method" },
  { value: "fixed", label: "Fixed" },
  { value: "equalshare", label: "Equal Share" },
  { value: "bydays", label: "By Days" },
];

export default function DivisionMethods() {
  const { selectedProperty } = useProperty();
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
    if (selectedProperty) {
      loadDivisionRules(selectedProperty.property_id);
    }
  }, [selectedProperty]);

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
      setMessage("Error loading division rules");
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
    if (!hasChanges || !selectedProperty) return;

    try {
      setIsSaving(true);
      setMessage("");

      // 変更されたルールのみを抽出
      const changedRules = Object.entries(currentRules)
        .filter(([utility, method]) => method !== originalRules[utility])
        .map(([utility, method]) => ({ utility, method }));

      if (changedRules.length > 0) {
        await api.saveDivisionRules({
          property_id: selectedProperty.property_id,
          items: changedRules,
        });
      }

      setOriginalRules({ ...currentRules });
      setHasChanges(false);
      setMessage("Division methods saved successfully!");
    } catch (error) {
      console.error("Error saving division rules:", error);
      setMessage("Error saving division rules");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrentRules({ ...originalRules });
    setHasChanges(false);
    setMessage("");
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading division methods...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Division Methods
        </h1>

        {/* 分割方法設定 */}
        {selectedProperty && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-6">
              Division Methods for {selectedProperty.name}
            </h2>

            <div className="space-y-4">
              {UTILITIES.map((utility) => (
                <div
                  key={utility}
                  className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
                >
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 capitalize">
                      {utility}
                    </label>
                  </div>
                  <div className="flex-1 max-w-xs">
                    <select
                      value={currentRules[utility] || ""}
                      onChange={(e) =>
                        handleMethodChange(utility, e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DIVISION_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
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
                {isSaving ? "Saving..." : "Save Changes"}
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
        )}

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

        {/* プロパティが選択されていない場合 */}
        {!selectedProperty && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center text-gray-500">
              Please select a property to configure division methods.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
