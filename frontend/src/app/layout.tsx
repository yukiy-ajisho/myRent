import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in and not on login page, redirect to login
  if (
    !user &&
    typeof window !== "undefined" &&
    !window.location.pathname.includes("/login")
  ) {
    redirect("/login");
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
