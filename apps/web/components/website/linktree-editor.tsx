"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, PlusIcon, Trash2 } from "lucide-react";
import {
  type LinktreeBody,
  type LinkItem,
  type LinkType,
  LINK_TYPES,
  LINK_LABELS,
  parseLinktreeBody,
  createLinkItem,
} from "@/lib/page-templates";

// ── Sortable Link Row ─────────────────────────────────────────────────────────

function LinkRow({
  link,
  onUpdate,
  onDelete,
}: {
  link:     LinkItem;
  onUpdate: (link: LinkItem) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-3 bg-white space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Select value={link.type} onValueChange={(v) => onUpdate({ ...link, type: v as LinkType, label: LINK_LABELS[v as LinkType] })}>
          <SelectTrigger className="h-8 text-xs w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{LINK_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground">Tampil</span>
          <Switch
            checked={link.enabled}
            onCheckedChange={(v: boolean) => onUpdate({ ...link, enabled: v })}
          />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pl-6">
        <Input
          value={link.label}
          onChange={(e) => onUpdate({ ...link, label: e.target.value })}
          placeholder="Label tombol"
          className="h-8 text-xs"
        />
        <Input
          value={link.url}
          onChange={(e) => onUpdate({ ...link, url: e.target.value })}
          placeholder="https://..."
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ── LinktreeEditor ────────────────────────────────────────────────────────────

type Props = {
  value:    string | null;
  onChange: (value: string) => void;
};

export function LinktreeEditor({ value, onChange }: Props) {
  const initial = parseLinktreeBody(value);
  const [data, setData] = useState<LinktreeBody>(initial);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function commit(next: LinktreeBody) {
    setData(next);
    onChange(JSON.stringify(next));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = data.links.findIndex((l) => l.id === active.id);
      const newIdx = data.links.findIndex((l) => l.id === over.id);
      commit({ ...data, links: arrayMove(data.links, oldIdx, newIdx) });
    }
  }

  function updateLink(id: string, link: LinkItem) {
    commit({ ...data, links: data.links.map((l) => l.id === id ? link : l) });
  }

  function deleteLink(id: string) {
    commit({ ...data, links: data.links.filter((l) => l.id !== id) });
  }

  function addLink() {
    commit({ ...data, links: [...data.links, createLinkItem("website")] });
  }

  return (
    <div className="space-y-5">
      {/* Profile */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">URL Foto Profil / Logo</Label>
          <Input
            value={data.profileImageUrl ?? ""}
            onChange={(e) => commit({ ...data, profileImageUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bio / Deskripsi Singkat</Label>
          <Input
            value={data.bio ?? ""}
            onChange={(e) => commit({ ...data, bio: e.target.value })}
            placeholder="Ikatan alumni pondok modern Gontor..."
          />
        </div>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Daftar Link
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={data.links.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {data.links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  onUpdate={(l) => updateLink(link.id, l)}
                  onDelete={() => deleteLink(link.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {data.links.length === 0 && (
          <div className="border-2 border-dashed rounded-xl py-8 text-center text-sm text-muted-foreground">
            Belum ada link. Tambahkan link pertama.
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={addLink}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Tambah Link
        </Button>
      </div>

      <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground">
        Linktree ditampilkan dalam tampilan mobile (lebar 480px) — ideal untuk link bio Instagram.
      </div>
    </div>
  );
}
