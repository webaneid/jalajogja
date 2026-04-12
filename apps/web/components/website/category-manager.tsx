"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryTable } from "./category-table";
import { TagTable } from "./tag-table";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  postCount: number;
};

export type TagItem = {
  id: string;
  name: string;
  slug: string;
  postCount: number;
};

// ── CategoryManager ───────────────────────────────────────────────────────────

export function CategoryManager({
  slug,
  categories,
  tags,
}: {
  slug: string;
  categories: CategoryItem[];
  tags: TagItem[];
}) {
  const [activeTab, setActiveTab] = useState<"categories" | "tags">("categories");

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "categories" | "tags")}
    >
      <TabsList>
        <TabsTrigger value="categories">
          Kategori
          <span className="ml-2 text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
            {categories.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="tags">
          Tag
          <span className="ml-2 text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
            {tags.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="categories" className="mt-6">
        <CategoryTable slug={slug} categories={categories} />
      </TabsContent>

      <TabsContent value="tags" className="mt-6">
        <TagTable slug={slug} tags={tags} />
      </TabsContent>
    </Tabs>
  );
}
