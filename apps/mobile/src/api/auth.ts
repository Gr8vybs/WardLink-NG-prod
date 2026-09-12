import { ApiClient } from "./client";

export interface LoginResult {
  accessToken: string;
}

/** Individual login on a personal device. Stores the returned token as
 * the ongoing session. */
export async function login(client: ApiClient, staffId: string, password: string): Promise<void> {
  const result = await client.request<LoginResult>("/auth/login", {
    method: "POST",
    body: { staffId, password },
  });
  await client.tokenStore.setToken(result.accessToken);
}

/** Starts a broad session on a shared ward device. This token alone
 * cannot attribute a write to a specific person — see verifyPinForAction
 * below, which is required before any write action on a shared device. */
export async function startDeviceSession(client: ApiClient, deviceId: string): Promise<void> {
  const result = await client.request<LoginResult>("/auth/device/start-shift", {
    method: "POST",
    body: { deviceId },
  });
  await client.tokenStore.setToken(result.accessToken);
}

/**
 * Per-action PIN re-auth. Returns a short-lived token attributing the
 * NEXT write to a specific person — deliberately NOT saved as the
 * ongoing session (that stays the broad device session). The caller
 * uses the returned token for exactly one follow-up write via
 * client.requestWithToken(...), then discards it.
 */
export async function verifyPinForAction(
  client: ApiClient,
  staffId: string,
  pin: string,
): Promise<string> {
  const result = await client.request<LoginResult>("/auth/device/verify-pin", {
    method: "POST",
    body: { staffId, pin },
  });
  return result.accessToken;
}