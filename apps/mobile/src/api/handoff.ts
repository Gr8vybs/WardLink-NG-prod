import { ApiClient } from "./client";
import type { Handoff, Note, Acknowledgment, HLC, StructuredField } from "@wardlink/shared";

export interface HandoffDetail {
  handoff: Handoff;
  notes: Note[];
  acknowledgments: Acknowledgment[];
}

export async function findOpenHandoff(client: ApiClient, patientId: string): Promise<Handoff | null> {
  const result = await client.request<Handoff | null>(`/handoffs/open?patientId=${patientId}`);
  return result ?? null;
}

export async function createHandoff(
  client: ApiClient,
  patientId: string,
  wardId: string,
  shiftPeriod: string,
  hlc: HLC,
  overrideToken?: string,
): Promise<Handoff> {
  const body = { patientId, wardId, shiftPeriod, hlc };
  return overrideToken
    ? client.requestWithToken<Handoff>("/handoffs", overrideToken, { method: "POST", body })
    : client.request<Handoff>("/handoffs", { method: "POST", body });
}

export async function getHandoffDetail(client: ApiClient, handoffId: string): Promise<HandoffDetail> {
  return client.request<HandoffDetail>(`/handoffs/${handoffId}`);
}

export async function addNote(
  client: ApiClient,
  handoffId: string,
  text: string,
  hlc: HLC,
  overrideToken?: string,
): Promise<Note> {
  const body = { text, hlc };
  return overrideToken
    ? client.requestWithToken<Note>(`/handoffs/${handoffId}/notes`, overrideToken, { method: "POST", body })
    : client.request<Note>(`/handoffs/${handoffId}/notes`, { method: "POST", body });
}

export async function acknowledgeHandoff(
  client: ApiClient,
  handoffId: string,
  hlc: HLC,
  overrideToken?: string,
): Promise<unknown> {
  const body = { hlc };
  return overrideToken
    ? client.requestWithToken(`/handoffs/${handoffId}/acknowledge`, overrideToken, { method: "POST", body })
    : client.request(`/handoffs/${handoffId}/acknowledge`, { method: "POST", body });
}

export async function pullStructuredFields(client: ApiClient, patientId: string): Promise<StructuredField[]> {
  return client.request<StructuredField[]>(`/sync/pull?patientIds=${patientId}`);
}