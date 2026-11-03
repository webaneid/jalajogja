// Uji autentikasi cron producer-settlement (fail-closed). Hanya DB lokal.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
const isLocal = (h: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(h);
let host = ""; try { host = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* */ }
if (!isLocal(host) || process.env.SMOKE_I_KNOW !== "1") { console.error("DITOLAK: butuh DB localhost + SMOKE_I_KNOW=1"); process.exit(2); }
const { GET } = await import("../app/api/cron/producer-settlement/route");
let fails = 0; const ok = (n: string, v: boolean) => { console.log((v ? "PASS " : "FAIL ") + n); if (!v) fails++; };
const call = (h?: string) => GET(new NextRequest("http://localhost/api/cron/producer-settlement", h === undefined ? {} : { headers: { "x-cron-secret": h } }));
delete process.env.CRON_SECRET;
ok("tanpa CRON_SECRET + tanpa header → 401", (await call()).status === 401);
ok("tanpa CRON_SECRET + header kosong → 401", (await call("")).status === 401);
process.env.CRON_SECRET = randomUUID();
ok("secret ada + header salah → 401", (await call("salah")).status === 401);
ok("secret ada + tanpa header → 401", (await call()).status === 401);
const good = await call(process.env.CRON_SECRET);
const body = await good.json() as { completed: number; tenantsFailed: string[] };
ok("secret benar → 200 + ringkasan", good.status === 200 && typeof body.completed === "number" && Array.isArray(body.tenantsFailed));
process.exit(fails ? 1 : 0);
