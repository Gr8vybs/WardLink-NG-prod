import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
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

  // Resolving is attributed to a specific person, same reasoning as every
  // other clinical-data write in this app.
  @UseGuards(RequireIndividualAuthGuard)
  @Patch(":id/resolve")
  resolve(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string, @Body() dto: ResolveConflictDto) {
    return this.conflictEscalationService.resolve(user.facilityId, id, user.sub as string, dto.resolutionValue);
  }
}