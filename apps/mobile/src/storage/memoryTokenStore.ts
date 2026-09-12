import type { TokenStore } from "../api/client";

/** Pure in-memory implementation — used for verification scripts and
 * unit tests, where there's no device keychain to store a real token
 * in. NEVER used in the actual app; a token held only in memory
 * disappears on every reload, which is fine for a test but not for a
 * real login session. */
export class MemoryTokenStore implements TokenStore {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token;
  }
}