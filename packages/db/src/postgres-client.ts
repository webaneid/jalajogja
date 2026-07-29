import postgres from "postgres";

// Singleton postgres connection pool pada globalThis agar di Next.js dev (HMR / Hot Reload)
// tidak membuat connection pool baru setiap kali module direload oleh Turbopack/Next.
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

export const postgresClient =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    max: 10, // pool size limit
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = postgresClient;
}
