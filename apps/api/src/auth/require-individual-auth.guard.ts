import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthTokenPayload } from "@wardlink/shared";

/**
 * Run AFTER JwtAuthGuard on any endpoint that writes clinical data
 * (a handoff field, a note, a conflict resolution, an acknowledgment).
 *
 * A bare "shared_device" token (broad session, `sub` is null) is not
 * enough here — it can't be attributed to a specific person. Only
 * "individual" (personal device login) or "shared_device_pin_verified"
 * (just-confirmed via PIN) are accepted. This is what actually enforces
 * the per-action PIN re-auth design at the framework level, rather than
 * relying on every service method to remember to check it.
 */
@Injectable()
export class RequireIndividualAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthTokenPayload | undefined;

    if (!user || !user.sub || user.authType === "shared_device") {
      throw new ForbiddenException(
        "This action must be attributed to a specific person. Re-authenticate with your PIN.",
      );
    }
    return true;
  }
}