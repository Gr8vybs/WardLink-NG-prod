/**
 * Ward Link NG — shared data model.
 * Imported by both apps/api and apps/mobile so they never drift out of
 * sync on shape.
 */

/** A Hybrid Logical Clock stamp — used instead of raw wall-clock time so
 * causal ordering stays correct even when devices have unsynced clocks. */
export interface HLC {
  counter: number;
  deviceId: string;
  wallClockHint: string; // ISO timestamp, advisory only — never trusted alone
}

export type UserRole = "nurse" | "doctor" | "ward_head" | "director";
export type AuthType = "individual" | "shared_device" | "shared_device_pin_verified";

/** Shape of the decoded JWT payload — shared so the mobile client can
 * reason about its own token (e.g. checking authType) without guessing. */
export interface AuthTokenPayload {
  sub: string | null; // user id — null for a broad shared-device session before PIN verification
  facilityId: string;
  role: UserRole | null;
  authType: AuthType;
  deviceId: string | null;
}
export type DeviceType = "shared_ward_device" | "personal";
export type HandoffStatus = "open" | "acknowledged";
export type FieldType = "vitals" | "meds" | "allergies" | "codeStatus";
export type ConflictStatus = "open" | "escalated" | "resolved";
export type ReferralStatus = "sent" | "claimed";
export type UploadStatus = "queued" | "uploading" | "synced" | "failed";

export interface Facility {
  id: string;
  name: string;
  type: "PHC" | "hospital" | "teaching_hospital";
  ndprComplianceContact: string;
}

export interface Ward {
  id: string;
  facilityId: string;
  name: string;
  acuityLevel: "standard" | "high_acuity"; // affects default conflict-blocking behaviour
}

export interface User {
  id: string;
  facilityId: string;
  role: UserRole;
  authType: AuthType;
  active: boolean;
}

export interface Device {
  id: string;
  wardId: string;
  deviceType: DeviceType;
  currentSessionUserId: string | null;
}

export interface Patient {
  id: string;
  demographics: {
    name: string;
    age: number;
    sex: "M" | "F";
    allergies: string;
  };
  facilityOfOriginId: string;
  currentFacilityId: string;
  createdAt: string;
}

export interface Handoff {
  id: string;
  patientId: string;
  wardId: string;
  authorId: string;
  deviceId: string;
  shiftPeriod: string; // e.g. "2026-08-31-morning"
  status: HandoffStatus;
  hlc: HLC;
}

/** Current value of a mutable, patient-level field. This is what the UI
 * reads — never replay the op log for display. */
export interface StructuredField {
  id: string;
  patientId: string;
  fieldType: FieldType;
  currentValue: string;
  currentHlc: HLC;
  currentAuthorId: string;
}

/** Append-only op log entry — the actual source of truth for a field's
 * history and the input to conflict detection. Never edited or deleted. */
export interface FieldOp {
  id: string;
  fieldId: string;
  value: string;
  hlc: HLC;
  authorId: string;
  deviceId: string;
  createdAt: string;
}

/** Append-only freeform note. Never edited. */
export interface Note {
  id: string;
  patientId: string;
  authorId: string;
  hlc: HLC;
  text: string;
  createdAt: string;
}

/** Append-only, immutable once uploaded. */
export interface Attachment {
  id: string;
  patientId: string;
  uploadedBy: string;
  hlc: HLC;
  fileRef: string;
  mimeType: string;
  uploadStatus: UploadStatus;
  createdAt: string;
}

/** Append-only record of who received a handoff and when. */
export interface Acknowledgment {
  id: string;
  handoffId: string;
  acknowledgedBy: string;
  hlc: HLC;
  createdAt: string;
}

export interface Conflict {
  id: string;
  fieldId: string;
  competingOpIds: string[];
  status: ConflictStatus;
  openedAt: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionValue: string | null;
}

/** A referral is a frozen snapshot at send time — never a live merge into
 * the destination facility's data. */
export interface Referral {
  id: string;
  patientId: string;
  originFacilityId: string;
  destFacilityId: string;
  snapshotRef: string; // pointer to the frozen patient/handoff snapshot
  status: ReferralStatus;
  sentBy: string;
  claimedBy: string | null;
  sentAt: string;
  claimedAt: string | null;
}
