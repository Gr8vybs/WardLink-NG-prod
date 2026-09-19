import type { AuthTokenPayload } from "@wardlink/shared";

/**
 * Storage abstraction so the client's request/response logic can be
 * tested outside a React Native runtime. The real app wires this to
 * expo-secure-store (see storage/secureTokenStore.ts); tests and any
 * pure-Node verification use storage/memoryTokenStore.ts instead.
 */
export interface TokenStore {
  getToken(): Promise<string | null>;
  setToken(token: string | null): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
}

/**
 * Thin fetch wrapper: attaches the stored bearer token automatically,
 * parses JSON responses, and turns non-2xx responses into a typed
 * ApiError instead of leaving callers to check res.ok everywhere.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  get tokenStore() {
    return this.options.tokenStore;
  }

  /** Runs a single request with a token OTHER than the one currently
   * stored — used for the PIN-verification step, where the short-lived
   * "shared_device_pin_verified" token from that one response is used
   * for exactly one follow-up write, not saved as the ongoing session. */
  async requestWithToken<T>(
    path: string,
    token: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    return this.doRequest<T>(path, token, init);
  }

  async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const token = await this.options.tokenStore.getToken();
    return this.doRequest<T>(path, token, init);
  }

  /**
   * Multipart file upload. Deliberately separate from request()/
   * doRequest() rather than reusing them — those always set
   * Content-Type: application/json, but a multipart body needs a
   * boundary that only fetch itself can generate correctly when given a
   * FormData body with NO Content-Type header set manually. Setting one
   * by hand (even to "multipart/form-data") breaks the boundary and the
   * server can't parse the upload.
   */
  async uploadFile<T>(path: string, formData: FormData, overrideToken?: string): Promise<T> {
    const token = overrideToken ?? (await this.options.tokenStore.getToken());
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : `Upload failed with status ${res.status}`;
      throw new ApiError(res.status, message, parsed);
    }

    return parsed as T;
  }

  /** Builds an authenticated URL + headers pair suitable for passing to
   * RN's <Image source={{ uri, headers }} /> — Image doesn't go through
   * this client's request path, so it needs the bearer token handed to
   * it directly. */
  async getAuthenticatedFileSource(path: string): Promise<{ uri: string; headers: Record<string, string> }> {
    const token = await this.options.tokenStore.getToken();
    return {
      uri: `${this.options.baseUrl}${path}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
  }

  private async doRequest<T>(
    path: string,
    token: string | null,
    init: { method?: string; body?: unknown },
  ): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : `Request failed with status ${res.status}`;
      throw new ApiError(res.status, message, parsed);
    }

    return parsed as T;
  }

  async logout() {
    await this.options.tokenStore.setToken(null);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type { AuthTokenPayload };