import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@jalajogja/db";
import { sendPlatformMail } from "./mail";

const extraOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: extraOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
    usePlural: false,
  }),
  emailAndPassword: {
    enabled: true,
    // Fallback platform (SMTP env var, satu akun untuk semua tenant) — dipakai saat
    // WhatsApp Gateway tenant tidak tersedia/dibatasi. Lihat lib/mail.ts.
    sendResetPassword: async ({ user: u, url }) => {
      const result = await sendPlatformMail({
        to:      u.email,
        subject: "Reset Password",
        html: `
          <p>Halo${u.name ? ` ${u.name}` : ""},</p>
          <p>Kami menerima permintaan reset password untuk akun Anda. Klik tautan berikut
          untuk membuat password baru (berlaku 1 jam):</p>
          <p><a href="${url}">${url}</a></p>
          <p>Kalau Anda tidak meminta ini, abaikan saja email ini.</p>
        `,
      });
      if (!result.ok) {
        console.error("[auth] sendResetPassword gagal:", result.error);
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
});

export type Auth = typeof auth;
