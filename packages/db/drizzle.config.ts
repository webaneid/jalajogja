import type { Config } from "drizzle-kit";

export default {
  // Hanya public schema — tenant schema dikelola via createTenantSchemaInDb()
  schema: "./src/schema/public/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Eksplisit batasi ke public schema saja
  // Mencegah drizzle-kit introspect tenant_* schemas yang ada di DB
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
} satisfies Config;
