# Ward Link NG

**Offline-first clinical patient handoff system for Nigerian hospitals.**

Ward Link NG solves a specific, high-stakes problem: shift-change handoffs and
inter-facility referrals routinely lose critical patient information — to
unreliable connectivity, paper charts, and verbal handoffs under time
pressure. This app is built so that:

- Every screen a nurse actually uses **works with no internet connection**.
- Two people editing the same patient's data **never silently overwrite each
  other** — conflicts are detected, surfaced, and escalated if ignored.
- Every clinical write is **attributable to a specific person**, even on a
  shared ward device passed between staff.
- Referring a patient to another facility **never merges two independent
  patient records** — it always creates a new one, with full provenance.

This is a from-scratch, production-grade rebuild used as a portfolio project
demonstrating full-stack architecture, distributed-systems reasoning
(offline sync, conflict resolution), and applied security engineering
(multi-tenant isolation, defense in depth) — not a toy CRUD app.

---

## Table of contents

- [Architecture at a glance](#architecture-at-a-glance)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Core design decisions](#core-design-decisions)
- [Data model](#data-model)
- [Security model](#security-model)
- [API reference](#api-reference)
- [Mobile app structure](#mobile-app-structure)
- [Getting started](#getting-started)
- [How this was verified during development](#how-this-was-verified-during-development)
- [Known limitations / honest gaps](#known-limitations--honest-gaps)
- [License](#license)

---

## Architecture at a glance

┌─────────────────────────┐
│   React Native (Expo)   │  ← works fully offline: local SQLite queue +
│   mobile client          │    cache, syncs opportunistically
└───────────┬──────────────┘
│ REST (JSON + multipart), Bearer JWT
▼
┌─────────────────────────┐
│   NestJS API             │  ← Auth, SyncMerge, ConflictEscalation,
│                           │    Facility, Ward, Patient, Handoff,
│                           │    Referral, Attachment, Notification
└───────────┬──────────────┘
│
▼
┌─────────────────────────┐
│   PostgreSQL              │  ← Row-Level Security enforces per-facility
│   (shared, multi-tenant) │    tenant isolation at the database level
└─────────────────────────┘

One shared Postgres database serves every hospital (facility), with **Row-
Level Security** — not just application-level filtering — as the actual
isolation boundary. The API always connects as a **restricted, non-superuser
role**; Postgres superusers bypass RLS entirely, so using one at runtime
would silently defeat every isolation guarantee below.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile client | React Native (Expo), TypeScript | Real offline capability (SQLite, background-safe storage) that a PWA can't reliably guarantee on iOS |
| Backend | NestJS, TypeScript | Module boundaries map directly onto the architecture below |
| Database | PostgreSQL | Row-Level Security is a first-class feature; JSONB for flexible structured fields |
| Local storage (mobile) | expo-sqlite | Persists the offline write queue and read cache across app restarts |
| Auth | Custom JWT (not Auth0/Clerk) | Facility-scoped claims + shared-device PIN re-auth aren't well served by generic auth providers |
| Password/PIN hashing | bcryptjs | Pure JS — no native compile step, works in constrained/offline-friendly dev environments |
| Attachment storage | Local disk (dev) | Stand-in for S3 + per-facility KMS — see [Known limitations](#known-limitations--honest-gaps) |
| Scheduling | @nestjs/schedule (in-process cron) | Drives the conflict-escalation sweep |
| Network status (mobile) | @react-native-community/netinfo | Triggers an automatic sync-queue flush on reconnect |

## Repository structure

wardlink-ng/
├── apps/
│   ├── api/                  NestJS backend
│   │   └── src/
│   │       ├── auth/                 login, device sessions, PIN re-auth
│   │       ├── sync-merge/           FieldOp push/pull, HLC conflict detection
│   │       ├── conflict-escalation/  list/resolve conflicts, aging sweep
│   │       ├── facility/ ward/ patient/ handoff/
│   │       ├── referral/             cross-facility referral snapshots
│   │       ├── attachment/           file upload/retrieval
│   │       ├── notification/         pull-model notifications
│   │       ├── entities/             TypeORM entities
│   │       ├── migrations/           schema history (see below)
│   │       └── common/tenant-context.ts   the withFacilityContext() RLS helper
│   └── mobile/                Expo React Native app
│       └── src/
│           ├── api/                  typed fetch wrappers per resource
│           ├── offline/              SQLite op queue, sync engine, cache
│           ├── hooks/useNetworkStatus.ts
│           ├── hlc/                  client-side HLC generation
│           ├── auth/decodeToken.ts
│           ├── components/           PinPadModal, SyncStatusPill, etc.
│           └── screens/
├── packages/
│   └── shared/                TypeScript types shared by both apps
└── infra/terraform/            placeholder — see Known limitations


## Core design decisions

### Offline-first sync: Hybrid Logical Clocks + append-only op log

Every write to a structured field (vitals, meds, allergies, code status)
becomes an immutable `FieldOp` row — never edited, never deleted. Each op
carries an **HLC** (`{ counter, deviceId, wallClockHint }`), generated
client-side and persisted across app restarts, so ordering stays correct
even with unsynced device clocks.

Plain HLCs give a strict total order (via `counter` then `deviceId`
tiebreak) — which means two writes are never technically "tied." So instead
of comparing timestamps to detect a conflict, each op also carries a
**`baseHlc`**: the HLC of the value the device *last saw* before making this
edit. At merge time:

- No existing field yet → first write, always clean.
- `baseHlc` matches the field's actual current HLC → the device had the
  latest data → clean update.
- `baseHlc` doesn't match → someone else changed the field after this
  device last saw it → **genuine conflict**. Both writes are preserved in
  the op log regardless; a `Conflict` record opens, the current value is
  set by HLC tiebreak (so the app keeps working), and the conflict stays
  visible until a human resolves it.

### Conflict escalation lifecycle

An open conflict doesn't just sit there. A scheduled sweep
(`escalate_aging_conflicts`, every 5 minutes) finds conflicts open past a
threshold (default 30 min, `ESCALATION_THRESHOLD_MINUTES`), flips them to
`escalated`, and creates a `Notification` for every `ward_head`/`director`
in that facility. Resolving a conflict is itself an attributed write — a
new `FieldOp`, authored by whoever resolved it — not a silent edit.

### Referrals are frozen snapshots, never live merges

Sending a referral captures the patient's demographics and current
structured fields **at that moment**, serialized into the referral row. The
receiving facility only ever sees that snapshot. Claiming a referral
**always creates a new `Patient` record** in the destination facility
(with `facilityOfOriginId` preserving provenance) — it never merges into an
existing patient. If the patient already has a record at the receiving
facility, staff reconcile manually; auto-merging two independent patient
identities is a patient-safety risk, not just a data-modeling inconvenience.

### Shared-device accountability

A shared ward device can hold a broad session (`authType: "shared_device"`)
with no individual attached. That token alone **cannot** perform a write
that needs attribution (`RequireIndividualAuthGuard` rejects it, 403). The
person must confirm a 4-digit PIN, which returns a short-lived (5 min)
token proving "it was you, right now" for exactly one write — never saved
as the ongoing session.

This has a real consequence for the offline queue: a PIN-verified token is
too short-lived to attach to a deferred write that might not sync until
connectivity returns much later. So on a **shared device**, structured-
field edits stay immediate (PIN prompt → write now). On a **personal
device**, the session token is long-lived (12h), so edits safely go through
the real offline queue.

## Data model

Key entities (see `packages/shared/src/index.ts` for full TypeScript
definitions):

| Entity | Mutability | Notes |
|---|---|---|
| `Facility` | Mutable (own row only) | Tenant boundary itself |
| `Ward` | Mutable | Scoped by `facility_id` |
| `User` | Mutable | `staff_id` login, optional `pin_hash` for shared-device use |
| `Device` | Mutable | Registered shared ward devices |
| `Patient` | Mutable (demographics only) | `facilityOfOriginId` vs `currentFacilityId` for referral provenance |
| `Handoff` | Status flips open→acknowledged | One per shift per patient |
| `StructuredField` | Mutable, HLC-versioned | Current value only — history lives in `FieldOp` |
| `FieldOp` | **Append-only** | The real audit trail; source of truth for conflict detection |
| `Note` | **Append-only** | Patient-scoped, spans shifts |
| `Acknowledgment` | **Append-only** | Who received a handoff, and when |
| `Conflict` | open → escalated → resolved | References the actual competing `FieldOp` rows |
| `Referral` | sent → claimed | `snapshotRef` holds the frozen JSON snapshot |
| `Attachment` | Append-only once uploaded | `fileRef` is a local path (dev) / would be an S3 key (prod) |
| `Notification` | Read/unread | Pull-model — no live push channel required |

### Migration history

1. `InitCoreTablesWithRLS` — patients, handoffs, structured_fields, field_ops + RLS
2. `CreateRestrictedAppRole` — the `wardlink_app` runtime role (`NOSUPERUSER NOBYPASSRLS`)
3. `CreateUsersAndDevices` — users, devices + `lookup_user_for_login()` (login must work before a facility context exists)
4. `AddDeviceLookupFunction` — `lookup_device_for_session()` (same reasoning, for shared-device sessions)
5. `CreateFacilitiesAndWards` — facilities, wards + `create_facility()` (same reasoning again — plus a subtlety: Postgres applies the `SELECT` RLS policy to `INSERT ... RETURNING`, so a permissive insert policy alone wasn't enough)
6. `AddSyncMergeSupport` — `base_hlc` column, unique `(patient_id, field_type)` constraint, `conflicts` table
7. `CreateNotesAndAcknowledgments`
8. `CreateReferralsAttachmentsNotifications` — referrals get **three distinct RLS policies** (see below), not the usual single one
9. `AddEscalationSweepFunction` — `escalate_aging_conflicts()`, a background job with no single facility's request context
10. `AddFacilityDirectory` — `list_facility_directory()`, so referrals can pick a destination facility at all

## Security model

- **Row-Level Security on every tenant table**, `FORCE`d so even the table
  owner is restricted — only a true Postgres superuser bypasses it, which
  is exactly why the app never connects as one.
- **Two Postgres roles**: an admin role for running migrations (needs
  `CREATE TABLE`/`ALTER`/policy privileges), and `wardlink_app` for the
  running API (`NOSUPERUSER NOBYPASSRLS`).
- **`withFacilityContext()`** (`apps/api/src/common/tenant-context.ts`) is
  the only sanctioned way to touch an RLS-protected table: it runs
  `SET LOCAL app.current_facility_id` inside a per-request transaction —
  never a bare `SET`, which would leak across requests on a pooled
  connection. Forgetting this wrapper doesn't leak data; it hard-errors,
  because the tables fail closed with no context set.
- **A small number of narrow `SECURITY DEFINER` functions** are the only
  deliberate exceptions to RLS, each solving a real chicken-and-egg
  problem (you can't scope by facility before you know the facility):
  login lookup, device-session lookup, facility creation, the facility
  directory, and the cross-facility escalation sweep. Each one is
  documented in its migration file with why it exists and what it
  deliberately does *not* expose.
- **Referrals get three separate RLS policies**, not the usual one — the
  only table where two different tenants legitimately share visibility
  into the same row: `SELECT` visible to either side, `INSERT` only by
  the origin, `UPDATE` (claiming) only by the destination.
- **JWT claims**: `sub` (user id, nullable), `facilityId`, `role`,
  `authType` (`individual` / `shared_device` / `shared_device_pin_verified`),
  `deviceId`.
- **`RequireIndividualAuthGuard`** rejects any write that needs
  attribution when the token's `authType` is a bare `shared_device`
  session — this is what actually enforces per-action PIN re-auth, rather
  than relying on every service method to remember to check it.
- **`BootstrapSecretGuard`** on facility creation — a stopgap (see
  limitations below), not real admin auth.

## API reference

All endpoints except `/health`, `/auth/*`, and `POST /facilities` require
`Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | |
| POST | `/auth/login` | Individual login |
| POST | `/auth/device/start-shift` | Shared device broad session |
| POST | `/auth/device/verify-pin` | Per-action attribution token (5 min) |
| POST | `/facilities` | Bootstrap-secret gated |
| GET | `/facilities/me` | |
| GET | `/facilities/directory` | Cross-tenant, id/name/type only |
| POST | `/wards` / GET | |
| POST | `/patients` / GET / GET `:id` / PATCH `:id` | Create/update need individual auth |
| POST | `/handoffs` | |
| GET | `/handoffs?patientId=` | |
| GET | `/handoffs/open?patientId=` | Current open handoff, or `null` |
| GET | `/handoffs/:id` | Handoff + full notes feed + acknowledgments |
| POST | `/handoffs/:id/notes` | |
| POST | `/handoffs/:id/acknowledge` | |
| POST | `/sync/push` | Batch of `FieldOp`s — the core conflict-detection path |
| GET | `/sync/pull?patientIds=` | Current structured-field state |
| GET | `/conflicts` | Open + escalated, oldest first |
| GET | `/conflicts/:id` | Includes the actual competing `FieldOp` values |
| PATCH | `/conflicts/:id/resolve` | |
| POST | `/conflicts/sweep-now` | Manual trigger, optional `?thresholdMinutes=` override |
| POST | `/referrals` | |
| GET | `/referrals/outgoing` / `/referrals/incoming` | |
| POST | `/referrals/:id/claim` | Always creates a new `Patient` |
| POST | `/attachments` / POST `:id/upload` / GET `:id` / GET `?patientId=` / GET `:id/file` | |
| GET | `/notifications` / PATCH `:id/read` | |

## Mobile app structure

- **`src/api/`** — one file per resource, thin typed wrappers around a
  shared `ApiClient` (`src/api/client.ts`), which handles bearer-token
  attachment, JSON parsing, and typed `ApiError`s. Storage is injected via
  a `TokenStore` interface — `SecureTokenStore` (expo-secure-store, real
  app) or `MemoryTokenStore` (testing).
- **`src/offline/`** — the offline-first layer:
  - `opQueue.ts` — the `OpQueueStorage` interface
  - `sqliteOpQueue.ts` — the real, persisted implementation
  - `memoryOpQueue.ts` — in-memory, for verification only
  - `syncEngine.ts` — `flushQueue()`, the core drain logic
  - `cache.ts` / `db.ts` — local read cache backed by the same SQLite db
- **`src/hlc/hlc.ts`** — generates real client-side HLCs: a stable
  per-installation device ID plus a monotonic counter, both persisted so
  they survive app restarts.
- **`src/components/SyncStatusPill.tsx`** — queued count / syncing /
  offline / all-synced, tappable to force a flush; auto-flushes on
  reconnect via `useNetworkStatus`.
- **`src/screens/`** — Login, Dashboard, PatientDetail (structured
  fields, notes, handoff, attachments, referral entry point), Conflict
  list/detail, Referral list/send.

## Getting started

### Backend

```bash
cd apps/api
cp .env.example .env      # fill in real values, especially JWT_SECRET and BOOTSTRAP_SECRET
npm install
npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts
npm run start:dev

Requires a local Postgres instance. The runtime connects as wardlink_app
(created by the second migration); migrations themselves run as the admin
role set via ADMIN_DB_USERNAME/ADMIN_DB_PASSWORD.
Mobile

cd apps/mobile
npm install
npx expo start

Set EXPO_PUBLIC_API_URL if the API isn't reachable at localhost:3000
from wherever the app is running (a physical device generally needs your
machine's LAN IP, unless both the app and API are on the same device via
Expo Go + a proot-style dev environment, in which case localhost often
just works).
Install Expo Go on the test device, then open the exp:// URL printed
by expo start (manual entry is more reliable than scanning a QR code
from inside a terminal app). For an actual installable app rather than an
Expo Go session: npx eas build --platform android --profile preview.
First-time setup (creating your first facility)

curl -X POST http://localhost:3000/facilities \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Secret: <your BOOTSTRAP_SECRET>" \
  -d '{"name":"Your Hospital","type":"hospital","ndprComplianceContact":"someone@example.com"}'

  Then seed at least one user directly in the database (no signup endpoint
exists yet — see limitations) with a bcryptjs-hashed password before
logging in from the app.
How this was verified during development
Every backend module was verified against a real running Postgres +
NestJS instance during development, not just written and assumed
correct — including deliberately adversarial cases: a facility trying to
claim its own referral (must be rejected), an origin facility's insert
policy under RETURNING, a bare shared-device session attempting a write
it shouldn't be allowed to make, and the exact stale-write scenario the
whole conflict-detection system exists to catch. Several real bugs were
caught this way rather than left latent — including a case where
repo.save() silently "succeeded" on an RLS-blocked update because
TypeORM doesn't check affected-row counts, and a queryRunner.query()
tuple-shape mismatch that produced undefined fields instead of an error.
The mobile client's networking/auth/queue logic was verified the same way
wherever it doesn't require an actual RN runtime — direct requests against
the live API, plus a response-simulating fake client for the sync engine's
branching logic (ordering, conflict-still-counts-as-synced, reject-then-
continue, network-down-stops-the-flush). Screen rendering itself, and
anything requiring a native module (SQLite, SecureStore, ImagePicker,
NetInfo), was never executed in the development environment — no RN
simulator was available. What's proven is everything underneath the UI:
the actual request/response and data-integrity logic those screens depend
on.
Known limitations / honest gaps
POST /facilities is gated by a shared secret, not real admin auth.
Fine for local dev; before any real deployment this needs a proper
internal onboarding path, not a public endpoint.
Attachments use local disk storage, not S3 + per-facility KMS
encryption as the original architecture calls for. The two-step
initiate/upload flow and lifecycle are kept the same shape either way,
so swapping the backend later is a service-level change, not a
client-facing one.
No signup/admin UI for creating users — done via direct SQL insert
during development. A real onboarding flow is a natural next piece.
Ward selection in the mobile app defaults to the facility's first
ward rather than offering a real picker — fine for a single-ward test
setup, not a real multi-ward hospital.
A shared device's cached PIN hash has no enforced offline validity
window. A staff member whose access was just revoked could still
authenticate on a device that hasn't synced the revocation yet. Noted
as a deliberate v1 tradeoff, not an oversight.
POST /conflicts/sweep-now has no role restriction yet — any
authenticated user can trigger it. Should be limited to
ward_head/director once a role-checking guard exists.
No load testing performed — RLS overhead under concurrent
multi-tenant load, and sync-service behavior under a realistic
shift-change spike, are both unverified.
infra/terraform/ is a placeholder. Multi-tenancy is deliberately
designed (RLS + strict facility_id scoping everywhere) so that a
future move to per-facility backend deployments would be a scaling
decision, not a rewrite — but that migration itself hasn't been built.
No CI beyond a placeholder GitHub Actions workflow — no automated
test suite runs on push yet.

##License
MIT — see LICENSE.
That's the whole thing — architecture, every migration and why each `SECURITY DEFINER` exception exists, the full API surface, the mobile structure, setup steps, what was actually verified versus what wasn't, and an honest limitations section rather than glossing over the gaps. Just replace `README.md` in full with the content above.