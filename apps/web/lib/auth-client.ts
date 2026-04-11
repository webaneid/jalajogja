import { createAuthClient } from "better-auth/client";

// Tanpa baseURL — otomatis pakai window.location.origin
// Ini berarti selalu benar, tidak peduli port berubah saat dev
export const { signIn, signUp, signOut, useSession } = createAuthClient();
