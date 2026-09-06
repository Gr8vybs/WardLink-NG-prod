import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ConflictEscalationService } from "./conflict-escalation.service";
import { ResolveConflictDto } from "./dto/resolve-conflict.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireIndividualAuthGuard } from "../auth/require-individual-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("conflicts")
export class ConflictEscalationController {
  constructor(private readonly conflictEscalationService: ConflictEscalationService) {}

  @Get()
  listOpen(@CurrentUser() user: AuthTokenPayload) {
    return this.conflictEscalationService.listOpen(user.facilityId);
  }

  @Get(":id")
  getDetail(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string) {
    return this.conflictEscalationService.getDetail(user.facilityId, id);
  }

  // Manual trigger for the aging sweep — useful for ops ("check right
  // now") and for testing without waiting for the real cron interval.
  // Optional ?thresholdMinutes= override, mainly for testing a tighter
  // window than the configured default.
  // TODO: once roles are enforced via a guard, restrict this to
  // ward_head/director rather than any authenticated user.
  @Post("sweep-now")
  sweepNow(@Query("thresholdMinutes") thresholdMinutes?: string) {
    return this.conflictEscalationService.runAgingSweep(
      thresholdMinutes !== undefined ? Number(thresholdMinutes) : undefined,
    );
  }

  @UseGuards(RequireIndividualAuthGuard)
  @Patch(":id/resolve")
  resolve(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string, @Body() dto: ResolveConflictDto) {
    return this.conflictEscalationService.resolve(user.facilityId, id, user.sub as string, dto.resolutionValue);
  }
}