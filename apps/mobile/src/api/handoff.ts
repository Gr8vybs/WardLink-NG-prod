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
): Promise<Handoff> {
  return client.request<Handoff>("/handoffs", {
    method: "POST",
    body: { patientId, wardId, shiftPeriod, hlc },
  });
}

export async function getHandoffDetail(client: ApiClient, handoffId: string): Promise<HandoffDetail> {
  return client.request<HandoffDetail>(`/handoffs/${handoffId}`);
}

export async function addNote(client: ApiClient, handoffId: string, text: string, hlc: HLC): Promise<Note> {
  return client.request<Note>(`/handoffs/${handoffId}/notes`, {
    method: "POST",
    body: { text, hlc },
  });
}

export async function acknowledgeHandoff(client: ApiClient, handoffId: string, hlc: HLC): Promise<unknown> {
  return client.request(`/handoffs/${handoffId}/acknowledge`, {
    method: "POST",
    body: { hlc },
  });
}

export async function pullStructuredFields(client: ApiClient, patientId: string): Promise<StructuredField[]> {
  return client.request<StructuredField[]>(`/sync/pull?patientIds=${patientId}`);
}