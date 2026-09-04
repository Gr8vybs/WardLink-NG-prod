import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { FacilityService } from "./facility.service";
import { CreateFacilityDto } from "./dto/create-facility.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@Controller("facilities")
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  // Intentionally has NO auth guard — a facility must be able to come
  // into existence before anyone can hold a token scoped to it. In a
  // real deployment this would sit behind a separate, secured onboarding
  // process (e.g. an internal admin tool or a Terraform-provisioned
  // seed), not a public endpoint reachable from the mobile app.
  @Post()
  create(@Body() dto: CreateFacilityDto) {
    return this.facilityService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMine(@CurrentUser() user: AuthTokenPayload) {
    return this.facilityService.getMine(user.facilityId);
  }
}