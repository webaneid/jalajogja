// ─── Nav Menu Types — dipakai admin settings + PublicHeader ──────────────────

export type NavItem = {
  id:        string;
  label:     string;
  href:      string;       // URL penuh: "/ikpm/post", "/{slug}/{pageSlug}", dll
  external?: boolean;      // buka di tab baru
  order:     number;
};

export type NavMenu = NavItem[];

// Kembalikan href nav item — simpel karena sudah disimpan sebagai URL
export function resolveNavHref(item: NavItem): string {
  return item.href || "#";
}

// Buat item baru dengan default kosong
export function createNavItem(): NavItem {
  return {
    id:    Math.random().toString(36).slice(2, 9),
    label: "",
    href:  "",
    order: 0,
  };
}

// Parse + migrasi dari DB (handle format lama berbasis type)
export function parseNavMenu(value: unknown, tenantSlug?: string): NavMenu {
  if (!Array.isArray(value)) return [];

  return (value as Record<string, unknown>[]).flatMap((item) => {
    if (!item || typeof item !== "object" || !item["id"] || !item["label"]) return [];

    const id       = String(item["id"]);
    const label    = String(item["label"]);
    const external = Boolean(item["external"] ?? false);
    const order    = Number(item["order"] ?? 0);

    // Format baru: sudah punya href
    if (item["href"] && typeof item["href"] === "string") {
      return [{ id, label, href: item["href"], external, order }];
    }

    // Format lama: punya type → resolve ke href
    const slug = tenantSlug ?? "";
    let href = "#";
    switch (item["type"]) {
      case "page":   href = `/${slug}/${String(item["pageSlug"] ?? "")}`; break;
      case "post":   href = `/${slug}/post`;                               break;
      case "event":  href = `/${slug}/agenda`;                             break;
      case "toko":   href = `/${slug}/produk`;                             break;
      case "donasi": href = `/${slug}/campaign`;                           break;
      case "custom":
        href = typeof item["href"] === "string" ? item["href"] : "#";
        break;
    }
    return [{ id, label, href, external, order }];
  });
}
