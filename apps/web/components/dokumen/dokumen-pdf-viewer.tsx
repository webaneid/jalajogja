"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, ExternalLink } from "lucide-react";

type Props = {
  slug:      string;
  documentId: string;
  fileName:  string;
};

export function DokumenPdfViewer({ slug, documentId, fileName }: Props) {
  const [open, setOpen] = useState(false);
  const fileUrl = `/api/documents/${documentId}/file?slug=${slug}`;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4 mr-1.5" />
        Lihat PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium truncate pr-4">{fileName}</DialogTitle>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka di tab baru
              </a>
            </div>
          </DialogHeader>
          <iframe
            src={fileUrl}
            className="flex-1 w-full rounded-b-lg"
            title={fileName}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
