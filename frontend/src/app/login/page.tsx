"use client";

import { createClient } from "@/lib/supabase-client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  storeCodeVerifier,
} from "@/lib/pkce";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // useEffect(() => {
  //   // Check if user is already logged in
  //   const checkUser = async () => {
  //     const supabase = createClient();
  //     const {
  //       data: { user },
  //     } = await supabase.auth.getUser();

  //     if (user) {
  //       router.push("/owner/dashboard");
  //     }
  //   };

  //   checkUser();
  // }, [router]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code verifier for later use
      storeCodeVerifier(codeVerifier);

      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
          },
        },
      });

      if (error) {
        console.error("Error signing in:", error);
        alert("認証エラーが発生しました: " + error.message);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("予期しないエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Use Google OAuth to access the admin panel
          </p>
        </div>
        <div>
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "認証中..." : "Sign in with Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
