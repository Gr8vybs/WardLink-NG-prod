import { Module } from "@nestjs/common";

/**
 * SyncMergeModule
 * Accepts each device's queued FieldOp batch, applies HLC-based ordering,
 * detects conflicts, and returns ops the device hasn't seen yet.
 * Placeholder — providers to be added.
 */
@Module({})
export class SyncMergeModule {}
