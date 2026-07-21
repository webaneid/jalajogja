import * as React from "react";
import {
  ArrowRight, ChevronRight, ArrowUpRight, MoveRight,
  Zap, Sparkles, Send, Download, Calendar, ShoppingCart,
  Heart, ExternalLink, Trash2, X, Plus, Minus, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublicButtonVariant =
  | "primary"          // bg primer — CTA utama
  | "secondary"        // bg sekunder — aksi alternatif
  | "dark"             // bg gelap — kontras di section terang
  | "light"            // bg putih — kontras di section gelap/berwarna
  | "outline-primary"  // border primer — alternatif ringan
  | "outline-dark"     // border gelap — netral
  | "outline-light"    // border ikut currentColor — tombol kedua di atas bg berwarna arbitrary
  | "ghost"            // tanpa border — navigasi/link halus
  | "danger";          // merah — aksi destruktif

export type PublicButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

export type PublicButtonIconName =
  | "arrow"       // ArrowRight
  | "arrow-up"    // ArrowUpRight
  | "move"        // MoveRight
  | "chevron"     // ChevronRight
  | "zap"         // Zap
  | "sparkles"    // Sparkles
  | "send"        // Send
  | "download"    // Download
  | "calendar"    // Calendar
  | "cart"        // ShoppingCart
  | "heart"       // Heart
  | "external"    // ExternalLink
  | "trash"       // Trash2
  | "x"           // X
  | "plus"        // Plus
  | "minus"       // Minus
  | "check"       // Check
  | "none";       // tanpa ikon

// ── Ikon default per variant ──────────────────────────────────────────────────

const VARIANT_DEFAULT_ICON: Record<PublicButtonVariant, PublicButtonIconName> = {
  "primary":         "arrow",
  "secondary":       "zap",
  "dark":            "arrow-up",
  "light":           "arrow",
  "outline-primary": "chevron",
  "outline-dark":    "move",
  "outline-light":   "arrow-up",
  "ghost":           "chevron",
  "danger":          "trash",
};

const ICON_MAP: Record<PublicButtonIconName, React.ElementType | null> = {
  "arrow":     ArrowRight,
  "arrow-up":  ArrowUpRight,
  "move":      MoveRight,
  "chevron":   ChevronRight,
  "zap":       Zap,
  "sparkles":  Sparkles,
  "send":      Send,
  "download":  Download,
  "calendar":  Calendar,
  "cart":      ShoppingCart,
  "heart":     Heart,
  "external":  ExternalLink,
  "trash":     Trash2,
  "x":         X,
  "plus":      Plus,
  "minus":     Minus,
  "check":     Check,
  "none":      null,
};

// Ukuran ikon mengikuti ukuran button
const ICON_SIZE: Record<PublicButtonSize, string> = {
  xs: "h-3   w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4   w-4",
  lg: "h-5   w-5",
  xl: "h-5   w-5",
};

// ── Props — polimorfik: <a> jika href, <button> jika tidak ───────────────────

type BaseProps = {
  variant?:   PublicButtonVariant;
  size?:      PublicButtonSize;
  icon?:      PublicButtonIconName;      // override ikon kanan
  iconLeft?:  PublicButtonIconName;      // ikon kiri (misal ← Kembali)
  fullWidth?: boolean;
  className?: string;
  children?:  React.ReactNode;
};

type AsLink   = BaseProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type AsButton = BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

export type PublicButtonProps = AsLink | AsButton;

// ── Komponen ──────────────────────────────────────────────────────────────────

export function PublicButton(props: PublicButtonProps) {
  const {
    variant  = "primary",
    size     = "md",
    icon,
    iconLeft,
    fullWidth,
    className,
    children,
    ...rest
  } = props;

  const resolvedIcon = icon ?? VARIANT_DEFAULT_ICON[variant];
  const RightIcon    = ICON_MAP[resolvedIcon];
  const LeftIcon     = iconLeft ? ICON_MAP[iconLeft] : null;
  const iconCls      = ICON_SIZE[size];

  // Komposisi nama class CSS dari globals.css
  const cls = cn(
    "btn",
    `btn-${size}`,
    variant === "outline-primary" ? "btn-outline-primary"
      : variant === "outline-dark" ? "btn-outline-dark"
      : `btn-${variant}`,
    fullWidth && "btn-full",
    className,
  );

  const content = (
    <>
      {LeftIcon  && <LeftIcon  className={cn(iconCls, "shrink-0")} aria-hidden />}
      {children}
      {RightIcon && <RightIcon className={cn(iconCls, "shrink-0")} aria-hidden />}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as Omit<AsLink, keyof BaseProps>;
    return <a href={props.href} className={cls} {...anchorRest}>{content}</a>;
  }

  return (
    <button className={cls} {...(rest as Omit<AsButton, keyof BaseProps>)}>
      {content}
    </button>
  );
}
