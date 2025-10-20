import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // ユーザーの種類に応じてリダイレクト
    redirect("/owner/dashboard");
  } else {
    redirect("/login");
  }
}
