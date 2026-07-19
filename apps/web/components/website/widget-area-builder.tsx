"use client";

import { useState, useTransition, useCallback } from "react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { nanoid } from "nanoid";
import {
  GripVertical, Plus, Trash2, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { SidebarSection, SidebarSectionFilter } from "@/lib/widget-areas";

type CategoryOption = { id: string; name: string };
type TagOption     = { id: string; name: string };

type Props = {
  areaId:     string;
  initial:    SidebarSection[];
  categories: CategoryOption[];
  tags:       TagOption[];
  onSave:     (areaId: string, sections: SidebarSection[]) => Promise<void>;
};

export function WidgetAreaBuilder({ areaId, initial, categories, tags, onSave }: Props) {
  const [sections, setSections]   = useState<SidebarSection[]>(initial);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved]         = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id);
      const newIdx = prev.findIndex(s => s.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
    setSaved(false);
  }, []);

  const addSection = () => {
    const id = nanoid();
    setSections(prev => [...prev, {
      id,
      type:   "posts",
      label:  "Artikel Terbaru",
      filter: { by: "recent" },
      limit:  5,
    }]);
    setExpanded(prev => ({ ...prev, [id]: true }));
    setSaved(false);
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setSaved(false);
  };

  const updateSection = (id: string, patch: Partial<SidebarSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSaved(false);
  };

  const updateFilter = (id: string, filter: SidebarSectionFilter) => {
    updateSection(id, { filter });
  };

  const handleSave = () => {
    startTransition(async () => {
      await onSave(areaId, sections);
      setSaved(true);
    });
  };

  return (
    <div className="space-y-4">
      <DndContext id="widget-area-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map(section => (
            <SortableSection
              key={section.id}
              section={section}
              expanded={!!expanded[section.id]}
              onToggle={() => setExpanded(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
              onRemove={() => removeSection(section.id)}
              onUpdate={patch => updateSection(section.id, patch)}
              onFilterChange={filter => updateFilter(section.id, filter)}
              categories={categories}
              tags={tags}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
          Belum ada section. Klik &ldquo;Tambah Section&rdquo; untuk mulai.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addSection} type="button">
          <Plus className="h-4 w-4 mr-1" />
          Tambah Section
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending} type="button">
          {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          {saved && !isPending ? "✓ Tersimpan" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}

// ── Sortable Section Card ─────────────────────────────────────────────────────

type SectionCardProps = {
  section:        SidebarSection;
  expanded:       boolean;
  onToggle:       () => void;
  onRemove:       () => void;
  onUpdate:       (patch: Partial<SidebarSection>) => void;
  onFilterChange: (filter: SidebarSectionFilter) => void;
  categories:     CategoryOption[];
  tags:           TagOption[];
};

function SortableSection({ section, expanded, onToggle, onRemove, onUpdate, onFilterChange, categories, tags }: SectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const filterBy = section.filter.by;

  const handleFilterByChange = (by: string) => {
    if (by === "recent" || by === "popular") {
      onFilterChange({ by } as SidebarSectionFilter);
    } else if (by === "category") {
      const firstCat = categories[0];
      onFilterChange({ by: "category", categoryId: firstCat?.id ?? "" });
    } else if (by === "tag") {
      const firstTag = tags[0];
      onFilterChange({ by: "tag", tagId: firstTag?.id ?? "" });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border rounded-lg bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex-1 text-sm font-medium truncate">{section.label || "(tanpa label)"}</span>
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground p-1 rounded"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-1 rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          {/* Label */}
          <div className="space-y-1">
            <Label className="text-xs">Label Judul</Label>
            <Input
              value={section.label}
              onChange={e => onUpdate({ label: e.target.value })}
              placeholder="Contoh: Artikel Populer"
              className="h-8 text-sm"
            />
          </div>

          {/* Filter type */}
          <div className="space-y-1">
            <Label className="text-xs">Tampilkan</Label>
            <Select value={filterBy} onValueChange={handleFilterByChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Terbaru</SelectItem>
                <SelectItem value="popular">Terpopuler</SelectItem>
                <SelectItem value="category">Per Kategori</SelectItem>
                <SelectItem value="tag">Per Tag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category picker */}
          {filterBy === "category" && (
            <div className="space-y-1">
              <Label className="text-xs">Kategori</Label>
              <Select
                value={"categoryId" in section.filter ? section.filter.categoryId : ""}
                onValueChange={val => onFilterChange({ by: "category", categoryId: val })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tag picker */}
          {filterBy === "tag" && (
            <div className="space-y-1">
              <Label className="text-xs">Tag</Label>
              <Select
                value={"tagId" in section.filter ? section.filter.tagId : ""}
                onValueChange={val => onFilterChange({ by: "tag", tagId: val })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Pilih tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Limit */}
          <div className="space-y-1">
            <Label className="text-xs">Jumlah Artikel (1–10)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={section.limit}
              onChange={e => onUpdate({ limit: Math.min(10, Math.max(1, Number(e.target.value))) })}
              className="h-8 text-sm w-24"
            />
          </div>
        </div>
      )}
    </div>
  );
}
