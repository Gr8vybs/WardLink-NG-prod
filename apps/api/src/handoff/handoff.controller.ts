import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { HandoffService } from "./handoff.service";
import { CreateHandoffDto } from "./dto/create-handoff.dto";
import { AddNoteDto } from "./dto/add-note.dto";
import { AcknowledgeDto } from "./dto/acknowledge.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireIndividualAuthGuard } from "../auth/require-individual-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("handoffs")
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  // Creating a handoff is attributed to the outgoing nurse/doctor.
  @UseGuards(RequireIndividualAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreateHandoffDto) {
    return this.handoffService.create(user.facilityId, user.sub as string, dto);
  }

  @Get()
  listForPatient(@CurrentUser() user: AuthTokenPayload, @Query("patientId") patientId: string) {
    return this.handoffService.listForPatient(user.facilityId, patientId);
  }

  // NOTE: this static route MUST be declared before the ":id" route
  // below — Nest/Express match routes in declaration order, and a
  // dynamic ":id" segment declared first would otherwise swallow
  // "/handoffs/open" by matching id="open".
  @Get("open")
  findOpenForPatient(@CurrentUser() user: AuthTokenPayload, @Query("patientId") patientId: string) {
    return this.handoffService.findOpenForPatient(user.facilityId, patientId);
  }

  @Get(":id")
  getDetail(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string) {
    return this.handoffService.getDetail(user.facilityId, id);
  }

  // Notes are attributed to whoever wrote them.
  @UseGuards(RequireIndividualAuthGuard)
  @Post(":id/notes")
  addNote(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string, @Body() dto: AddNoteDto) {
    return this.handoffService.addNote(user.facilityId, id, user.sub as string, dto);
  }

  // Acknowledging is attributed to the incoming nurse/doctor.
  @UseGuards(RequireIndividualAuthGuard)
  @Post(":id/acknowledge")
  acknowledge(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string, @Body() dto: AcknowledgeDto) {
    return this.handoffService.acknowledge(user.facilityId, id, user.sub as string, dto);
  }
}