import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CreateFacilityDto } from "./dto/create-facility.dto";
import { withFacilityContext } from "../common/tenant-context";
import { Facility } from "../entities/facility.entity";

@Injectable()
export class FacilityService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateFacilityDto) {
    const rows = await this.dataSource.query(
      `SELECT * FROM create_facility($1, $2, $3)`,
      [dto.name, dto.type, dto.ndprComplianceContact],
    );
    return rows[0];
  }

  async getMine(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Facility).findOneOrFail({ where: { id: facilityId } }),
    );
  }

  /** For referral destination selection — every OTHER facility's basic
   * directory info, not gated by the caller's own facility context
   * since that's the whole point. See the migration for why this is a
   * deliberate, narrow exception rather than a general facilities list. */
  async listDirectory(): Promise<Array<{ id: string; name: string; type: string }>> {
    return this.dataSource.query(`SELECT * FROM list_facility_directory()`);
  }
}