import type { HLC } from "@wardlink/shared";

export class InitiateAttachmentDto {
  patientId: string;
  mimeType: string;
  hlc: HLC;
}