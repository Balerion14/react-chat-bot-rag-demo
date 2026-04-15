import { defineConfig } from "drizzle-kit";

const runtime = globalThis as typeof globalThis & {
  Bun?: { env?: Record<string, string | undefined> };
  process?: { env?: Record<string, string | undefined> };
};

const url =
  runtime.Bun?.env?.DATABASE_URL ??
  runtime.process?.env?.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  strict: true,
  verbose: true,
});
