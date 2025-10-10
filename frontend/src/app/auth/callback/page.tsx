"use client";

import { createClient } from "@/lib/supabase-client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("AuthCallback: Starting authentication process");

        const supabase = createClient();
        console.log("AuthCallback: Supabase client created");

        // URLパラメータから認証コードを取得
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        console.log("AuthCallback: Search params:", { code, error });

        if (error) {
          console.error("Auth callback error from URL:", error);
          router.push("/login?error=auth_failed");
          return;
        }

        if (code) {
          console.log("AuthCallback: Found code, exchanging for session");
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          console.log("AuthCallback: Exchange result:", {
            data,
            exchangeError,
          });

          if (exchangeError) {
            console.error("Auth callback exchange error:", exchangeError);
            router.push("/login?error=auth_failed");
            return;
          }

          if (data.session) {
            console.log(
              "AuthCallback: Session established, redirecting to admin"
            );
            router.push("/admin");
            return;
          }
        }

        // フォールバック: セッションを確認
        console.log("AuthCallback: Checking existing session");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        console.log("AuthCallback: Session data:", { session, sessionError });

        if (sessionError) {
          console.error("Auth callback session error:", sessionError);
          router.push("/login?error=auth_failed");
          return;
        }

        if (session?.user) {
          console.log("AuthCallback: User found, redirecting to admin");
          router.push("/admin");
          return;
        }

        console.log("AuthCallback: No user found, redirecting to login");
        router.push("/login?error=no_session");
      } catch (err) {
        console.error("AuthCallback: Unexpected error:", err);
        router.push("/login?error=auth_failed");
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Authenticating...
          </h2>
          <p className="mt-2 text-gray-600">
            Please wait while we complete your sign-in.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">
            Authentication Error
          </h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return null;
}
