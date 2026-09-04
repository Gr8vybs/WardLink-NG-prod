import { Module } from "@nestjs/common";
import { FacilityService } from "./facility.service";
import { FacilityController } from "./facility.controller";

@Module({
  controllers: [FacilityController],
  providers: [FacilityService],
})
export class FacilityModule {}