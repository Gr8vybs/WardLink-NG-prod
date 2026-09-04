import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CreateFacilityDto } from "./dto/create-facility.dto";
import { withFacilityContext } from "../common/tenant-context";
import { Facility } from "../entities/facility.entity";

@Injectable()
export class FacilityService {
  constructor(private readonly dataSource: DataSource) {}

  /** Bootstrap-only: creating a facility is how a tenant starts to exist,
   * so it happens before any facility context can be set. Goes through
   * create_facility(), a narrow SECURITY DEFINER function — see the
   * migration for why a plain INSERT (even with a permissive policy)
   * isn't enough on its own. */
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
}