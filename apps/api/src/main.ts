import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";
import { PROJECT_ROOT, ensureDataDirs } from "./common/paths";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${join(PROJECT_ROOT, "data", "app.db")}`;
}

async function bootstrap() {
  ensureDataDirs();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: ["http://127.0.0.1:3000", "http://localhost:3000"] });
  await app.listen(3001, "127.0.0.1");
  console.log("Nest API listening on http://127.0.0.1:3001");
}

bootstrap();
