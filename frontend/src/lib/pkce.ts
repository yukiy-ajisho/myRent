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
 * Store code verifier in session storage
 * @param codeVerifier The code verifier to store
 */
export function storeCodeVerifier(codeVerifier: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("pkce_code_verifier", codeVerifier);
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
 * Clear code verifier from session storage
 */
export function clearCodeVerifier(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("pkce_code_verifier");
  }
}
