import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // ユーザータイプ選択ページにリダイレクト
    redirect("/user-type-selection");
  } else {
    redirect("/login");
  }
}
