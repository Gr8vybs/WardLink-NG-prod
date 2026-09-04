import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { StartDeviceSessionDto } from "./dto/start-device-session.dto";
import { VerifyPinDto } from "./dto/verify-pin.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.staffId, dto.password);
  }

  @Post("device/start-shift")
  startDeviceSession(@Body() dto: StartDeviceSessionDto) {
    return this.authService.startDeviceSession(dto.deviceId);
  }

  // Requires an existing (broad) device-session token — the caller must
  // already be "on" a registered device before they can PIN-verify as a
  // specific staff member on it.
  @UseGuards(JwtAuthGuard)
  @Post("device/verify-pin")
  verifyPin(@CurrentUser() user: AuthTokenPayload, @Body() dto: VerifyPinDto) {
    if (!user.deviceId) {
      throw new Error("No device session on this token");
    }
    return this.authService.verifyPin(user.facilityId, user.deviceId, dto.staffId, dto.pin);
  }
}