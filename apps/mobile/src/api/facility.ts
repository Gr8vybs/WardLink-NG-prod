import { ApiClient } from "./client";
import type { Facility, Patient } from "@wardlink/shared";

export async function getMyFacility(client: ApiClient): Promise<Facility> {
  return client.request<Facility>("/facilities/me");
}

export async function listPatients(client: ApiClient): Promise<Patient[]> {
  return client.request<Patient[]>("/patients");
}

export interface FacilityDirectoryEntry {
  id: string;
  name: string;
  type: string;
}

/** For picking a referral destination — every other facility's basic
 * info, not just the caller's own. */
export async function listFacilityDirectory(client: ApiClient): Promise<FacilityDirectoryEntry[]> {
  return client.request<FacilityDirectoryEntry[]>("/facilities/directory");
}