import Link from "next/link";
import type { EkosistemModulesConfig } from "@/lib/ekosistem-modules";

// Widget kecil "Cari Sinergi" — cross-link statis berbasis tag-overlap sederhana, TANPA
// matching engine (nol query tambahan, murni link navigasi dari tag entitas ini sendiri ke
// pencarian di 2 direktori lain). Lihat docs/arsitektur-ekosistem.md § 6 Fase 2.
//
// Arah pencarian dibalik (opposite intent) — kalau entitas ini MENAWARKAN tag X, link mengarah
// ke pencarian "siapa yang MEMBUTUHKAN X" di direktori lain (dan sebaliknya). Ini bukan
// algoritma pencocokan — cuma navigasi terarah berdasarkan data yang entitas ini sendiri isi.

export type DirectoryKey = "usaha" | "profesional" | "pesantren";

const DIRECTORY_LABELS: Record<DirectoryKey, string> = {
  usaha:       "Usaha",
  profesional: "Profesional",
  pesantren:   "Pesantren",
};

const ALL_DIRECTORIES: DirectoryKey[] = ["usaha", "profesional", "pesantren"];

const MAX_TAGS_SHOWN = 4;

type Props = {
  slug:          string;
  currentModule: DirectoryKey;
  offeredTags:   string[];
  neededTags:    string[];
  // Modul mana yang aktif di tenant ini — target link ke direktori yang dimatikan admin
  // disembunyikan. Opsional: kalau tidak dikirim, semua direktori lain tetap ditawarkan
  // (perilaku lama). Lihat lib/ekosistem-modules.ts.
  enabledModules?: EkosistemModulesConfig;
};

export function EcosystemTagCrossLinks({ slug, currentModule, offeredTags, neededTags, enabledModules }: Props) {
  const otherDirectories = ALL_DIRECTORIES.filter(
    d => d !== currentModule && (!enabledModules || enabledModules[d]),
  );
  if (otherDirectories.length === 0) return null;

  const entries: { tag: string; searchArah: "menawarkan" | "membutuhkan" }[] = [];
  const seen = new Set<string>();
  for (const tag of offeredTags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    entries.push({ tag, searchArah: "membutuhkan" });
  }
  for (const tag of neededTags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    entries.push({ tag, searchArah: "menawarkan" });
  }

  const capped = entries.slice(0, MAX_TAGS_SHOWN);
  if (capped.length === 0) return null;

  return (
    <div className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold mb-3">Cari Sinergi</h2>
      <div className="space-y-3">
        {capped.map(({ tag, searchArah }) => (
          <div key={tag} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {searchArah === "membutuhkan" ? "Siapa yang membutuhkan" : "Siapa yang menawarkan"}{" "}
              <span className="font-medium text-foreground">&ldquo;{tag}&rdquo;</span>?
            </span>
            <div className="flex gap-1.5">
              {otherDirectories.map(dir => (
                <Link
                  key={dir}
                  href={`/${slug}/${dir}?tag=${encodeURIComponent(tag)}&arah=${searchArah}`}
                  className="text-xs px-2 py-0.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                >
                  {DIRECTORY_LABELS[dir]} →
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
