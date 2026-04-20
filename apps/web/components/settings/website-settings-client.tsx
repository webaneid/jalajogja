"use client";

import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GripVertical, PlusIcon, Trash2 } from "lucide-react";
import {
  type NavItem,
  type NavMenu,
  NAV_ITEM_TYPES,
  NAV_ITEM_TYPE_LABELS,
  createNavItem,
} from "@/lib/nav-menu";
import { saveWebsiteSettingsAction } from "@/app/(dashboard)/[tenant]/settings/website/actions";

type PageOption = { slug: string; title: string };

// ── Nav Item Row ──────────────────────────────────────────────────────────────

function NavItemRow({
  item,
  pages,
  onUpdate,
  onDelete,
}: {
  item:     NavItem;
  pages:    PageOption[];
  onUpdate: (item: NavItem) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const u = (patch: Partial<NavItem>) => onUpdate({ ...item, ...patch });

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Label */}
        <Input
          value={item.label}
          onChange={(e) => u({ label: e.target.value })}
          placeholder="Label menu"
          className="h-8 text-xs flex-1"
        />

        {/* Type */}
        <Select value={item.type} onValueChange={(v) => u({ type: v as NavItem["type"] })}>
          <SelectTrigger className="h-8 text-xs w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAV_ITEM_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {NAV_ITEM_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Conditional: page picker atau custom URL */}
      {item.type === "page" && (
        <div className="pl-6">
          <Select
            value={item.pageSlug ?? ""}
            onValueChange={(v) => u({ pageSlug: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Pilih halaman..." />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.slug} value={p.slug} className="text-xs">
                  {p.title} <span className="text-muted-foreground ml-1">/{p.slug}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {item.type === "custom" && (
        <div className="pl-6 space-y-1.5">
          <Input
            value={item.href ?? ""}
            onChange={(e) => u({ href: e.target.value })}
            placeholder="https://... atau /path"
            className="h-8 text-xs"
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={item.external ?? false}
              onCheckedChange={(v: boolean) => u({ external: v })}
            />
            <span className="text-xs text-muted-foreground">Buka di tab baru</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WebsiteSettingsClient ─────────────────────────────────────────────────────

type Props = {
  slug:          string;
  initialMenu:   NavMenu;
  initialHome:   string;
  pages:         PageOption[];
};

export function WebsiteSettingsClient({ slug, initialMenu, initialHome, pages }: Props) {
  const [menu,     setMenu]     = useState<NavMenu>(initialMenu);
  const [homePage, setHomePage] = useState(initialHome);
  const [isPending, start]      = useTransition();
  const [saved,    setSaved]    = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = menu.findIndex((i) => i.id === active.id);
      const newIdx = menu.findIndex((i) => i.id === over.id);
      setMenu(arrayMove(menu, oldIdx, newIdx));
    }
  }

  function addItem() {
    setMenu((prev) => [...prev, { ...createNavItem(), order: prev.length }]);
  }

  function updateItem(id: string, item: NavItem) {
    setMenu((prev) => prev.map((i) => (i.id === id ? item : i)));
  }

  function deleteItem(id: string) {
    setMenu((prev) => prev.filter((i) => i.id !== id));
  }

  function handleSave() {
    start(async () => {
      const ordered = menu.map((item, idx) => ({ ...item, order: idx }));
      const res = await saveWebsiteSettingsAction(slug, {
        homepageSlug: homePage,
        navMenu:      ordered,
      });
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Homepage */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Halaman Beranda</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Halaman yang tampil di URL utama (/) website Anda.
          </p>
        </div>
        <Select value={homePage} onValueChange={setHomePage}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Pilih halaman beranda..." />
          </SelectTrigger>
          <SelectContent>
            {pages.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.title} <span className="text-muted-foreground text-xs ml-1">/{p.slug}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Nav Menu */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Menu Navigasi</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag untuk atur urutan. Tampil di header website publik.
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={menu.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {menu.map((item) => (
                <NavItemRow
                  key={item.id}
                  item={item}
                  pages={pages}
                  onUpdate={(updated) => updateItem(item.id, updated)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {menu.length === 0 && (
          <div className="border-2 border-dashed rounded-xl py-8 text-center text-sm text-muted-foreground">
            Belum ada item menu.
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={addItem}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Tambah Item Menu
        </Button>
      </div>

      {/* Simpan */}
      <Button onClick={handleSave} disabled={isPending} className="w-full max-w-sm">
        {isPending ? "Menyimpan..." : saved ? "✓ Tersimpan" : "Simpan Pengaturan Website"}
      </Button>
    </div>
  );
}
