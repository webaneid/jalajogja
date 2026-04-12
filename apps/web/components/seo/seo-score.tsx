"use client";

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { TITLE_MAX_LENGTH, DESC_MAX_LENGTH } from "@/lib/seo-defaults";
import { cn } from "@/lib/utils";

interface SeoScoreProps {
  keyword: string;
  metaTitle: string;
  metaDesc: string;
  content?: string;
}

type CheckResult = {
  label: string;
  passed: boolean;
  warning: boolean;
};

function runChecks(
  keyword: string,
  metaTitle: string,
  metaDesc: string,
  content?: string,
): CheckResult[] {
  const kw    = keyword.trim().toLowerCase();
  const hasKw = kw.length > 0;

  const inTitle   = hasKw && metaTitle.toLowerCase().includes(kw);
  const inDesc    = hasKw && metaDesc.toLowerCase().includes(kw);
  const inContent = hasKw && !!content && content.toLowerCase().includes(kw);
  const titleOk   = metaTitle.length === 0 || metaTitle.length <= TITLE_MAX_LENGTH;
  const descOk    = metaDesc.length  === 0 || metaDesc.length  <= DESC_MAX_LENGTH;

  return [
    {
      label:   "Focus keyword ada di meta title",
      passed:  !hasKw || inTitle,
      warning: hasKw && !inTitle,
    },
    {
      label:   "Focus keyword ada di meta description",
      passed:  !hasKw || inDesc,
      warning: hasKw && !inDesc,
    },
    {
      label:   "Focus keyword ada di konten",
      passed:  !hasKw || inContent,
      warning: hasKw && !inContent,
    },
    {
      label:   `Meta title dalam batas ${TITLE_MAX_LENGTH} karakter`,
      passed:  titleOk,
      warning: false,
    },
    {
      label:   `Meta description dalam batas ${DESC_MAX_LENGTH} karakter`,
      passed:  descOk,
      warning: false,
    },
  ];
}

export function SeoScore({ keyword, metaTitle, metaDesc, content }: SeoScoreProps) {
  const checks = runChecks(keyword, metaTitle, metaDesc, content);

  // warning tidak dapat poin — hanya passed && !warning yang dihitung
  const passCount = checks.filter((c) => c.passed && !c.warning).length;
  const total     = checks.length;

  const level = passCount >= 4 ? "green" : passCount >= 2 ? "orange" : "red";

  const cfg = {
    green:  { label: "Baik",   dot: "bg-green-500",  text: "text-green-700",  border: "border-green-200 bg-green-50" },
    orange: { label: "Cukup",  dot: "bg-orange-400", text: "text-orange-700", border: "border-orange-200 bg-orange-50" },
    red:    { label: "Kurang", dot: "bg-red-500",     text: "text-red-700",    border: "border-red-200 bg-red-50" },
  }[level];

  return (
    <div className={cn("rounded-lg border p-3 text-sm", cfg.border)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className={cn("w-3 h-3 rounded-full shrink-0", cfg.dot)} />
        <span className={cn("font-medium text-sm", cfg.text)}>
          SEO Score: {cfg.label}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {passCount}/{total}
        </span>
      </div>

      {/* Checklist */}
      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2">
            {check.passed && !check.warning ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            ) : check.warning ? (
              <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            )}
            <span className="text-xs text-muted-foreground leading-tight">{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
