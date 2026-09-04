import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Ward } from "../entities/ward.entity";
import { CreateWardDto } from "./dto/create-ward.dto";
import { withFacilityContext } from "../common/tenant-context";

@Injectable()
export class WardService {
  constructor(private readonly dataSource: DataSource) {}

  async create(facilityId: string, dto: CreateWardDto) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Ward).save({
        facilityId,
        name: dto.name,
        acuityLevel: dto.acuityLevel ?? "standard",
      }),
    );
  }

  async list(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Ward).find(),
    );
  }
}