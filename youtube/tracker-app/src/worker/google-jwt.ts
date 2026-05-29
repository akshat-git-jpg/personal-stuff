/**
 * google-jwt.ts
 * Web-standard (Workers + Node 20+) helpers for Google service-account JWT-bearer auth.
 * Uses only: globalThis.crypto.subtle, fetch, TextEncoder, atob.
 */

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

/** Encode Uint8Array → base64url (no padding). */
export function base64urlEncode(bytes: Uint8Array): string {
  // Convert to regular base64 via btoa on a binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Encode a UTF-8 string to base64url. */
export function base64urlEncodeString(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str));
}

// ---------------------------------------------------------------------------
// PEM PKCS8 → DER bytes
// ---------------------------------------------------------------------------

/**
 * Strip PEM header/footer + newlines, base64-decode → DER ArrayBuffer.
 * Handles both "BEGIN PRIVATE KEY" (PKCS8) variants.
 */
export function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN[^-]+-----/g, "")
    .replace(/-----END[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Column-letter helper
// ---------------------------------------------------------------------------

/** Convert 0-based column index → A1-style letter (0→A, 25→Z, 26→AA …). */
export function colLetter(idx: number): string {
  let result = "";
  let n = idx;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

// ---------------------------------------------------------------------------
// JWT mint
// ---------------------------------------------------------------------------

export interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms since epoch
}

/** Module-level in-memory token cache. */
let _tokenCache: TokenCache | null = null;

/**
 * Mint (or return cached) a Google OAuth access token using the JWT-bearer flow.
 * @param saJson - The full service account JSON string (one line or pretty).
 */
export async function getAccessToken(saJson: string): Promise<string> {
  const now = Date.now();
  // Return cached token if valid for another 60 s
  if (_tokenCache && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.accessToken;
  }

  const sa = JSON.parse(saJson) as {
    client_email: string;
    private_key: string;
  };

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = base64urlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64urlEncodeString(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp,
    }),
  );

  const signingInput = `${header}.${claims}`;

  // Import PKCS8 private key
  const derBuffer = pemToDer(sa.private_key);
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "pkcs8",
    derBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign
  const sigBytes = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signingInput),
    ),
  );
  const sig = base64urlEncode(sigBytes);

  const jwt = `${signingInput}.${sig}`;

  // Exchange JWT for access token
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed (${resp.status}): ${text}`);
  }

  const json = (await resp.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };

  return _tokenCache.accessToken;
}

// Re-export for sheets.ts convenience
export { getAccessToken as mintAccessToken };
