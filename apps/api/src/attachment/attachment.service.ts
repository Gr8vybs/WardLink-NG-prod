import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Attachment } from "../entities/attachment.entity";
import { InitiateAttachmentDto } from "./dto/initiate-attachment.dto";
import { withFacilityContext } from "../common/tenant-context";

/**
 * KNOWN GAP, DOCUMENTED ON PURPOSE:
 *
 * The architecture calls for S3-compatible object storage with a
 * per-facility KMS encryption key, and chunked/resumable upload decoupled
 * from the main sync path. This implementation uses local disk storage
 * instead — no AWS/S3 credentials are available in this environment, and
 * a phone-only dev setup can't easily stand up real cloud storage either.
 *
 * What changes for a real deployment:
 *  - fileRef becomes an S3 object key, not a local path
 *  - Upload goes through a presigned PUT URL the client uploads directly
 *    to (this service would only issue the URL, not receive the bytes)
 *  - Encryption happens via a facility-specific KMS key rather than
 *    whatever the underlying disk/filesystem provides
 *  - "Chunked/resumable" needs real multipart upload support, which S3
 *    provides natively and a single local file write does not
 *
 * The two-step initiate/upload flow and the Attachment lifecycle
 * (queued -> uploading -> synced) are deliberately kept the same shape
 * either way, so swapping the storage backend later is a service-level
 * change, not a client-facing one.
 */
@Injectable()
export class AttachmentService {
  constructor(private readonly dataSource: DataSource) {}

  async initiate(facilityId: string, uploadedBy: string, dto: InitiateAttachmentDto) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Attachment).save({
        patientId: dto.patientId,
        uploadedBy,
        hlc: dto.hlc,
        mimeType: dto.mimeType,
        uploadStatus: "queued",
        fileRef: null,
        facilityId,
      }),
    );
  }

  async markUploaded(facilityId: string, id: string, fileRef: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const repo = qr.manager.getRepository(Attachment);
      const attachment = await repo.findOne({ where: { id } });
      if (!attachment) throw new NotFoundException("Attachment not found");
      attachment.fileRef = fileRef;
      attachment.uploadStatus = "synced";
      return repo.save(attachment);
    });
  }

  async getOne(facilityId: string, id: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const attachment = await qr.manager.getRepository(Attachment).findOne({ where: { id } });
      if (!attachment) throw new NotFoundException("Attachment not found");
      return attachment;
    });
  }

  async listForPatient(facilityId: string, patientId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Attachment).find({ where: { patientId } }),
    );
  }
}