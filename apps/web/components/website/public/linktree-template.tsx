import type { LinktreeBody } from "@/lib/page-templates";

// Icon sederhana per link type — pure text/emoji, tidak butuh library
const LINK_ICONS: Record<string, string> = {
  instagram: "📸",
  tiktok:    "🎵",
  facebook:  "📘",
  youtube:   "▶️",
  twitter:   "🐦",
  whatsapp:  "💬",
  telegram:  "✈️",
  linkedin:  "💼",
  email:     "📧",
  phone:     "📞",
  website:   "🌐",
  shopee:    "🛒",
  tokopedia: "🛍️",
  gofood:    "🍔",
  grabfood:  "🚴",
  custom:    "🔗",
};

type Props = {
  title:      string;
  body:       LinktreeBody;
  orgName:    string;
};

export function LinktreeTemplate({ title, body, orgName }: Props) {
  const activeLinks = body.links.filter((l) => l.enabled && l.url);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Profil */}
        <div className="flex flex-col items-center text-center gap-3">
          {body.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={body.profileImageUrl}
              alt={orgName}
              className="w-20 h-20 rounded-full object-cover border-2 border-border shadow"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {orgName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg">{orgName}</h1>
            {body.bio && <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{body.bio}</p>}
          </div>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {activeLinks.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">{title}</p>
          ) : (
            activeLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full border border-border rounded-xl px-4 py-3.5 bg-white hover:border-primary hover:shadow-sm transition-all"
              >
                <span className="text-xl w-7 text-center shrink-0">{LINK_ICONS[link.type] ?? "🔗"}</span>
                <span className="font-medium text-sm flex-1 text-center">{link.label}</span>
              </a>
            ))
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground pt-2">
          Powered by jalajogja
        </p>
      </div>
    </div>
  );
}
