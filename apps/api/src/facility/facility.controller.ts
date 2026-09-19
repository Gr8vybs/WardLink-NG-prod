import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { FacilityService } from "./facility.service";
import { CreateFacilityDto } from "./dto/create-facility.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BootstrapSecretGuard } from "./bootstrap-secret.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@Controller("facilities")
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  @UseGuards(BootstrapSecretGuard)
  @Post()
  create(@Body() dto: CreateFacilityDto) {
    return this.facilityService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMine(@CurrentUser() user: AuthTokenPayload) {
    return this.facilityService.getMine(user.facilityId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("directory")
  listDirectory() {
    return this.facilityService.listDirectory();
  }
}