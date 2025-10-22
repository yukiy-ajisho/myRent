import { createClient } from "@/lib/supabase-client";

export type AuthState = "unauthenticated" | "authenticating" | "authenticated";

export interface AuthUser {
  user_id: string;
  user_type: "owner" | "tenant";
}

export async function getAuthState(): Promise<{
  state: AuthState;
  user?: AuthUser;
}> {
  const supabase = createClient();

  // 1. セッション確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { state: "unauthenticated" };
  }

  // 2. app_userテーブル確認
  const { data: appUser, error } = await supabase
    .from("app_user")
    .select("user_id, user_type")
    .eq("user_id", user.id)
    .single();

  if (error || !appUser) {
    return { state: "authenticating" };
  }

  return {
    state: "authenticated",
    user: {
      user_id: appUser.user_id,
      user_type: appUser.user_type as "owner" | "tenant",
    },
  };
}
