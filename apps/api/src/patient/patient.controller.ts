import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PatientService } from "./patient.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireIndividualAuthGuard } from "../auth/require-individual-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("patients")
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // Admitting a patient is attributed to a specific person — requires
  // individual auth (personal login or PIN-verified on a shared device).
  @UseGuards(RequireIndividualAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreatePatientDto) {
    return this.patientService.create(user.facilityId, user.sub as string, dto);
  }

  // Reading the patient list is fine on a bare shared-device session —
  // no specific person needs to be attributed to a read.
  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.patientService.list(user.facilityId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string) {
    return this.patientService.findOne(user.facilityId, id);
  }

  @UseGuards(RequireIndividualAuthGuard)
  @Patch(":id")
  update(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string, @Body() dto: UpdatePatientDto) {
    return this.patientService.update(user.facilityId, id, dto);
  }
}