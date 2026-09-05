import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DB_PATH, ensureDataDirs } from "../common/paths";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    ensureDataDirs();
    const url = process.env.DATABASE_URL || `file:${DB_PATH}`;
    super({ datasources: { db: { url } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
