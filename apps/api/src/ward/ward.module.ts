import { Module } from "@nestjs/common";
import { WardService } from "./ward.service";
import { WardController } from "./ward.controller";

@Module({
  controllers: [WardController],
  providers: [WardService],
})
export class WardModule {}