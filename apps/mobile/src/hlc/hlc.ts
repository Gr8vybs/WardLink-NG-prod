import * as SecureStore from "expo-secure-store";
import type { HLC } from "@wardlink/shared";

const DEVICE_ID_KEY = "wardlink_device_id";
const HLC_COUNTER_KEY = "wardlink_hlc_counter";

let cachedDeviceId: string | null = null;
let cachedCounter: number | null = null;

function generateUuidV4(): string {
  // Lightweight RFC4122-ish v4 generator — avoids pulling in a UUID
  // dependency just for this. Fine for a device identifier, which only
  // needs to be unique per install, not cryptographically rigorous.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable per-installation identifier — generated once and persisted,
 * reused for every HLC this device produces. This is what lets the
 * server's conflict detection recognize "this device already saw that
 * write" versus "two different devices edited independently". */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = generateUuidV4();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  cachedDeviceId = id;
  return id;
}

/**
 * Produces the next HLC for a write this device is about to make. The
 * counter is persisted and only ever increases — even across app
 * restarts — so it can never collide with or go backward relative to a
 * counter this same device already used.
 *
 * NOTE: this simple read-increment-write is not atomic against
 * concurrent calls within the same tick if two writes are ever
 * dispatched in true parallel from this device. In practice, the app's
 * write actions are user-initiated one at a time, so this is fine for
 * now; a stricter implementation would serialize increments through a
 * single queue if that ever changes.
 */
export async function nextHlc(): Promise<HLC> {
  const deviceId = await getDeviceId();

  if (cachedCounter === null) {
    const stored = await SecureStore.getItemAsync(HLC_COUNTER_KEY);
    cachedCounter = stored ? parseInt(stored, 10) : 0;
  }
  cachedCounter += 1;
  await SecureStore.setItemAsync(HLC_COUNTER_KEY, String(cachedCounter));

  return {
    counter: cachedCounter,
    deviceId,
    wallClockHint: new Date().toISOString(),
  };
}