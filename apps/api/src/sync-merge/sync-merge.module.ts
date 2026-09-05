import { Module } from "@nestjs/common";
import { SyncMergeService } from "./sync-merge.service";
import { SyncMergeController } from "./sync-merge.controller";

/**
 * SyncMergeModule
 * Accepts each device's queued FieldOp batch, applies HLC-based ordering,
 * detects conflicts, and returns ops the device hasn't seen yet.
 */
@Module({
  controllers: [SyncMergeController],
  providers: [SyncMergeService],
})
export class SyncMergeModule {}