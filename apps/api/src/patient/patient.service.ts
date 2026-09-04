import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Patient } from "../entities/patient.entity";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { withFacilityContext } from "../common/tenant-context";

@Injectable()
export class PatientService {
  constructor(private readonly dataSource: DataSource) {}

  async create(facilityId: string, createdBy: string, dto: CreatePatientDto) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Patient).save({
        demographics: { name: dto.name, age: dto.age, sex: dto.sex, allergies: dto.allergies },
        facilityOfOriginId: facilityId,
        currentFacilityId: facilityId,
        createdBy,
      }),
    );
  }

  async list(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Patient).find(),
    );
  }

  async findOne(facilityId: string, id: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const patient = await qr.manager.getRepository(Patient).findOne({ where: { id } });
      if (!patient) throw new NotFoundException("Patient not found");
      return patient;
    });
  }

  async update(facilityId: string, id: string, dto: UpdatePatientDto) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const repo = qr.manager.getRepository(Patient);
      const patient = await repo.findOne({ where: { id } });
      if (!patient) throw new NotFoundException("Patient not found");
      patient.demographics = { ...patient.demographics, ...dto };
      return repo.save(patient);
    });
  }
}