import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { WardService } from "./ward.service";
import { CreateWardDto } from "./dto/create-ward.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("wards")
export class WardController {
  constructor(private readonly wardService: WardService) {}

  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreateWardDto) {
    return this.wardService.create(user.facilityId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.wardService.list(user.facilityId);
  }
}