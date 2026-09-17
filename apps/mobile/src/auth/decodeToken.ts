import type { AuthTokenPayload } from "@wardlink/shared";

/**
 * Decodes (does NOT verify) a JWT payload — purely for client-side UI
 * decisions like "does this session need a PIN before writing". The
 * server independently verifies every token on every request; this is
 * never a security boundary, just a way to read claims we already
 * trust because we're the ones holding the token.
 *
 * Avoids atob()/Buffer, neither of which is reliably available across
 * React Native JS engines (Hermes in particular) — decodes base64url
 * manually instead.
 */
export function decodeJwtPayload(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const jsonStr = base64Decode(padded);
    return JSON.parse(jsonStr) as AuthTokenPayload;
  } catch {
    return null;
  }
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Decode(input: string): string {
  let output = "";
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of input) {
    if (char === "=") break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output += String.fromCharCode((buffer >> bitsCollected) & 0xff);
    }
  }

  // JWT payloads are UTF-8 JSON; decode the raw bytes as UTF-8 rather
  // than assuming Latin-1, so non-ASCII characters don't get mangled.
  return decodeUtf8(output);
}

function decodeUtf8(bytes: string): string {
  try {
    return decodeURIComponent(
      bytes
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return bytes;
  }
}