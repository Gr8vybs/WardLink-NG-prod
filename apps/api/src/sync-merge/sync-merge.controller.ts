import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { SyncMergeService } from "./sync-merge.service";
import { PushSyncDto } from "./dto/push-sync.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireIndividualAuthGuard } from "../auth/require-individual-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("sync")
export class SyncMergeController {
  constructor(private readonly syncMergeService: SyncMergeService) {}

  // Writing a structured field (vitals, meds, etc.) is attributed to a
  // specific person, same reasoning as patient creation/edits.
  @UseGuards(RequireIndividualAuthGuard)
  @Post("push")
  push(@CurrentUser() user: AuthTokenPayload, @Body() dto: PushSyncDto) {
    return this.syncMergeService.push(user.facilityId, user.sub as string, dto.ops);
  }

  @Get("pull")
  pull(@CurrentUser() user: AuthTokenPayload, @Query("patientIds") patientIds: string) {
    const ids = patientIds.split(",").filter(Boolean);
    return this.syncMergeService.pull(user.facilityId, ids);
  }
}