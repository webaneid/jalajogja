import { redirect } from "next/navigation";

// Admin login dipindah ke /app/login (Fase 1 URL refactoring)
export default function LoginRedirectPage() {
  redirect("/app/login");
}
