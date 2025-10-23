"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useUser } from "@/hooks/useUser";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function UserProfile() {
  const { user, loading } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="ml-auto flex items-center">
        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse mr-3"></div>
        <div className="w-20 h-5 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Googleプロフィール画像のURLを取得
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  // ユーザー名を取得（Googleの場合はfull_name、なければemail）
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  // フルネームを取得
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.name || "User";

  return (
    <div className="ml-auto flex items-center relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center hover:bg-gray-100 rounded-lg p-2 transition-colors"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="User Avatar"
            width={40}
            height={40}
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
            <span className="text-white font-semibold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <p className="font-semibold text-gray-900" style={{ fontSize: "20px" }}>
          {displayName}
        </p>
        <svg
          className={`w-5 h-5 ml-2 transition-transform ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* ドロップダウンメニュー */}
      {isDropdownOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* フルネーム */}
          <div className="px-4 pt-2 pb-1">
            <p className="text-sm font-medium text-gray-900">{fullName}</p>
          </div>

          {/* メールアドレス */}
          <div className="px-4 pt-0 pb-4 border-b border-gray-100">
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          {/* Sign Outボタン */}
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center text-sm text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
