# Ward Link NG

Offline-first clinical patient handoff app for Nigerian hospitals — shift-to-shift
handoffs within a ward, and inter-facility referrals.

## Structure

- `apps/mobile` — Expo (React Native) client, TypeScript
- `apps/api` — NestJS backend, TypeScript
- `packages/shared` — TypeScript types shared by both apps
- `infra/terraform` — infrastructure-as-code (empty for now)

## Getting started

```bash
npm install

# 1. Create a Postgres database and copy the env file
createdb wardlink_ng
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env with your real ADMIN_DB_* creds if not using local defaults

# 2. Run migrations (uses the ADMIN_DB_* credentials — creates tables,
#    RLS policies, and the restricted wardlink_app runtime role)
cd apps/api
npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts

# 3. (optional) verify tenant isolation actually holds, end-to-end,
#    through TypeORM using the restricted role:
npx ts-node -T src/verify-rls.ts

# 4. Run the API — connects as the restricted wardlink_app role, NOT postgres
npm run start:dev

# mobile app (needs Expo Go app on your phone, or an emulator)
npm run dev:mobile
```

### Two Postgres roles — don't mix these up

- **Admin role** (`ADMIN_DB_*`, e.g. `postgres`) — used only by the
  migration CLI. Needs elevated privileges to create tables/roles/policies.
- **Runtime role** (`DB_*`, `wardlink_app`) — used by the running API.
  Deliberately `NOSUPERUSER NOBYPASSRLS`. Postgres superusers (and table
  owners, unless `FORCE ROW LEVEL SECURITY` is set — which it is here)
  bypass Row-Level Security entirely. If the app ever connected as
  `postgres`, tenant isolation would silently stop being enforced even
  though the policies still exist.

Every read/write against an RLS-protected table (`patients`, `handoffs`,
`structured_fields`, `field_ops`) must go through
`withFacilityContext()` in `apps/api/src/common/tenant-context.ts`, which
sets the tenant scope with `SET LOCAL` inside a per-request transaction —
safe for a connection pool, unlike a bare `SET`. A query on that connection
made outside this wrapper will hard-error rather than silently returning
rows from every facility — verified in `src/verify-rls.ts`.

## Architecture notes

- **Offline-first sync**: every write on a device becomes an append-only
  `FieldOp` entry with a Hybrid Logical Clock (HLC). Conflict detection only
  happens server-side, in the Sync/Merge module.
- **Conflicts** are non-blocking by default (flagged, visible, work
  continues) but escalate to the ward head if left unresolved past a
  configurable threshold, and are surfaced again at the next shift boundary
  if still open.
- **Multi-tenancy**: one shared Postgres database, isolated per facility via
  Row-Level Security (`facility_id`), not by application-level filtering
  alone.
- **Referrals** are frozen snapshots, not live merges — a receiving facility
  always creates a new local Patient record and reconciles manually if the
  patient already exists there.

See `packages/shared/src/index.ts` for the full data model.
