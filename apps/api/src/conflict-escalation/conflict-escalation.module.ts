import { Module } from "@nestjs/common";
import { ConflictEscalationService } from "./conflict-escalation.service";
import { ConflictEscalationController } from "./conflict-escalation.controller";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [NotificationModule],
  controllers: [ConflictEscalationController],
  providers: [ConflictEscalationService],
})
export class ConflictEscalationModule {}