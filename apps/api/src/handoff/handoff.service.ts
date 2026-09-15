import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Handoff } from "../entities/handoff.entity";
import { Note } from "../entities/note.entity";
import { Acknowledgment } from "../entities/acknowledgment.entity";
import { CreateHandoffDto } from "./dto/create-handoff.dto";
import { AddNoteDto } from "./dto/add-note.dto";
import { AcknowledgeDto } from "./dto/acknowledge.dto";
import { withFacilityContext } from "../common/tenant-context";

@Injectable()
export class HandoffService {
  constructor(private readonly dataSource: DataSource) {}

  /** The open handoff for a patient, if one exists — this is what a
   * client checks before deciding whether to open an existing handoff
   * or create a new one for the current shift. Deliberately returns
   * null rather than throwing when there isn't one; "no open handoff
   * yet" is a normal state, not an error. */
  async findOpenForPatient(facilityId: string, patientId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Handoff).findOne({
        where: { patientId, status: "open" },
      }),
    );
  }

  async listForPatient(facilityId: string, patientId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Handoff).find({ where: { patientId } }),
    );
  }

  async create(facilityId: string, authorId: string, dto: CreateHandoffDto) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Handoff).save({
        patientId: dto.patientId,
        wardId: dto.wardId,
        authorId,
        deviceId: dto.hlc.deviceId,
        shiftPeriod: dto.shiftPeriod,
        status: "open",
        hlc: dto.hlc,
        facilityId,
      }),
    );
  }

  /** Handoff plus the patient's running notes feed — notes are patient-
   * scoped, not handoff-scoped, so this spans shifts (matches the
   * mockup's continuous notes feed). */
  async getDetail(facilityId: string, handoffId: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const handoff = await qr.manager.getRepository(Handoff).findOne({ where: { id: handoffId } });
      if (!handoff) throw new NotFoundException("Handoff not found");

      const notes = await qr.manager.getRepository(Note).find({
        where: { patientId: handoff.patientId },
        order: { createdAt: "ASC" },
      });

      const acknowledgments = await qr.manager.getRepository(Acknowledgment).find({
        where: { handoffId },
        order: { createdAt: "ASC" },
      });

      return { handoff, notes, acknowledgments };
    });
  }

  async addNote(facilityId: string, handoffId: string, authorId: string, dto: AddNoteDto) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const handoff = await qr.manager.getRepository(Handoff).findOne({ where: { id: handoffId } });
      if (!handoff) throw new NotFoundException("Handoff not found");

      return qr.manager.getRepository(Note).save({
        patientId: handoff.patientId,
        authorId,
        hlc: dto.hlc,
        text: dto.text,
        facilityId,
      });
    });
  }

  /** Acknowledging is the incoming nurse's attributed confirmation that
   * they received this handoff. It's a distinct, append-only record —
   * not just a status flip — because who received what and when matters
   * for audit and liability, same reasoning as everywhere else append-
   * only records are used in this app. */
  async acknowledge(facilityId: string, handoffId: string, acknowledgedBy: string, dto: AcknowledgeDto) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const handoffRepo = qr.manager.getRepository(Handoff);
      const handoff = await handoffRepo.findOne({ where: { id: handoffId } });
      if (!handoff) throw new NotFoundException("Handoff not found");
      if (handoff.status === "acknowledged") {
        throw new BadRequestException("This handoff has already been acknowledged");
      }

      const acknowledgment = await qr.manager.getRepository(Acknowledgment).save({
        handoffId,
        acknowledgedBy,
        hlc: dto.hlc,
        facilityId,
      });

      handoff.status = "acknowledged";
      await handoffRepo.save(handoff);

      return { handoff, acknowledgment };
    });
  }
}