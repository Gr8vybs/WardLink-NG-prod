import { ApiClient } from "./client";
import type { HLC, FieldType } from "@wardlink/shared";

export interface FieldOpInput {
  patientId: string;
  fieldType: FieldType;
  value: string;
  hlc: HLC;
  baseHlc: HLC | null;
}

export interface SyncPushResult {
  patientId: string;
  fieldType: string;
  status: "applied" | "conflict";
  currentValue: string;
  currentHlc: unknown;
  conflictId?: string;
}

export async function pushFieldOps(
  client: ApiClient,
  ops: FieldOpInput[],
  overrideToken?: string,
): Promise<SyncPushResult[]> {
  const body = { ops };
  return overrideToken
    ? client.requestWithToken<SyncPushResult[]>("/sync/push", overrideToken, { method: "POST", body })
    : client.request<SyncPushResult[]>("/sync/push", { method: "POST", body });
}