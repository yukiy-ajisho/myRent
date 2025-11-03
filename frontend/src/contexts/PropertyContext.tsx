"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  const isInitialMount = useRef(true);

  // プロパティ一覧を取得する関数
  const fetchProperties = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getUserProperties();
      // APIレスポンスの構造に合わせて調整
      const properties = data.properties.map(
        (item: { property: Property }) => item.property
      );
      setUserProperties(properties);
      console.log("Fetched user properties:", properties);

      // 最初のプロパティを選択（初回マウント時のみ）
      if (properties.length > 0 && isInitialMount.current) {
        console.log(
          "PropertyContext: Auto-selecting first property on initial mount"
        );
        setSelectedProperty(properties[0]);
        isInitialMount.current = false;
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // プロパティを再取得する関数
  const refreshProperties = async () => {
    await fetchProperties();
  };

  // コンポーネントマウント時にプロパティを取得
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

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
