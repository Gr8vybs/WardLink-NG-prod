import { Module } from "@nestjs/common";
import { ConflictEscalationService } from "./conflict-escalation.service";
import { ConflictEscalationController } from "./conflict-escalation.controller";

/**
 * ConflictEscalationModule
 * Owns the Conflict lifecycle: listing open conflicts, viewing the
 * competing writes side by side, and resolving. The automatic aging
 * sweep (escalate to ward head past a threshold) is the next piece to
 * add here.
 */
@Module({
  controllers: [ConflictEscalationController],
  providers: [ConflictEscalationService],
})
export class ConflictEscalationModule {}