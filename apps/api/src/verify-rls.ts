import "reflect-metadata";
import { DataSource } from "typeorm";
import { withFacilityContext } from "./common/tenant-context";
import { Patient } from "./entities/patient.entity";

async function main() {
  // Connect as the RESTRICTED runtime role, not postgres — this is the
  // whole point of the test: prove isolation holds for the role the API
  // will actually use in production.
  const ds = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "wardlink_app",
    password: "app_password_change_me",
    database: "wardlink_ng",
    entities: [Patient],
  });
  await ds.initialize();

  const facilityA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const facilityB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const resultA = await withFacilityContext(ds, facilityA, async (qr) => {
    return qr.manager.getRepository(Patient).find();
  });
  console.log(
    "Facility A sees:",
    resultA.map((p) => p.demographics),
  );

  const resultB = await withFacilityContext(ds, facilityB, async (qr) => {
    return qr.manager.getRepository(Patient).find();
  });
  console.log(
    "Facility B sees:",
    resultB.map((p) => p.demographics),
  );

  const pass = resultA.length === 1 && resultB.length === 1 && resultA[0].demographics.name !== resultB[0].demographics.name;
  console.log(pass ? "\n✅ PASS — tenant isolation holds through TypeORM + the restricted role" : "\n❌ FAIL");

  await ds.destroy();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script errored:", err.message);
  process.exit(1);
});
