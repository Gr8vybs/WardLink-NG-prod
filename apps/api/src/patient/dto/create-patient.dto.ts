export class CreatePatientDto {
  name: string;
  age: number;
  sex: "M" | "F";
  allergies: string;
}