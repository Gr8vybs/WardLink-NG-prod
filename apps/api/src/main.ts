import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Explicit origin + credentials:true is required for cookie-based auth
  // to work at all — a wildcard origin is rejected by browsers the
  // moment credentials are involved, and it would be a real security
  // hole here even if browsers allowed it.
  app.enableCors({
    origin: process.env.WEB_APP_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Ward Link NG API running on port ${port}`);
}
bootstrap();