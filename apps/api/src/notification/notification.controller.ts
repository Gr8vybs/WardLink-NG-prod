import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  listUnread(@CurrentUser() user: AuthTokenPayload) {
    return this.notificationService.listUnread(user.facilityId, user.sub as string);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthTokenPayload, @Param("id") id: string) {
    return this.notificationService.markRead(user.facilityId, id);
  }
}