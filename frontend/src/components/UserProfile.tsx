"use client";

import Image from "next/image";
import { useUser } from "@/hooks/useUser";

export function UserProfile() {
  const { user, loading } = useUser();

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

  return (
    <div className="ml-auto flex items-center">
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
    </div>
  );
}
