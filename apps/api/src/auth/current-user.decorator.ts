import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthTokenPayload } from "@wardlink/shared";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthTokenPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);