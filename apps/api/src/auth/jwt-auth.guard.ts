import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Requires any valid, signed JWT — individual, shared_device (broad), or
 * shared_device_pin_verified. Use RequireIndividualAuthGuard on top of
 * this for endpoints that write clinical data and need real attribution. */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}