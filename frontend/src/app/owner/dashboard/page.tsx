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
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  Eye,
  DollarSign,
  Users,
} from "lucide-react";

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
  return pageContents.dashboard.content;
}
