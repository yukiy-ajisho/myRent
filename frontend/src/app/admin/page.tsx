import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPanel />
    </div>
  );
}
