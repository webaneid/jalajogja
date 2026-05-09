"use client";

import { useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AttributeGroup } from "@jalajogja/db";

type Props = {
  groups:   AttributeGroup[];
  onChange: (groups: AttributeGroup[]) => void;
};

export function AttributeGroupEditor({ groups, onChange }: Props) {
  const [newGroupName, setNewGroupName] = useState("");

  function addGroup() {
    const name = newGroupName.trim();
    if (!name || groups.some(g => g.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...groups, { name, values: [] }]);
    setNewGroupName("");
  }

  function removeGroup(idx: number) {
    onChange(groups.filter((_, i) => i !== idx));
  }

  function addValue(groupIdx: number, value: string) {
    const v = value.trim();
    if (!v) return;
    const group = groups[groupIdx];
    if (group.values.includes(v)) return;
    const next = [...groups];
    next[groupIdx] = { ...group, values: [...group.values, v] };
    onChange(next);
  }

  function removeValue(groupIdx: number, valueIdx: number) {
    const next = [...groups];
    next[groupIdx] = {
      ...next[groupIdx],
      values: next[groupIdx].values.filter((_, i) => i !== valueIdx),
    };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => (
        <div key={gi} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{group.name}</span>
            </div>
            <button type="button" onClick={() => removeGroup(gi)}
              className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nilai-nilai atribut */}
          <div className="flex flex-wrap gap-1.5">
            {group.values.map((v, vi) => (
              <span key={vi}
                className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2.5 py-0.5 text-xs">
                {v}
                <button type="button" onClick={() => removeValue(gi, vi)}
                  className="text-muted-foreground hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <ValueInput onAdd={(v) => addValue(gi, v)} placeholder={`Tambah ${group.name}...`} />
          </div>
        </div>
      ))}

      {/* Tambah group baru */}
      <div className="flex gap-2">
        <Input
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addGroup())}
          placeholder="Nama atribut baru (mis. Ukuran, Warna)"
          className="h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={addGroup}
          disabled={!newGroupName.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Tambah
        </Button>
      </div>
    </div>
  );
}

function ValueInput({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [val, setVal] = useState("");
  function submit() {
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal("");
  }
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
      onBlur={submit}
      placeholder={placeholder}
      className="h-6 rounded-full border border-dashed border-border bg-transparent px-2.5
                 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary
                 min-w-[120px] max-w-[180px]"
    />
  );
}
