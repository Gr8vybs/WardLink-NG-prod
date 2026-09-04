export class CreateFacilityDto {
  name: string;
  type: "PHC" | "hospital" | "teaching_hospital";
  ndprComplianceContact: string;
}