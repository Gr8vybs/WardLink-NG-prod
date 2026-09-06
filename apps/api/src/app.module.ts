import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Controller, Get } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "./auth/auth.module";
import { SyncMergeModule } from "./sync-merge/sync-merge.module";
import { ConflictEscalationModule } from "./conflict-escalation/conflict-escalation.module";
import { AttachmentModule } from "./attachment/attachment.module";
import { ReferralModule } from "./referral/referral.module";
import { NotificationModule } from "./notification/notification.module";

import { Patient } from "./entities/patient.entity";
import { Handoff } from "./entities/handoff.entity";
import { StructuredField } from "./entities/structured-field.entity";
import { FieldOp } from "./entities/field-op.entity";
import { Conflict } from "./entities/conflict.entity";
import { User } from "./entities/user.entity";
import { Device } from "./entities/device.entity";
import { Facility } from "./entities/facility.entity";
import { Ward } from "./entities/ward.entity";
import { FacilityModule } from "./facility/facility.module";
import { WardModule } from "./ward/ward.module";
import { PatientModule } from "./patient/patient.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "wardlink-ng-api" };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? "wardlink_app",
      password: process.env.DB_PASSWORD ?? "app_password_change_me",
      database: process.env.DB_NAME ?? "wardlink_ng",
      entities: [Patient, Handoff, StructuredField, FieldOp, User, Device, Facility, Ward, Conflict],
      synchronize: false, // always use migrations — never auto-sync schema
      migrations: ["dist/migrations/*.js"],
    }),
    AuthModule,
    SyncMergeModule,
    ConflictEscalationModule,
    AttachmentModule,
    ReferralModule,
    NotificationModule,
    FacilityModule,
    WardModule,
    PatientModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}