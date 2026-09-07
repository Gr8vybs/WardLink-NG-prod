import type { HLC } from "@wardlink/shared";

export class CreateHandoffDto {
  patientId: string;
  wardId: string;
  shiftPeriod: string;
  hlc: HLC;
}