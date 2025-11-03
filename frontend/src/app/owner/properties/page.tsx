"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import DivisionMethodsModal from "@/components/DivisionMethodsModal";
import CalculateModal from "@/components/CalculateModal";
import CalculationSuccessModal from "@/components/CalculationSuccessModal";
import StayPeriodsModal from "@/components/StayPeriodsModal";
import BreakModal from "@/components/BreakModal";

interface Property {
  property_id: string;
  name: string;
  active: boolean;
  address: string;
  tenants: string[];
}

interface TenantRent {
  user_id: string;
  property_id: string;
  monthly_rent: number;
}

interface Tenant {
  user_id: string;
  name: string;
  email: string;
  user_type: string;
  nick_name?: string | null;
}

interface RentData {
  tenants: Tenant[];
  tenantRents: TenantRent[];
}

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 家賃データ管理
  const [rentData, setRentData] = useState<Record<string, RentData>>({});
  const [currentRents, setCurrentRents] = useState<
    Record<string, Record<string, number>>
  >({});
  const [saveStatus, setSaveStatus] = useState<
    Record<string, "saving" | "saved" | "error">
  >({});

  // Split Preference管理モーダル関連
  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );

  // Calculate管理モーダル関連
  const [calculateModalOpen, setCalculateModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // Bill runs管理
  const [billRuns, setBillRuns] = useState<
    Record<
      string,
      { month_start: string; bill_run_id: number; status: string }[]
    >
  >({});

  // Stay periods管理
  const [stayPeriods, setStayPeriods] = useState<
    Record<
      string,
      { user_id: string; start_date: string | null; end_date: string | null }[]
    >
  >({});

  // Stay Periods Modal管理
  const [stayPeriodsModalOpen, setStayPeriodsModalOpen] = useState(false);
  const [selectedTenantForStay, setSelectedTenantForStay] =
    useState<Tenant | null>(null);

  // Break Modal管理
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [selectedTenantForBreak, setSelectedTenantForBreak] =
    useState<Tenant | null>(null);

  // インライン編集管理
  const [editingTenant, setEditingTenant] = useState<{
    tenantId: string;
    propertyId: string;
  } | null>(null);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");

  // プロパティ作成フォーム関連の状態
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 日付フォーマット用のヘルパー関数（日付型input用）
  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return "";
    // YYYY-MM-DD形式をそのまま返す（日付型inputはこの形式を期待）
    return dateString;
  };

  const parseDateFromInput = (dateValue: string) => {
    if (!dateValue) return "";
    // 日付型inputから取得した値は既にYYYY-MM-DD形式
    return dateValue;
  };

  // CalculateModalと同じgetNextMonth関数
  const getNextMonth = useCallback((monthString: string) => {
    // monthString is already in YYYY-MM-DD format, so we can use it directly
    console.log("getNextMonth input:", monthString);

    // Parse the date string to avoid timezone issues
    const [year, month] = monthString.split("-").map(Number);
    console.log("getNextMonth parsed year:", year, "month:", month);

    // Create date object using local timezone
    const date = new Date(year, month - 1, 1); // month is 0-indexed
    console.log("getNextMonth parsed date:", date);

    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    console.log("getNextMonth next month:", nextMonth);
    const result = nextMonth.toISOString().slice(0, 7); // YYYY-MM format
    console.log("getNextMonth result:", result);
    return result;
  }, []);

  const loadBillRuns = useCallback(async (propertyId: string) => {
    try {
      const data = await api.getBillRuns(propertyId);
      // CalculateModalと同じように降順でソート
      const sortedBillRuns = (data.billRuns || []).sort(
        (a: { month_start: string }, b: { month_start: string }) =>
          new Date(b.month_start).getTime() - new Date(a.month_start).getTime()
      );
      setBillRuns((prev) => ({
        ...prev,
        [propertyId]: sortedBillRuns,
      }));
    } catch (error) {
      console.error(
        `Error loading bill runs for property ${propertyId}:`,
        error
      );
    }
  }, []);

  // 次の月を計算する関数（CalculateModalと同じロジック）
  const getNextMonthForProperty = useCallback(
    (propertyId: string) => {
      const propertyBillRuns = billRuns[propertyId] || [];

      if (propertyBillRuns.length > 0) {
        // 最新のbill_runの月を取得（既に降順でソート済みと仮定）
        const latestMonth = propertyBillRuns[0].month_start;
        if (latestMonth) {
          return getNextMonth(latestMonth);
        }
      }

      // bill_runレコードが存在しない場合、現在の月を返す
      const now = new Date();
      return now.toISOString().slice(0, 7); // YYYY-MM format
    },
    [billRuns, getNextMonth]
  );

  // 月を表示用にフォーマットする関数
  const formatMonthDisplay = useCallback((monthString: string) => {
    const [year, month] = monthString.split("-");
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  }, []);

  const loadRentData = useCallback(async (propertyId: string) => {
    try {
      const data = await api.getRentData(propertyId);

      setRentData((prev) => ({
        ...prev,
        [propertyId]: data,
      }));

      // 家賃情報を設定
      const rents: Record<string, number> = {};
      data.tenantRents.forEach((rent: TenantRent) => {
        rents[rent.user_id] = rent.monthly_rent;
      });

      // テナントがいるが家賃設定がない場合は0で初期化
      data.tenants.forEach((tenant: Tenant) => {
        if (!(tenant.user_id in rents)) {
          rents[tenant.user_id] = 0;
        }
      });

      setCurrentRents((prev) => ({
        ...prev,
        [propertyId]: rents,
      }));
    } catch (error) {
      console.error(
        `Error loading rent data for property ${propertyId}:`,
        error
      );
    }
  }, []);

  const loadStayData = useCallback(async (propertyId: string) => {
    try {
      const data = await api.getStayData(propertyId);

      setStayPeriods((prev) => ({
        ...prev,
        [propertyId]: data.stayRecords || [],
      }));
    } catch (error) {
      console.error(
        `Error loading stay data for property ${propertyId}:`,
        error
      );
    }
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      setIsLoading(true);
      setMessage("");

      console.log("=== PROPERTIES DEBUG ===");
      console.log("Loading properties...");

      const data = await api.getProperties();
      console.log("API Response received:", data);

      // データの検証
      if (!data.properties || !Array.isArray(data.properties)) {
        throw new Error("Invalid data format");
      }

      setProperties(data.properties);
      console.log("Properties loaded:", data.properties.length);

      // 各プロパティの家賃データ、bill runs、stay periodsを取得
      for (const property of data.properties) {
        await loadRentData(property.property_id);
        await loadBillRuns(property.property_id);
        await loadStayData(property.property_id);
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      setMessage("Error loading properties");
    } finally {
      setIsLoading(false);
    }
  }, [loadRentData, loadBillRuns, loadStayData]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // デバウンス付きの保存関数
  const debouncedSave = useCallback(
    (propertyId: string, userId: string, rent: number) => {
      const timeouts: Record<string, NodeJS.Timeout> = {};

      // 既存のタイムアウトをクリア
      if (timeouts[`${propertyId}-${userId}`]) {
        clearTimeout(timeouts[`${propertyId}-${userId}`]);
      }

      // 保存ステータスを設定
      setSaveStatus((prev) => ({
        ...prev,
        [`${propertyId}-${userId}`]: "saving",
      }));

      // 500ms後に保存実行
      timeouts[`${propertyId}-${userId}`] = setTimeout(async () => {
        try {
          await api.saveRent({
            property_id: propertyId,
            rent_amounts: { [userId]: rent },
          });

          setSaveStatus((prev) => ({
            ...prev,
            [`${propertyId}-${userId}`]: "saved",
          }));

          // 2秒後にステータスをクリア
          setTimeout(() => {
            setSaveStatus((prev) => {
              const newStatus = { ...prev };
              delete newStatus[`${propertyId}-${userId}`];
              return newStatus;
            });
          }, 2000);
        } catch (error) {
          console.error("Error saving rent:", error);
          setSaveStatus((prev) => ({
            ...prev,
            [`${propertyId}-${userId}`]: "error",
          }));
        }
      }, 500);
    },
    []
  );

  const handleRentChange = (
    propertyId: string,
    userId: string,
    value: string
  ) => {
    // 数値以外の文字を削除（小数点と数字のみ許可）
    const numericValue = value.replace(/[^0-9.]/g, "");

    // 複数の小数点を防ぐ
    const parts = numericValue.split(".");
    const cleanValue =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : numericValue;

    // 空文字列の場合は0に設定
    const finalValue = cleanValue === "" ? "0" : cleanValue;

    const rent = parseFloat(finalValue) || 0;

    // 現在の家賃を更新
    setCurrentRents((prev) => ({
      ...prev,
      [propertyId]: {
        ...prev[propertyId],
        [userId]: rent,
      },
    }));

    // デバウンス付きで保存
    debouncedSave(propertyId, userId, rent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.address.trim()) {
      setMessage("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      await api.createPropertyForOwner({
        name: formData.name.trim(),
        address: formData.address.trim(),
      });

      setMessage("Property created successfully!");
      setFormData({ name: "", address: "" });
      setShowForm(false);

      // プロパティ一覧を再読み込み
      loadProperties();
    } catch (error) {
      console.error("Error creating property:", error);
      setMessage("Error creating property");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSaveStatusIcon = (propertyId: string, userId: string) => {
    const status = saveStatus[`${propertyId}-${userId}`];
    switch (status) {
      case "saving":
        return <span className="text-blue-500 text-xs">Saving...</span>;
      case "saved":
        return <span className="text-green-500 text-xs">✓ Saved</span>;
      case "error":
        return <span className="text-red-500 text-xs">✗ Error</span>;
      default:
        return null;
    }
  };

  const handleDivisionClick = (property: Property) => {
    setSelectedProperty(property);
    setDivisionModalOpen(true);
  };

  const handleDivisionModalClose = () => {
    setDivisionModalOpen(false);
    setSelectedProperty(null);
  };

  const handleCalculateClick = (property: Property) => {
    setSelectedProperty(property);
    setCalculateModalOpen(true);
  };

  const handleCalculateModalClose = () => {
    setCalculateModalOpen(false);
    setSelectedProperty(null);
  };

  // Stay Periods Modal handlers
  const handleStayPeriodsClick = (tenant: Tenant, property: Property) => {
    console.log("=== handleStayPeriodsClick DEBUG ===");
    console.log("tenant:", tenant);
    console.log("property:", property);
    console.log("property.property_id:", property.property_id);

    setSelectedProperty(property);
    setSelectedTenantForStay(tenant);
    setStayPeriodsModalOpen(true);
  };

  const handleStayPeriodsModalClose = () => {
    setStayPeriodsModalOpen(false);
    setSelectedTenantForStay(null);
    setSelectedProperty(null);
  };

  // Break Modal handlers
  const handleBreakClick = (tenant: Tenant, property: Property) => {
    setSelectedProperty(property);
    setSelectedTenantForBreak(tenant);
    setBreakModalOpen(true);
  };

  const handleBreakModalClose = () => {
    setBreakModalOpen(false);
    setSelectedTenantForBreak(null);
    setSelectedProperty(null);
  };

  // インライン編集ハンドラー
  const handleInlineEditClick = (tenant: Tenant, property: Property) => {
    const stayPeriod = getStayPeriodForTenant(
      property.property_id,
      tenant.user_id
    );
    setEditingTenant({
      tenantId: tenant.user_id,
      propertyId: property.property_id,
    });
    setTempStartDate(formatDateForInput(stayPeriod?.start_date || null));
    setTempEndDate(formatDateForInput(stayPeriod?.end_date || null));
  };

  // グローバルクリックハンドラー（入力ボックスとSaveボタン以外でキャンセル）
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (editingTenant) {
        const target = event.target as HTMLElement;
        // 入力ボックスとSaveボタン以外をクリックした場合
        if (
          !target.closest('input[type="date"]') &&
          !target.closest('button[class*="bg-green"]')
        ) {
          handleInlineCancel();
        }
      }
    };

    if (editingTenant) {
      document.addEventListener("click", handleGlobalClick);
    }

    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [editingTenant]);

  const handleInlineSave = async () => {
    if (!editingTenant) return;

    try {
      const stayPeriods = [
        {
          user_id: editingTenant.tenantId,
          start_date: tempStartDate ? parseDateFromInput(tempStartDate) : null,
          end_date: tempEndDate ? parseDateFromInput(tempEndDate) : null,
        },
      ];

      await api.saveStayPeriods({
        propertyId: editingTenant.propertyId,
        stayPeriods: stayPeriods.reduce((acc, period) => {
          acc[period.user_id] = {
            startDate: period.start_date || "",
            endDate: period.end_date,
          };
          return acc;
        }, {} as Record<string, { startDate: string; endDate: string | null }>),
        breakPeriods: {},
      });

      // 編集モードを終了
      setEditingTenant(null);
      setTempStartDate("");
      setTempEndDate("");

      // データを再読み込み
      loadProperties();
    } catch (error) {
      console.error("Error saving stay periods:", error);
    }
  };

  const handleInlineCancel = () => {
    setEditingTenant(null);
    setTempStartDate("");
    setTempEndDate("");
  };

  // Stay periods data helper
  const getStayPeriodForTenant = (propertyId: string, userId: string) => {
    const propertyStayPeriods = stayPeriods[propertyId] || [];
    return propertyStayPeriods.find((period) => period.user_id === userId);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-----";
    return dateString;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Property
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading properties...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600 text-lg">
                No properties found. Create your first property below.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {properties.map((property) => (
                <div
                  key={property.property_id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {property.name}
                          </h3>
                          <p className="text-gray-600 mt-1">
                            {property.address}
                          </p>
                          <div className="mt-2">
                            <button
                              onClick={() => handleDivisionClick(property)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Split Preference
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {formatMonthDisplay(
                              getNextMonthForProperty(property.property_id)
                            )}
                          </span>
                          <button
                            onClick={() => handleCalculateClick(property)}
                            className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                          >
                            Calculate
                          </button>
                        </div>
                      </div>
                      <div className="mt-3">
                        {/* Table for tenants */}
                        <table
                          className="w-full border-separate"
                          style={{ borderSpacing: "0 0.5rem" }}
                        >
                          <colgroup>
                            <col style={{ width: "22%" }} />
                            <col style={{ width: "40.23%" }} />
                            <col style={{ width: "22.22%" }} />
                            <col style={{ width: "15.56%" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="text-left bg-white px-3 py-2 rounded-tl rounded-bl">
                                <span className="text-sm text-gray-500">
                                  Tenants (
                                  {rentData[property.property_id]?.tenants
                                    ?.length || 0}
                                  ):
                                </span>
                              </th>
                              <th className="text-left bg-white px-3 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="w-32 text-[5px] sm:text-[6px] md:text-sm lg:text-sm text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    Commencement
                                  </span>
                                  <span className="w-32 text-[5px] sm:text-[6px] md:text-sm lg:text-sm text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    Expiration
                                  </span>
                                </div>
                              </th>
                              <th className="text-left bg-white px-3 py-2">
                                <span className="text-sm text-gray-500 pl-2">
                                  Pause Utility
                                </span>
                              </th>
                              <th className="text-left bg-white px-3 py-2 rounded-tr rounded-br">
                                <span className="text-sm text-gray-500 pl-10">
                                  Rent
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rentData[property.property_id]?.tenants?.length >
                            0 ? (
                              rentData[property.property_id].tenants.map(
                                (tenant, index) => {
                                  const stayPeriod = getStayPeriodForTenant(
                                    property.property_id,
                                    tenant.user_id
                                  );
                                  const isFirstRow = index === 0;
                                  const isLastRow =
                                    index ===
                                    rentData[property.property_id].tenants
                                      .length -
                                      1;
                                  return (
                                    <tr key={tenant.user_id}>
                                      {/* 1. Name + Email */}
                                      <td
                                        className={`text-left bg-gray-50 px-3 py-2 ${
                                          isFirstRow ? "rounded-tl" : ""
                                        } ${isLastRow ? "rounded-bl" : ""}`}
                                      >
                                        <div className="text-sm font-medium text-gray-900">
                                          {tenant.nick_name || tenant.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {tenant.email}
                                        </div>
                                      </td>

                                      {/* 2. Start Date + End Date + Edit */}
                                      <td className="text-left bg-gray-50 px-3 py-2">
                                        <div className="flex items-center gap-3">
                                          {editingTenant?.tenantId ===
                                            tenant.user_id &&
                                          editingTenant?.propertyId ===
                                            property.property_id ? (
                                            <>
                                              <input
                                                type="date"
                                                value={tempStartDate}
                                                onChange={(e) =>
                                                  setTempStartDate(
                                                    e.target.value
                                                  )
                                                }
                                                className="w-32 pl-1 pr-1 text-[5px] sm:text-[6px] md:text-[7px] lg:text-sm text-gray-600 border border-gray-300 rounded py-0.5 flex-shrink-0 -ml-px"
                                              />
                                              <input
                                                type="date"
                                                value={tempEndDate}
                                                onChange={(e) =>
                                                  setTempEndDate(e.target.value)
                                                }
                                                className="w-32 text-[5px] sm:text-[6px] md:text-[7px] lg:text-sm text-gray-600 border border-gray-300 rounded px-1 py-0.5 flex-shrink-0"
                                              />
                                              <button
                                                onClick={handleInlineSave}
                                                className="px-2 py-1 bg-green-500 text-white text-xs rounded-full hover:bg-green-600 flex-shrink-0"
                                              >
                                                Save
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <span
                                                className={`w-32 ${
                                                  stayPeriod?.start_date
                                                    ? "pl-3"
                                                    : "pl-8"
                                                } text-[5px] sm:text-[6px] md:text-sm lg:text-sm text-gray-600 flex-shrink-0 whitespace-nowrap`}
                                              >
                                                {stayPeriod?.start_date
                                                  ? stayPeriod.start_date
                                                  : "-----"}
                                              </span>
                                              <span
                                                className={`w-32 ${
                                                  stayPeriod?.end_date
                                                    ? "pl-0"
                                                    : "pl-5"
                                                } text-[5px] sm:text-[6px] md:text-sm lg:text-sm text-gray-600 flex-shrink-0 whitespace-nowrap`}
                                              >
                                                {stayPeriod?.end_date
                                                  ? stayPeriod.end_date
                                                  : "-----"}
                                              </span>
                                              <button
                                                onClick={() =>
                                                  handleInlineEditClick(
                                                    tenant,
                                                    property
                                                  )
                                                }
                                                className="px-2 py-1 bg-gray-500 text-white text-xs rounded-full hover:bg-gray-600 flex-shrink-0"
                                              >
                                                Edit
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>

                                      {/* 3. Edit Button */}
                                      <td className="text-left bg-gray-50 px-3 py-2">
                                        <div className="pl-6">
                                          <button
                                            onClick={() =>
                                              handleBreakClick(tenant, property)
                                            }
                                            className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                                          >
                                            Edit
                                          </button>
                                        </div>
                                      </td>

                                      {/* 4. Rent Input */}
                                      <td
                                        className={`text-left bg-gray-50 px-3 py-2 ${
                                          isFirstRow ? "rounded-tr" : ""
                                        } ${isLastRow ? "rounded-br" : ""}`}
                                      >
                                        <div className="flex items-center">
                                          <span className="text-sm text-gray-700 mr-2">
                                            $
                                          </span>
                                          <input
                                            type="text"
                                            value={
                                              currentRents[
                                                property.property_id
                                              ]?.[tenant.user_id] || 0
                                            }
                                            onChange={(e) =>
                                              handleRentChange(
                                                property.property_id,
                                                tenant.user_id,
                                                e.target.value
                                              )
                                            }
                                            onInput={(e) => {
                                              const target =
                                                e.target as HTMLInputElement;
                                              const value = target.value;
                                              // 先頭の0を削除（例: "0200" → "200"）
                                              const cleanValue =
                                                value.replace(/^0+/, "") || "0";
                                              if (value !== cleanValue) {
                                                target.value = cleanValue;
                                                handleRentChange(
                                                  property.property_id,
                                                  tenant.user_id,
                                                  cleanValue
                                                );
                                              }
                                            }}
                                            className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          />
                                        </div>
                                        <div className="mt-1">
                                          {getSaveStatusIcon(
                                            property.property_id,
                                            tenant.user_id
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }
                              )
                            ) : (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="text-sm text-gray-500 bg-gray-50 px-3 py-2"
                                >
                                  No tenants
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mt-4 p-4 rounded-md ${
            message.includes("Error")
              ? "bg-red-50 border border-red-200"
              : "bg-green-50 border border-green-200"
          }`}
        >
          <p
            className={
              message.includes("Error") ? "text-red-800" : "text-green-800"
            }
          >
            {message}
          </p>
        </div>
      )}

      {/* プロパティ作成フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create New Property</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Property Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter property name"
                  className="w-full p-2 border rounded"
                  required
                  maxLength={100}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Enter property address"
                  className="w-full p-2 border rounded h-20 resize-none"
                  required
                  maxLength={200}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Property"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Preference管理モーダル */}
      {divisionModalOpen && selectedProperty && (
        <DivisionMethodsModal
          property={{
            property_id: selectedProperty.property_id,
            name: selectedProperty.name,
            timezone: "UTC",
            active: selectedProperty.active,
          }}
          isOpen={divisionModalOpen}
          onClose={handleDivisionModalClose}
        />
      )}

      {/* Calculate管理モーダル */}
      {calculateModalOpen && selectedProperty && (
        <CalculateModal
          property={{
            property_id: selectedProperty.property_id,
            name: selectedProperty.name,
            timezone: "UTC",
            active: selectedProperty.active,
          }}
          isOpen={calculateModalOpen}
          onClose={handleCalculateModalClose}
          onCalculationComplete={() => {
            setSuccessModalOpen(true);
          }}
        />
      )}

      {/* 成功モーダル */}
      <CalculationSuccessModal
        isOpen={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
          // データを再読み込みして再レンダリング
          loadProperties();
        }}
      />

      {/* Stay Periods Modal */}
      {stayPeriodsModalOpen && selectedTenantForStay && (
        <StayPeriodsModal
          property={{
            property_id: String(selectedProperty?.property_id || ""),
            name: selectedProperty?.name || "",
            timezone: "UTC",
            active: true,
          }}
          tenant={selectedTenantForStay}
          isOpen={stayPeriodsModalOpen}
          onClose={handleStayPeriodsModalClose}
          onSave={() => {
            // Stay periods保存後にデータを再読み込み
            loadProperties();
          }}
        />
      )}

      {/* Break Modal */}
      {breakModalOpen && selectedTenantForBreak && (
        <BreakModal
          property={{
            property_id: String(selectedProperty?.property_id || ""),
            name: selectedProperty?.name || "",
            timezone: "UTC",
            active: true,
          }}
          tenant={selectedTenantForBreak}
          isOpen={breakModalOpen}
          onClose={handleBreakModalClose}
          onSave={() => {
            // Break periods保存後にデータを再読み込み
            loadProperties();
          }}
        />
      )}
    </div>
  );
}
