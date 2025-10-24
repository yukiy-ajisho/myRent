"use client";

import "../globals.css";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Users,
  DollarSign,
  FileText,
  Settings,
  TrendingUp,
} from "lucide-react";
import { PropertyProvider, useProperty } from "@/contexts/PropertyContext";
import { UserProfile } from "@/components/UserProfile";

// ナビゲーション項目
const navigationItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    href: "/owner/dashboard",
  },
  {
    id: "properties",
    label: "Properties",
    icon: Home,
    href: "/owner/properties",
  },
  { id: "tenants", label: "Tenants", icon: Users, href: "/owner/tenants" },
  // {
  //   id: "calculate",
  //   label: "Calculate",
  //   icon: TrendingUp,
  //   href: "/owner/calculate",
  // },
  { id: "history", label: "History", icon: FileText, href: "/owner/history" },
];

// プロパティ選択コンポーネント
function PropertySelector() {
  const { selectedProperty, userProperties, isLoading, setSelectedProperty } =
    useProperty();

  const handlePropertyChange = (propertyId: string) => {
    const property = userProperties.find((p) => p.property_id == propertyId);
    setSelectedProperty(property || null);
  };

  return (
    <div className="mt-4">
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading properties...</div>
      ) : userProperties.length > 0 ? (
        <div className="relative">
          <select
            value={selectedProperty?.property_id || ""}
            onChange={(e) => handlePropertyChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {userProperties.map((property) => (
              <option key={property.property_id} value={property.property_id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No properties found</div>
      )}
    </div>
  );
}

// レイアウトコンテンツコンポーネント
function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 現在のページに応じたタイトルを取得
  const getPageTitle = () => {
    const currentItem = navigationItems.find((item) => item.href === pathname);
    return currentItem ? currentItem.label : "Overview";
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* ナビゲーションバー（左側270px固定、スライドアウト効果） */}
      <div className="w-0 xl:w-[270px] h-screen bg-white shadow-lg flex flex-col border-r border-gray-200 transition-[width,transform] duration-300 ease-in-out transform -translate-x-full xl:translate-x-0 overflow-hidden">
        {/* ロゴ・アプリ名 */}
        <div className="p-6">
          <div className="flex items-center" style={{ gap: "8px" }}>
            <Image
              src="/app_logo.png"
              alt="RentCalc Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <h1 className="text-xl font-bold text-gray-900">RentCalc</h1>
          </div>

          {/* プロパティ選択ドロップダウン - 現在は使用されていないためコメントアウト */}
          {/* 
            PropertySelector は以下の理由でコメントアウト:
            1. 現在のサイドバーメニュー（Dashboard, Properties, Tenants, History）は
               独自のプロパティ選択状態を持っているため不要
            2. 使用されていないページ（Stay Manager, Rent Manager, Division Methods）は
               サイドバーからアクセスできないため影響なし
            3. 各ページで個別にプロパティ選択を実装しているため、
               グローバルなプロパティ選択は冗長
          */}
          {/* <PropertySelector /> */}
        </div>

        {/* ナビゲーション項目 */}
        <nav
          className="flex-1 px-4 pb-4 overflow-hidden"
          style={{ paddingTop: "32px" }}
        >
          <div className="flex flex-col h-full" style={{ gap: "12px" }}>
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`w-full flex items-center space-x-8 px-12 py-8 text-left transition-colors border-0 no-underline ${
                    isActive
                      ? "text-blue-700 font-semibold"
                      : "text-gray-600 hover:text-blue-700"
                  }`}
                  style={{
                    backgroundColor: "white",
                    transition:
                      "background-color 0.2s ease, border-radius 0.2s ease",
                    borderRadius: "8px",
                    color: isActive ? "#1d4ed8" : "#6b7280",
                    padding: "8px 16px",
                    margin: "2px 0",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#dbeafe";
                    e.currentTarget.style.color = "#1d4ed8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.color = isActive
                      ? "#1d4ed8"
                      : "#6b7280";
                  }}
                >
                  <IconComponent
                    className="h-6 w-6 !h-6 !w-6"
                    style={{ height: "24px", width: "24px" }}
                  />
                  <span
                    className="text-lg !text-lg"
                    style={{ fontSize: "18px" }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* コンテンツエリア（右側残り全スペース、スムーズ拡張） */}
      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
        {/* ヘッダー（上部15%） */}
        <header
          className="h-[90px] bg-white shadow-sm border-b border-gray-200 px-8 flex items-center"
          style={{ paddingLeft: "30px" }}
        >
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {getPageTitle()}
            </h1>
          </div>

          {/* ユーザーアバター・名前（右上） */}
          <UserProfile />
        </header>

        {/* メインコンテンツ（下部90%） */}
        <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>
    </div>
  );
}

// メインのレイアウトコンポーネント
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PropertyProvider>
      <LayoutContent>{children}</LayoutContent>
    </PropertyProvider>
  );
}
