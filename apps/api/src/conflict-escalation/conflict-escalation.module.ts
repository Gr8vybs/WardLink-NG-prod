import { Module } from "@nestjs/common";

/**
 * ConflictEscalationModule
 * Tracks open Conflict records, runs the aging sweep, escalates to ward
 * heads past the configured threshold, and enforces the shift-boundary
 * backstop. Placeholder — providers to be added.
 */
@Module({})
export class ConflictEscalationModule {}
