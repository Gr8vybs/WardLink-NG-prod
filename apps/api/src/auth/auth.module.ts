import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RequireIndividualAuthGuard } from "./require-individual-auth.guard";

/**
 * AuthModule
 * Individual login (JWT, facility-scoped claims) + shared-device sessions
 * with per-action PIN re-auth.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? "12h" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RequireIndividualAuthGuard],
  exports: [JwtAuthGuard, RequireIndividualAuthGuard, JwtModule],
})
export class AuthModule {}