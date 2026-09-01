import { Module } from "@nestjs/common";

/**
 * ReferralModule
 * The only sanctioned cross-facility write path. Sends a frozen patient
 * snapshot; claiming creates a new local Patient record rather than
 * merging into an existing one. Placeholder — providers to be added.
 */
@Module({})
export class ReferralModule {}
