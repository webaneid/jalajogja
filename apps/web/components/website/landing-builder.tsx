"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GripVertical, PlusIcon, Trash2, Settings2, LayoutGrid } from "lucide-react";
import {
  type SectionItem,
  type SectionType,
  SECTION_LABELS,
  createSection,
  parseLandingBody,
} from "@/lib/page-templates";
import { SectionWireframeMini, SectionWireframe } from "./section-wireframes";
import { SectionPicker } from "./section-picker";
import { SectionEditor } from "./section-editors";

// ── Sortable Row ──────────────────────────────────────────────────────────────

function SectionRow({
  section,
  onEdit,
  onDelete,
}: {
  section:  SectionItem;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white hover:border-primary/40 transition-colors"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Mini wireframe thumbnail */}
      <SectionWireframeMini type={section.type} />

      {/* Label */}
      <span className="flex-1 text-sm font-medium text-foreground truncate">
        {SECTION_LABELS[section.type]}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={onEdit}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Section Edit Dialog ───────────────────────────────────────────────────────

function SectionEditDialog({
  section,
  open,
  onClose,
  onChange,
  onVariantChange,
}: {
  section:         SectionItem | null;
  open:            boolean;
  onClose:         () => void;
  onChange:        (data: Record<string, unknown>) => void;
  onVariantChange: (variant: string) => void;
}) {
  if (!section) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Edit: {SECTION_LABELS[section.type]}
          </DialogTitle>
        </DialogHeader>

        {/* Wireframe preview */}
        <div className="rounded-lg overflow-hidden border bg-gray-50 p-3">
          <SectionWireframe type={section.type} />
        </div>

        {/* Editor */}
        <SectionEditor
          type={section.type}
          data={section.data}
          variant={section.variant}
          onChange={onChange}
          onVariantChange={onVariantChange}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── LandingBuilder ────────────────────────────────────────────────────────────

type Props = {
  value:    string | null; // JSON string dari pages.content
  onChange: (value: string) => void;
};

export function LandingBuilder({ value, onChange }: Props) {
  const initial = parseLandingBody(value);
  const [sections, setSections] = useState<SectionItem[]>(initial.sections);
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [editSection, setEditSection] = useState<SectionItem | null>(null);
  const [editOpen, setEditOpen]       = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function commit(next: SectionItem[]) {
    setSections(next);
    onChange(JSON.stringify({ sections: next }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = sections.findIndex((s) => s.id === active.id);
      const newIdx = sections.findIndex((s) => s.id === over.id);
      commit(arrayMove(sections, oldIdx, newIdx));
    }
  }

  function handleAdd(type: SectionType) {
    const next = [...sections, createSection(type)];
    commit(next);
  }

  function handleDelete(id: string) {
    commit(sections.filter((s) => s.id !== id));
  }

  function handleEdit(section: SectionItem) {
    setEditSection(section);
    setEditOpen(true);
  }

  function handleEditChange(data: Record<string, unknown>) {
    if (!editSection) return;
    const next = sections.map((s) =>
      s.id === editSection.id ? { ...s, data } : s
    );
    setEditSection((prev) => prev ? { ...prev, data } : prev);
    commit(next);
  }

  function handleVariantChange(variant: string) {
    if (!editSection) return;
    const next = sections.map((s) =>
      s.id === editSection.id ? { ...s, variant } : s
    );
    setEditSection((prev) => prev ? { ...prev, variant } : prev);
    commit(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Sections — drag untuk atur urutan
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setPickerOpen(true)}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Tambah Section
        </Button>
      </div>

      {sections.length === 0 && (
        <div className="border-2 border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">
          Belum ada section. Klik "Tambah Section" untuk mulai.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sections.map((section) => (
              <SectionRow
                key={section.id}
                section={section}
                onEdit={() => handleEdit(section)}
                onDelete={() => handleDelete(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <SectionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAdd}
      />

      <SectionEditDialog
        section={editSection}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onChange={handleEditChange}
        onVariantChange={handleVariantChange}
      />
    </div>
  );
}
