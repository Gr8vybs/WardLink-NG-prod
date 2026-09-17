import { ApiClient } from "./client";
import type { Conflict, FieldOp } from "@wardlink/shared";

export interface ConflictDetail {
  conflict: Conflict;
  competingOps: FieldOp[];
}

export async function listOpenConflicts(client: ApiClient): Promise<Conflict[]> {
  return client.request<Conflict[]>("/conflicts");
}

export async function getConflictDetail(client: ApiClient, conflictId: string): Promise<ConflictDetail> {
  return client.request<ConflictDetail>(`/conflicts/${conflictId}`);
}

export async function resolveConflict(
  client: ApiClient,
  conflictId: string,
  resolutionValue: string,
): Promise<unknown> {
  return client.request(`/conflicts/${conflictId}/resolve`, {
    method: "PATCH",
    body: { resolutionValue },
  });
}