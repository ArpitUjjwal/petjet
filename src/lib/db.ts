import "server-only";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

/*
 * One Prisma client per server process. In development the client is kept on
 * globalThis so hot reloads don't open a new connection on every edit. It is tagged
 * with the schema's model list, so after a schema change (new table) a stale client
 * from before the change is replaced instead of failing with "undefined" models.
 */
const schemaTag = Object.keys(Prisma.ModelName).sort().join(",");

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaTag?: string;
};

/*
 * On Vercel the deployed files are read-only, so the database seeded during the build
 * (prisma/demo.db, see "vercel-build" in package.json) is copied to /tmp, the only
 * writable folder. Each server instance gets its own copy, and it resets when the
 * instance is recycled: fine for a demo, not for real data.
 */
function vercelDatabaseUrl(): string | undefined {
  if (!process.env.VERCEL) return undefined;
  const target = "/tmp/petjet.db";
  if (!existsSync(target)) {
    copyFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "prisma", "demo.db"), target);
  }
  return `file:${target}`;
}

function createClient() {
  const url = vercelDatabaseUrl();
  const client = url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    void globalForPrisma.prisma?.$disconnect().catch(() => {});
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaTag = schemaTag;
  }
  return client;
}

const client: PrismaClient =
  globalForPrisma.prisma && globalForPrisma.prismaSchemaTag === schemaTag
    ? globalForPrisma.prisma
    : createClient();

/**
 * Development only: model names in prisma/schema.prisma on disk. A running dev server keeps
 * the database client it started with, so a table added later is missing from it.
 */
function modelsOnDisk(): Set<string> {
  try {
    const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    return new Set([...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1][0].toLowerCase() + m[1].slice(1)));
  } catch {
    return new Set();
  }
}

function withStaleClientHint(c: PrismaClient): PrismaClient {
  if (process.env.NODE_ENV === "production") return c;
  return new Proxy(c, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value === undefined && typeof prop === "string" && modelsOnDisk().has(prop)) {
        throw new Error(
          `The database table "${prop}" was added after this dev server started. ` +
            "Stop the dev server (Ctrl+C in its terminal) and run `npm run dev` again.",
        );
      }
      return value;
    },
  });
}

export const db: PrismaClient = withStaleClientHint(client);
