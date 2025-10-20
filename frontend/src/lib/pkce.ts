// PKCE (Proof Key for Code Exchange) utilities

/**
 * Generate a cryptographically random code verifier
 * @returns A random string of 43-128 characters
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate a code challenge from a code verifier
 * @param codeVerifier The code verifier
 * @returns A SHA256 hash of the code verifier, base64url encoded
 */
export async function generateCodeChallenge(
  codeVerifier: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Store code verifier in session storage and cookie
 * @param codeVerifier The code verifier to store
 */
export function storeCodeVerifier(codeVerifier: string): void {
  if (typeof window !== "undefined") {
    // Store in sessionStorage (for client-side access)
    sessionStorage.setItem("pkce_code_verifier", codeVerifier);

    // Store in cookie (for server-side access)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10); // 10分で期限切れ

    // 環境に応じてsecureフラグを設定
    const isSecure = window.location.protocol === "https:";
    const secureFlag = isSecure ? "; secure" : "";

    const cookieString = `pkce_code_verifier=${codeVerifier}; path=/; expires=${expires.toUTCString()}${secureFlag}; samesite=lax`;

    // デバッグログ
    console.log("Setting PKCE cookie:", cookieString);
    console.log("Protocol:", window.location.protocol);
    console.log("Is secure:", isSecure);

    document.cookie = cookieString;

    // Cookieが設定されたか確認
    setTimeout(() => {
      const cookies = document.cookie;
      console.log("All cookies after setting:", cookies);
      const pkceCookie = cookies
        .split(";")
        .find((c) => c.trim().startsWith("pkce_code_verifier="));
      console.log("PKCE cookie found:", pkceCookie);
    }, 100);
  }
}

/**
 * Retrieve code verifier from session storage
 * @returns The stored code verifier or null if not found
 */
export function getCodeVerifier(): string | null {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("pkce_code_verifier");
  }
  return null;
}

/**
 * Clear code verifier from session storage and cookie
 */
export function clearCodeVerifier(): void {
  if (typeof window !== "undefined") {
    // Clear from sessionStorage
    sessionStorage.removeItem("pkce_code_verifier");

    // Clear from cookie
    document.cookie =
      "pkce_code_verifier=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}
