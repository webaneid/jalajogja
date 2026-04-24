import { createAuthClient } from "better-auth/react";

// React-aware auth client — useSession() tersedia sebagai React hook
// Import dari "better-auth/react" agar atom di-wrap sebagai hook via useStore
export const authClient = createAuthClient();
export const { signIn, signUp, signOut } = authClient;
