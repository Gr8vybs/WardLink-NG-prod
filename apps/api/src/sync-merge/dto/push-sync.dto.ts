import type { HLC, FieldType } from "@wardlink/shared";

export class FieldOpInputDto {
  patientId: string;
  fieldType: FieldType;
  value: string;
  hlc: HLC;
  baseHlc: HLC | null;
}

export class PushSyncDto {
  ops: FieldOpInputDto[];
}