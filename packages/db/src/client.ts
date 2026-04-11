import { drizzle } from "drizzle-orm/postgres-js";
import { postgresClient } from "./postgres-client";
import * as publicSchema from "./schema/public";

// db instance untuk public schema (tenants, auth tables)
// Untuk tenant schema, gunakan createTenantDb(slug) dari tenant-client.ts
export const db = drizzle(postgresClient, { schema: publicSchema });

export type PublicDb = typeof db;
