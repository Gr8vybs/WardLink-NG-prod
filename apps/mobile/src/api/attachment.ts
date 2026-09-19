import { ApiClient } from "./client";
import type { Attachment, HLC } from "@wardlink/shared";

export async function initiateAttachment(
  client: ApiClient,
  patientId: string,
  mimeType: string,
  hlc: HLC,
  overrideToken?: string,
): Promise<Attachment> {
  const body = { patientId, mimeType, hlc };
  return overrideToken
    ? client.requestWithToken<Attachment>("/attachments", overrideToken, { method: "POST", body })
    : client.request<Attachment>("/attachments", { method: "POST", body });
}

/**
 * Uploads the actual file bytes for an attachment already created via
 * initiateAttachment. `file` matches the shape expo-image-picker (and
 * most RN file pickers) return: a local file uri plus a name and MIME
 * type — NOT a File/Blob object, which isn't how React Native's fetch
 * expects multipart parts to be described.
 */
export async function uploadAttachmentFile(
  client: ApiClient,
  attachmentId: string,
  file: { uri: string; name: string; type: string },
  overrideToken?: string,
): Promise<Attachment> {
  const formData = new FormData();
  // @ts-expect-error — React Native's FormData accepts this
  // {uri, name, type} shape for a file part; it's not the standard web
  // File/Blob interface TypeScript's DOM lib expects, but it's what RN
  // actually requires here.
  formData.append("file", { uri: file.uri, name: file.name, type: file.type });

  return client.uploadFile<Attachment>(`/attachments/${attachmentId}/upload`, formData, overrideToken);
}

export async function listAttachmentsForPatient(client: ApiClient, patientId: string): Promise<Attachment[]> {
  return client.request<Attachment[]>(`/attachments?patientId=${patientId}`);
}

export async function getAttachmentImageSource(client: ApiClient, attachmentId: string) {
  return client.getAuthenticatedFileSource(`/attachments/${attachmentId}/file`);
}