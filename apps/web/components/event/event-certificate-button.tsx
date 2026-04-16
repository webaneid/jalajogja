"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Award, Loader2, ExternalLink } from "lucide-react";

type Props = {
  slug:           string;
  eventId:        string;
  registrationId: string;
  existingUrl:    string | null;
};

export function EventCertificateButton({
  slug,
  eventId,
  registrationId,
  existingUrl,
}: Props) {
  const [loading,  setLoading]  = useState(false);
  const [certUrl,  setCertUrl]  = useState<string | null>(existingUrl);
  const [error,    setError]    = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${eventId}/certificate/${registrationId}?slug=${slug}`,
        { method: "POST" }
      );
      const json = await res.json() as { success?: boolean; certificateUrl?: string; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Gagal generate sertifikat.");
        return;
      }
      setCertUrl(json.certificateUrl ?? null);
      if (json.certificateUrl) {
        window.open(json.certificateUrl, "_blank");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          onClick={handleGenerate}
          disabled={loading}
          title="Generate Sertifikat"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Award className="h-3 w-3" />
          )}
          {certUrl ? "Buat Ulang" : "Sertifikat"}
        </Button>

        {certUrl && !loading && (
          <a href={certUrl} target="_blank" rel="noopener noreferrer" title="Buka Sertifikat">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
