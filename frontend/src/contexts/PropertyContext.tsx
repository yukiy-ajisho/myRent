"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api } from "@/lib/api";

// プロパティの型定義
export interface Property {
  property_id: string;
  name: string;
  timezone: string;
  active: boolean;
}

// Contextの型定義
interface PropertyContextType {
  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;
  userProperties: Property[];
  isLoading: boolean;
  refreshProperties: () => Promise<void>;
}

// Contextの作成
const PropertyContext = createContext<PropertyContextType | undefined>(
  undefined
);

// Providerコンポーネント
export function PropertyProvider({ children }: { children: ReactNode }) {
  const [userProperties, setUserProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // プロパティ一覧を取得する関数
  const fetchProperties = async () => {
    try {
      setIsLoading(true);
      const data = await api.getUserProperties();
      // APIレスポンスの構造に合わせて調整
      const properties = data.properties.map((item: any) => item.property);
      setUserProperties(properties);
      console.log("Fetched user properties:", properties);

      // 最初のプロパティを選択
      if (properties.length > 0 && !selectedProperty) {
        setSelectedProperty(properties[0]);
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // プロパティを再取得する関数
  const refreshProperties = async () => {
    await fetchProperties();
  };

  // コンポーネントマウント時にプロパティを取得
  useEffect(() => {
    fetchProperties();
  }, []);

  const value: PropertyContextType = {
    selectedProperty,
    setSelectedProperty,
    userProperties,
    isLoading,
    refreshProperties,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
}

// Custom hook for using PropertyContext
export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error("useProperty must be used within a PropertyProvider");
  }
  return context;
}
