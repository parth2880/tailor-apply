import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";
import { PROJECT_ROOT, defaultDatabaseUrl, ensureDataDirs } from "./common/paths";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });
process.env.DATABASE_URL = defaultDatabaseUrl();

function corsOrigins(): string | string[] | boolean {
  const raw = process.env.CORS_ORIGIN || process.env.WEB_ORIGIN;
  if (!raw || raw.trim() === "*") return true;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) {
    return ["http://127.0.0.1:3000", "http://localhost:3000"];
  }
  return list;
}

async function bootstrap() {
  ensureDataDirs();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: corsOrigins() });

  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  // 0.0.0.0 so containers / PaaS can reach the process; override with HOST=127.0.0.1 for local-only.
  const host = process.env.HOST || process.env.API_HOST || "0.0.0.0";
  await app.listen(port, host);
  console.log(`Nest API listening on http://${host}:${port}`);
}

bootstrap();
