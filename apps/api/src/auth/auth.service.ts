import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import type { AuthTokenPayload } from "@wardlink/shared";
import { User } from "../entities/user.entity";
import { withFacilityContext } from "../common/tenant-context";

interface LoginRow {
  id: string;
  facility_id: string;
  role: string;
  password_hash: string;
  active: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  /** Individual login on a personal device. Runs BEFORE we know the
   * caller's facility, so it goes through the narrow SECURITY DEFINER
   * lookup function (see the users/devices migration) rather than the
   * normal RLS-scoped path — that function returns only the columns
   * login needs, nothing else. */
  async login(staffId: string, password: string) {
    const rows: LoginRow[] = await this.dataSource.query(
      `SELECT * FROM lookup_user_for_login($1)`,
      [staffId],
    );
    const row = rows[0];
    if (!row || !row.active) {
      throw new UnauthorizedException("Invalid staff ID or password");
    }
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      throw new UnauthorizedException("Invalid staff ID or password");
    }

    const payload: AuthTokenPayload = {
      sub: row.id,
      facilityId: row.facility_id,
      role: row.role as AuthTokenPayload["role"],
      authType: "individual",
      deviceId: null,
    };
    return { accessToken: this.jwt.sign(payload) };
  }

  /** Starts a broad session on a shared ward device. This token alone is
   * NOT enough to attribute a write action to a specific person — it has
   * no `sub`. Endpoints that write clinical data must require
   * authType === "individual" or "shared_device_pin_verified". */
  async startDeviceSession(deviceId: string) {
    // Device lookup also happens pre-facility-context, same reasoning as
    // login — the device row is how we discover the facility at all. Goes
    // through the same kind of narrow SECURITY DEFINER function.
    const rows: Array<{ id: string; facilityId: string; wardId: string; deviceType: string }> =
      await this.dataSource.query(
        `SELECT id, facility_id AS "facilityId", ward_id AS "wardId", device_type AS "deviceType"
         FROM lookup_device_for_session($1)`,
        [deviceId],
      );
    const device = rows[0];
    if (!device) {
      throw new NotFoundException("Device not registered");
    }

    const payload: AuthTokenPayload = {
      sub: null,
      facilityId: device.facilityId,
      role: null,
      authType: "shared_device",
      deviceId: device.id,
    };
    return { accessToken: this.jwt.sign(payload) };
  }

  /** Per-action PIN re-auth on a shared device. Takes the broad device
   * session's facilityId (passed in from the guard/controller, already
   * verified) plus a staffId + PIN, and — if they match — issues a
   * short-lived token attributing the next write to that specific
   * person. This token is meant to be used once, immediately, for the
   * single save action that triggered the PIN prompt. */
  async verifyPin(facilityId: string, deviceId: string, staffId: string, pin: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const user = await qr.manager.getRepository(User).findOne({ where: { staffId } });
      if (!user || !user.active || !user.pinHash) {
        throw new UnauthorizedException("Invalid staff ID or PIN");
      }
      const valid = await bcrypt.compare(pin, user.pinHash);
      if (!valid) {
        throw new UnauthorizedException("Invalid staff ID or PIN");
      }

      const payload: AuthTokenPayload = {
        sub: user.id,
        facilityId,
        role: user.role as AuthTokenPayload["role"],
        authType: "shared_device_pin_verified",
        deviceId,
      };
      // Short-lived on purpose — this proves "it was you, right now",
      // not a standing session.
      return { accessToken: this.jwt.sign(payload, { expiresIn: "5m" }) };
    });
  }
}