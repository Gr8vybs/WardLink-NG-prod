import type { HLC } from "@wardlink/shared";

/** Total order over HLCs: higher counter wins; ties broken by deviceId so
 * the comparison is always deterministic (never truly "equal" between
 * different writes). wallClockHint is advisory only and never compared —
 * device clocks aren't trusted. */
export function compareHlc(a: HLC, b: HLC): number {
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0;
}

/** Whether two HLCs refer to the exact same logical write — used to check
 * a client's baseHlc against a field's actual current HLC. */
export function hlcEquals(a: HLC | null, b: HLC | null): boolean {
  if (!a || !b) return false;
  return a.counter === b.counter && a.deviceId === b.deviceId;
}