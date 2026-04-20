"use client";

// Popup untuk pilih section type baru (tambah section)
// Tampilkan grid wireframe semua section types

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTION_TYPES, SECTION_LABELS, type SectionType } from "@/lib/page-templates";
import { SectionWireframe } from "./section-wireframes";

type Props = {
  open:     boolean;
  onClose:  () => void;
  onSelect: (type: SectionType) => void;
};

export function SectionPicker({ open, onClose, onSelect }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pilih Section</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {SECTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => { onSelect(type); onClose(); }}
              className="group text-left border rounded-xl overflow-hidden hover:border-primary hover:ring-2 hover:ring-primary/20 transition-all"
            >
              <div className="bg-gray-50 p-3">
                <SectionWireframe type={type} />
              </div>
              <div className="px-3 py-2 border-t bg-white">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  {SECTION_LABELS[type]}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
