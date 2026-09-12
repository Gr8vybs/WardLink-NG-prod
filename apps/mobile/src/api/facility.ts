import { ApiClient } from "./client";
import type { Facility, Patient } from "@wardlink/shared";

export async function getMyFacility(client: ApiClient): Promise<Facility> {
  return client.request<Facility>("/facilities/me");
}

export async function listPatients(client: ApiClient): Promise<Patient[]> {
  return client.request<Patient[]>("/patients");
}