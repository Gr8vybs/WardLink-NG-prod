import { ApiClient } from "./client";
import type { Referral, Patient } from "@wardlink/shared";

export async function sendReferral(
  client: ApiClient,
  patientId: string,
  destFacilityId: string,
  reason: string,
): Promise<Referral> {
  return client.request<Referral>("/referrals", {
    method: "POST",
    body: { patientId, destFacilityId, reason },
  });
}

export async function listOutgoingReferrals(client: ApiClient): Promise<Referral[]> {
  return client.request<Referral[]>("/referrals/outgoing");
}

export async function listIncomingReferrals(client: ApiClient): Promise<Referral[]> {
  return client.request<Referral[]>("/referrals/incoming");
}

export interface ClaimResult {
  referralId: string;
  newPatient: Patient;
}

export async function claimReferral(client: ApiClient, referralId: string): Promise<ClaimResult> {
  return client.request<ClaimResult>(`/referrals/${referralId}/claim`, { method: "POST" });
}