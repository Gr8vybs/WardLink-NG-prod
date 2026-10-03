import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { StartDeviceSessionDto } from "./dto/start-device-session.dto";
import { VerifyPinDto } from "./dto/verify-pin.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthTokenPayload } from "@wardlink/shared";

const COOKIE_NAME = "wardlink_token";

// Shared so set/clear always use IDENTICAL options — a mismatch (e.g.
// different `path`) means clearCookie silently fails to remove it.
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // false on plain http for local dev
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.staffId, dto.password);
    res.cookie(COOKIE_NAME, result.accessToken, cookieOptions(12 * 60 * 60 * 1000));
    // Still returned in the body too — mobile never reads this cookie,
    // it stores the token itself via SecureStore as before.
    return result;
  }

  @Post("device/start-shift")
  async startDeviceSession(@Body() dto: StartDeviceSessionDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.startDeviceSession(dto.deviceId);
    res.cookie(COOKIE_NAME, result.accessToken, cookieOptions(12 * 60 * 60 * 1000));
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post("device/verify-pin")
  async verifyPin(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: VerifyPinDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!user.deviceId) {
      throw new Error("No device session on this token");
    }
    const result = await this.authService.verifyPin(user.facilityId, user.deviceId, dto.staffId, dto.pin);
    // Short-lived (5 min) — the cookie's maxAge matches, so the browser
    // naturally drops it at the same time the token itself expires.
    res.cookie(COOKIE_NAME, result.accessToken, cookieOptions(5 * 60 * 1000));
    return result;
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, cookieOptions(0));
    return { ok: true };
  }

  /** What the web app calls instead of decoding the token client-side —
   * an httpOnly cookie means the browser's JS literally cannot read the
   * token's contents, so the server hands back the claims directly. */
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthTokenPayload) {
    return user;
  }
}