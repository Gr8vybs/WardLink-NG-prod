import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ReferralService } from "./referral.service";
import { CreateReferralDto } from "./dto/create-referral.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireIndividualAuthGuard } from "../auth/require-individual-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("referrals")
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @UseGuards(RequireIndividualAuthGuard)
  @Post()
  send(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreateReferralDto) {
    return this.referralService.send(user.facilityId, user.sub as string, dto);
  }

  @Get("outgoing")
  listOutgoing(@CurrentUser() user: AuthTokenPayload) {
    return this.referralService.listOutgoing(user.facilityId);
  }

  @Get("incoming")
  listIncoming(@CurrentUser() user: AuthTokenPayload) {
    return this.referralService.listIncoming(user.facilityId);
  }

  @UseGuards(RequireIndividualAuthGuard)
  @Post(":id/claim")
  claim(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string) {
    return this.referralService.claim(user.facilityId, user.sub as string, id);
  }
}