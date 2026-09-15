import { ApiClient } from "./client";
import type { Ward } from "@wardlink/shared";

export async function listWards(client: ApiClient): Promise<Ward[]> {
  return client.request<Ward[]>("/wards");
}