"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Home,
  Users,
  DollarSign,
  FileText,
  Settings,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  Eye,
} from "lucide-react";

// ナビゲーション項目
const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "properties", label: "Properties", icon: Home },
  { id: "tenants", label: "Tenants", icon: Users },
  { id: "billing", label: "Billing", icon: DollarSign },
  { id: "ledger", label: "Ledger", icon: FileText },
];

// ページコンテンツ
const pageContents = {
  dashboard: {
    title: "Dashboard",
    content: (
      <div className="p-8 space-y-8">
        {/* ページタイトルとパンくずリスト */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="text-sm text-gray-500">Home / Dashboard</div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Total Visitors
                  </p>
                  <p className="text-2xl font-bold text-gray-900">3.456K</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500 font-medium">
                      0.43%↑
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Eye className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900">$42.2K</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500 font-medium">
                      4.35%↑
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Free Users
                  </p>
                  <p className="text-2xl font-bold text-gray-900">43,543</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500 font-medium">
                      2.59%↑
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Pro Users
                  </p>
                  <p className="text-2xl font-bold text-gray-900">5,334</p>
                  <div className="flex items-center mt-2">
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                    <span className="text-xs text-red-500 font-medium">
                      0.95%↓
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview セクション */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Overview
            </h2>
            <p className="text-gray-600">
              An overview of your organization's activity and performance across
              all your projects.
            </p>
          </div>

          {/* グラフカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    Monthly Recurring Revenue
                  </h3>
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-gray-900 mr-2">
                      $9.1
                    </span>
                    <span className="text-xs text-green-500 font-medium">
                      (+4%)
                    </span>
                  </div>
                </div>
                <div className="h-32 bg-gradient-to-r from-purple-100 to-purple-200 rounded-lg flex items-end justify-center">
                  <div className="text-purple-600 font-semibold">
                    Chart Area
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Revenue</h3>
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-gray-900 mr-2">
                      $32.9
                    </span>
                    <span className="text-xs text-green-500 font-medium">
                      (+4%)
                    </span>
                  </div>
                </div>
                <div className="h-32 bg-gradient-to-r from-purple-100 to-purple-200 rounded-lg flex items-end justify-center">
                  <div className="text-purple-600 font-semibold">
                    Chart Area
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Fees</h3>
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-gray-900 mr-2">
                      $50
                    </span>
                    <span className="text-xs text-green-500 font-medium">
                      (+4%)
                    </span>
                  </div>
                </div>
                <div className="h-32 bg-gradient-to-r from-purple-100 to-purple-200 rounded-lg flex items-end justify-center">
                  <div className="text-purple-600 font-semibold">
                    Chart Area
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    ),
  },
  properties: {
    title: "Properties",
    content: (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Property Management
            </h2>
            <p className="text-gray-600 mt-1">
              Manage your rental properties and their details.
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Properties</CardTitle>
            <CardDescription>Your rental properties overview</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Property management content will go here.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
  tenants: {
    title: "Tenants",
    content: (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Tenant Management
            </h2>
            <p className="text-gray-600 mt-1">
              Manage your tenants and their information.
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </Button>
        </div>
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Your tenants overview</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Tenant management content will go here.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
  billing: {
    title: "Billing",
    content: (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Billing Management
            </h2>
            <p className="text-gray-600 mt-1">
              Manage bills, payments, and financial records.
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Bill
          </Button>
        </div>
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Your billing overview</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Billing management content will go here.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
  ledger: {
    title: "Ledger",
    content: (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Ledger Management
            </h2>
            <p className="text-gray-600 mt-1">
              Track balances and financial transactions.
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            <Eye className="h-4 w-4 mr-2" />
            View Reports
          </Button>
        </div>
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
            <CardDescription>Your financial ledger overview</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Ledger management content will go here.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
};

export default function OwnerDashboard() {
  const [activePage, setActivePage] = useState("dashboard");

  const currentPage = pageContents[activePage as keyof typeof pageContents];

  return (
    <div className="h-screen flex bg-gray-50">
      {/* ナビゲーションバー（左側18%） */}
      <div className="w-[18%] bg-white shadow-lg flex flex-col border-r border-gray-200">
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
        </div>

        {/* ナビゲーション項目 */}
        <nav className="flex-1 px-4 pb-4" style={{ paddingTop: "32px" }}>
          <div className="flex flex-col" style={{ gap: "24px" }}>
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center space-x-8 px-12 py-8 text-left transition-colors border-0 ${
                    activePage === item.id
                      ? "text-blue-700 font-semibold"
                      : "text-gray-600 hover:text-blue-700"
                  }`}
                  style={{
                    backgroundColor: "white",
                    transition:
                      "background-color 0.2s ease, border-radius 0.2s ease",
                    borderRadius: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#dbeafe";
                    e.currentTarget.style.color = "#1d4ed8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.color = "";
                  }}
                >
                  <IconComponent
                    className="h-10 w-10 !h-10 !w-10"
                    style={{ height: "40px", width: "40px" }}
                  />
                  <span
                    className="text-2xl !text-2xl"
                    style={{ fontSize: "24px" }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* コンテンツエリア（右側82%） */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー（上部10%） */}
        <header
          className="h-1/10 bg-white shadow-sm border-b border-gray-200 px-8 flex items-center"
          style={{ paddingLeft: "30px" }}
        >
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {currentPage.title}
            </h1>
          </div>

          {/* ユーザーアバター・名前（右上） */}
          <div className="ml-auto flex items-center">
            <Image
              src="/user_icon.png"
              alt="User Avatar"
              width={40}
              height={40}
              className="w-10 h-10 rounded-full mr-8"
            />
            <p
              className="font-semibold text-gray-900"
              style={{ fontSize: "20px" }}
            >
              John Doe
            </p>
          </div>
        </header>

        {/* メインコンテンツ（下部90%） */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {currentPage.content}
        </main>
      </div>
    </div>
  );
}
