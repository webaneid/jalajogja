// @ts-nocheck — alat dev jalan di bun (tipe "bun" tidak ada di tsconfig web); tidak ikut build/runtime.
// Preload alat dev: "server-only" melempar di luar Next.js; stub-kan agar skrip bun bisa memakai modul *.server.ts.
import { plugin } from "bun";
plugin({ name: "stub-server-only", setup(b) { b.module("server-only", () => ({ exports: {}, loader: "object" })); } });
