import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import type { Response } from "express";
import { AttachmentService } from "./attachment.service";
import { InitiateAttachmentDto } from "./dto/initiate-attachment.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireIndividualAuthGuard } from "../auth/require-individual-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

const UPLOAD_DIR = join(__dirname, "..", "..", "uploads");

@UseGuards(JwtAuthGuard)
@Controller("attachments")
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @UseGuards(RequireIndividualAuthGuard)
  @Post()
  initiate(@CurrentUser() user: AuthTokenPayload, @Body() dto: InitiateAttachmentDto) {
    return this.attachmentService.initiate(user.facilityId, user.sub as string, dto);
  }

  @UseGuards(RequireIndividualAuthGuard)
  @Post(":id/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthTokenPayload,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new NotFoundException("No file provided");
    return this.attachmentService.markUploaded(user.facilityId, id, file.filename);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string) {
    return this.attachmentService.getOne(user.facilityId, id);
  }

  @Get()
  listForPatient(@CurrentUser() user: AuthTokenPayload, @Query("patientId") patientId: string) {
    return this.attachmentService.listForPatient(user.facilityId, patientId);
  }

  @Get(":id/file")
  async getFile(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string, @Res() res: Response) {
    const attachment = await this.attachmentService.getOne(user.facilityId, id);
    if (!attachment.fileRef) throw new NotFoundException("File not yet uploaded");
    res.sendFile(join(UPLOAD_DIR, attachment.fileRef));
  }
}