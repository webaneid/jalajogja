import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@jalajogja/db";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    // Tabel auth yang kita definisikan di packages/db/src/schema/public/auth.ts
    schema: {
      user,
      session,
      account,
      verification,
    },
    usePlural: false, // tabel: "user", "session", "account", "verification"
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari dalam detik
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
});

export type Auth = typeof auth;
