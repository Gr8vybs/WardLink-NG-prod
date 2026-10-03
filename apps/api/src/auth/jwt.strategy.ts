import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import type { AuthTokenPayload } from "@wardlink/shared";

/** Accepts a token from EITHER the Authorization header (mobile) OR a
 * cookie (web). Mobile keeps working exactly as before; the web app
 * never sends an Authorization header, relying entirely on the
 * httpOnly cookie the browser attaches automatically. */
function cookieExtractor(req: Request): string | null {
  return (req as any)?.cookies?.wardlink_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "dev-secret-change-me",
    });
  }

  async validate(payload: AuthTokenPayload): Promise<AuthTokenPayload> {
    return payload;
  }
}