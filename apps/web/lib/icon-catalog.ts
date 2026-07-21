// Katalog icon kurasi untuk IconPicker (components/ui/icon-picker.tsx) — dipakai section
// Keunggulan/Layanan (features) dan calon pemakai lain ke depan. ~120 icon, BUKAN seluruh
// lucide-react (~1700+) — dikurasi untuk konteks bisnis/layanan/fitur, dikonfirmasi user
// 2026-07-22. Setiap nama SUDAH diverifikasi ada sebagai export lucide-react@1.8.0 (versi
// terinstall project ini) — JANGAN tambah nama baru tanpa cek dulu, banyak nama icon populer
// di versi lama (CheckCircle2, BarChart3, HelpCircle, Filter, dst) sudah di-rename di versi ini.
// Arsitektur lengkap: docs/arsitektur-keunggulan-section.md

import {
  Check, CircleCheck, ThumbsUp, Star, Award, Trophy, Medal, Sparkles, Target, Rocket, BadgeCheck, ListChecks,
  Shield, ShieldCheck, ShieldAlert, Lock, Key, KeyRound, Eye, EyeOff,
  CreditCard, Wallet, Banknote, Coins, PiggyBank, Receipt, TrendingUp, TrendingDown, DollarSign,
  CircleDollarSign, Landmark, Building2, Building, Calculator, ChartBar, ChartColumn, ChartLine,
  ChartPie, Percent, BadgeDollarSign, Scale,
  MessageCircle, MessageSquare, Mail, Phone, Send, Bell, BellRing, Megaphone, Share2, Headphones, LifeBuoy,
  Users, User, UserPlus, UserCheck, Heart, HeartHandshake, Handshake, GraduationCap,
  Zap, Cpu, Server, Cloud, CloudUpload, Wifi, Smartphone, Laptop, Monitor, Database, Globe, Link, Link2,
  Settings, SlidersHorizontal, Wrench, Code, Workflow, Gauge, Battery, Fuel,
  Clock, Timer, Calendar, CalendarCheck, CalendarClock, RefreshCw, RotateCw, Repeat, ArrowLeftRight,
  History, Hourglass, Infinity,
  FileText, FileCheck, ClipboardCheck, BookOpen, Info, Search, ListFilter,
  MapPin, Navigation, Truck, Package, Box, ShoppingBag, ShoppingCart, Store,
  Layers, Grid3x3, Puzzle, Gift, Flag, Bookmark, Compass, Lightbulb, Flame, Leaf, Sun, Umbrella, Anchor, Palette,
  type LucideIcon,
} from "lucide-react";

export type IconCatalogEntry = {
  name:     string;       // dipakai sebagai identifier tersimpan di data JSON + key ICON_MAP
  Icon:     LucideIcon;
  category: string;
  keywords: string;       // sinonim Indonesia, digabung ke value cmdk untuk pencarian
};

export const ICON_CATEGORIES = [
  "Umum & Pencapaian", "Keamanan", "Keuangan", "Komunikasi & Dukungan",
  "Orang & Komunitas", "Teknologi", "Waktu & Proses", "Dokumen & Info",
  "Logistik & Belanja", "Lainnya",
] as const;

export const ICON_CATALOG: IconCatalogEntry[] = [
  // Umum & Pencapaian
  { name: "Check",        Icon: Check,        category: "Umum & Pencapaian", keywords: "centang selesai" },
  { name: "CircleCheck",  Icon: CircleCheck,  category: "Umum & Pencapaian", keywords: "centang bulat selesai valid terverifikasi" },
  { name: "ThumbsUp",     Icon: ThumbsUp,     category: "Umum & Pencapaian", keywords: "suka jempol setuju" },
  { name: "Star",         Icon: Star,         category: "Umum & Pencapaian", keywords: "bintang favorit unggulan" },
  { name: "Award",        Icon: Award,        category: "Umum & Pencapaian", keywords: "penghargaan medali prestasi" },
  { name: "Trophy",       Icon: Trophy,       category: "Umum & Pencapaian", keywords: "piala juara prestasi" },
  { name: "Medal",        Icon: Medal,        category: "Umum & Pencapaian", keywords: "medali penghargaan" },
  { name: "Sparkles",     Icon: Sparkles,     category: "Umum & Pencapaian", keywords: "kilau baru spesial premium" },
  { name: "Target",       Icon: Target,       category: "Umum & Pencapaian", keywords: "sasaran tujuan fokus" },
  { name: "Rocket",       Icon: Rocket,       category: "Umum & Pencapaian", keywords: "roket cepat pertumbuhan luncur" },
  { name: "BadgeCheck",   Icon: BadgeCheck,   category: "Umum & Pencapaian", keywords: "lencana terverifikasi resmi" },
  { name: "ListChecks",   Icon: ListChecks,   category: "Umum & Pencapaian", keywords: "daftar checklist tugas" },

  // Keamanan
  { name: "Shield",       Icon: Shield,       category: "Keamanan", keywords: "perisai aman proteksi" },
  { name: "ShieldCheck",  Icon: ShieldCheck,  category: "Keamanan", keywords: "perisai aman terverifikasi" },
  { name: "ShieldAlert",  Icon: ShieldAlert,  category: "Keamanan", keywords: "perisai peringatan waspada" },
  { name: "Lock",         Icon: Lock,         category: "Keamanan", keywords: "gembok kunci terkunci privat" },
  { name: "Key",          Icon: Key,          category: "Keamanan", keywords: "kunci akses" },
  { name: "KeyRound",     Icon: KeyRound,     category: "Keamanan", keywords: "kunci akses akun" },
  { name: "Eye",          Icon: Eye,          category: "Keamanan", keywords: "mata lihat transparan" },
  { name: "EyeOff",       Icon: EyeOff,       category: "Keamanan", keywords: "sembunyi privasi tersembunyi" },

  // Keuangan
  { name: "CreditCard",       Icon: CreditCard,       category: "Keuangan", keywords: "kartu kredit bayar pembayaran" },
  { name: "Wallet",           Icon: Wallet,           category: "Keuangan", keywords: "dompet saldo" },
  { name: "Banknote",         Icon: Banknote,         category: "Keuangan", keywords: "uang tunai duit" },
  { name: "Coins",            Icon: Coins,            category: "Keuangan", keywords: "koin uang receh" },
  { name: "PiggyBank",        Icon: PiggyBank,        category: "Keuangan", keywords: "celengan tabungan" },
  { name: "Receipt",          Icon: Receipt,          category: "Keuangan", keywords: "struk kwitansi invoice" },
  { name: "TrendingUp",       Icon: TrendingUp,       category: "Keuangan", keywords: "naik pertumbuhan grafik untung" },
  { name: "TrendingDown",     Icon: TrendingDown,     category: "Keuangan", keywords: "turun grafik" },
  { name: "DollarSign",       Icon: DollarSign,       category: "Keuangan", keywords: "uang mata uang dolar rupiah" },
  { name: "CircleDollarSign", Icon: CircleDollarSign, category: "Keuangan", keywords: "uang mata uang bulat" },
  { name: "Landmark",         Icon: Landmark,         category: "Keuangan", keywords: "bank gedung lembaga transfer" },
  { name: "Building2",        Icon: Building2,        category: "Keuangan", keywords: "gedung kantor organisasi" },
  { name: "Building",         Icon: Building,         category: "Keuangan", keywords: "gedung kantor" },
  { name: "Calculator",       Icon: Calculator,       category: "Keuangan", keywords: "kalkulator hitung" },
  { name: "ChartBar",         Icon: ChartBar,         category: "Keuangan", keywords: "grafik batang statistik laporan" },
  { name: "ChartColumn",      Icon: ChartColumn,      category: "Keuangan", keywords: "grafik kolom statistik laporan" },
  { name: "ChartLine",        Icon: ChartLine,        category: "Keuangan", keywords: "grafik garis tren statistik" },
  { name: "ChartPie",         Icon: ChartPie,         category: "Keuangan", keywords: "grafik pie diagram statistik" },
  { name: "Percent",          Icon: Percent,          category: "Keuangan", keywords: "persen diskon bunga" },
  { name: "BadgeDollarSign",  Icon: BadgeDollarSign,  category: "Keuangan", keywords: "lencana harga biaya" },
  { name: "Scale",            Icon: Scale,            category: "Keuangan", keywords: "timbangan adil hukum keseimbangan" },

  // Komunikasi & Dukungan
  { name: "MessageCircle", Icon: MessageCircle, category: "Komunikasi & Dukungan", keywords: "chat pesan bulat" },
  { name: "MessageSquare", Icon: MessageSquare, category: "Komunikasi & Dukungan", keywords: "chat pesan kotak" },
  { name: "Mail",          Icon: Mail,          category: "Komunikasi & Dukungan", keywords: "surat email" },
  { name: "Phone",         Icon: Phone,         category: "Komunikasi & Dukungan", keywords: "telepon panggilan" },
  { name: "Send",          Icon: Send,          category: "Komunikasi & Dukungan", keywords: "kirim pesan" },
  { name: "Bell",          Icon: Bell,          category: "Komunikasi & Dukungan", keywords: "notifikasi lonceng pemberitahuan" },
  { name: "BellRing",      Icon: BellRing,      category: "Komunikasi & Dukungan", keywords: "notifikasi lonceng aktif" },
  { name: "Megaphone",     Icon: Megaphone,     category: "Komunikasi & Dukungan", keywords: "pengumuman promosi corong" },
  { name: "Share2",        Icon: Share2,        category: "Komunikasi & Dukungan", keywords: "bagikan share" },
  { name: "Headphones",    Icon: Headphones,    category: "Komunikasi & Dukungan", keywords: "layanan pelanggan dukungan support" },
  { name: "LifeBuoy",      Icon: LifeBuoy,      category: "Komunikasi & Dukungan", keywords: "bantuan dukungan support pelampung" },

  // Orang & Komunitas
  { name: "Users",           Icon: Users,           category: "Orang & Komunitas", keywords: "anggota komunitas orang banyak" },
  { name: "User",            Icon: User,            category: "Orang & Komunitas", keywords: "pengguna profil orang" },
  { name: "UserPlus",        Icon: UserPlus,        category: "Orang & Komunitas", keywords: "tambah anggota daftar" },
  { name: "UserCheck",       Icon: UserCheck,       category: "Orang & Komunitas", keywords: "anggota terverifikasi" },
  { name: "Heart",           Icon: Heart,           category: "Orang & Komunitas", keywords: "hati cinta suka donasi" },
  { name: "HeartHandshake",  Icon: HeartHandshake,  category: "Orang & Komunitas", keywords: "kerjasama peduli gotong royong" },
  { name: "Handshake",       Icon: Handshake,       category: "Orang & Komunitas", keywords: "kerjasama kemitraan sepakat" },
  { name: "GraduationCap",   Icon: GraduationCap,   category: "Orang & Komunitas", keywords: "pendidikan lulusan sekolah santri" },

  // Teknologi
  { name: "Zap",               Icon: Zap,               category: "Teknologi", keywords: "cepat kilat instan" },
  { name: "Cpu",                Icon: Cpu,               category: "Teknologi", keywords: "prosesor teknologi mesin" },
  { name: "Server",            Icon: Server,            category: "Teknologi", keywords: "server sistem infrastruktur" },
  { name: "Cloud",              Icon: Cloud,             category: "Teknologi", keywords: "cloud awan online" },
  { name: "CloudUpload",       Icon: CloudUpload,       category: "Teknologi", keywords: "unggah upload cloud" },
  { name: "Wifi",               Icon: Wifi,              category: "Teknologi", keywords: "internet koneksi jaringan" },
  { name: "Smartphone",        Icon: Smartphone,        category: "Teknologi", keywords: "hp ponsel aplikasi mobile" },
  { name: "Laptop",             Icon: Laptop,            category: "Teknologi", keywords: "komputer laptop" },
  { name: "Monitor",           Icon: Monitor,           category: "Teknologi", keywords: "layar komputer dashboard" },
  { name: "Database",          Icon: Database,          category: "Teknologi", keywords: "data basis database" },
  { name: "Globe",              Icon: Globe,             category: "Teknologi", keywords: "dunia global online internasional" },
  { name: "Link",               Icon: Link,              category: "Teknologi", keywords: "tautan link integrasi" },
  { name: "Link2",             Icon: Link2,             category: "Teknologi", keywords: "tautan link integrasi" },
  { name: "Settings",          Icon: Settings,          category: "Teknologi", keywords: "pengaturan konfigurasi gerigi" },
  { name: "SlidersHorizontal", Icon: SlidersHorizontal, category: "Teknologi", keywords: "pengaturan filter kustomisasi" },
  { name: "Wrench",            Icon: Wrench,            category: "Teknologi", keywords: "kunci pas perbaikan alat" },
  { name: "Code",               Icon: Code,              category: "Teknologi", keywords: "kode pemrograman teknis" },
  { name: "Workflow",          Icon: Workflow,          category: "Teknologi", keywords: "alur kerja proses otomatisasi" },
  { name: "Gauge",              Icon: Gauge,             category: "Teknologi", keywords: "performa kecepatan speedometer" },
  { name: "Battery",           Icon: Battery,           category: "Teknologi", keywords: "baterai daya tahan lama" },
  { name: "Fuel",               Icon: Fuel,              category: "Teknologi", keywords: "bahan bakar energi" },

  // Waktu & Proses
  { name: "Clock",          Icon: Clock,          category: "Waktu & Proses", keywords: "jam waktu" },
  { name: "Timer",          Icon: Timer,          category: "Waktu & Proses", keywords: "pengatur waktu durasi" },
  { name: "Calendar",       Icon: Calendar,       category: "Waktu & Proses", keywords: "kalender jadwal tanggal" },
  { name: "CalendarCheck",  Icon: CalendarCheck,  category: "Waktu & Proses", keywords: "jadwal terkonfirmasi" },
  { name: "CalendarClock",  Icon: CalendarClock,  category: "Waktu & Proses", keywords: "jadwal waktu pengingat" },
  { name: "RefreshCw",      Icon: RefreshCw,      category: "Waktu & Proses", keywords: "refresh perbarui ulang" },
  { name: "RotateCw",       Icon: RotateCw,       category: "Waktu & Proses", keywords: "putar ulang siklus" },
  { name: "Repeat",         Icon: Repeat,         category: "Waktu & Proses", keywords: "berulang rutin otomatis" },
  { name: "ArrowLeftRight", Icon: ArrowLeftRight, category: "Waktu & Proses", keywords: "transfer tukar dua arah" },
  { name: "History",        Icon: History,        category: "Waktu & Proses", keywords: "riwayat histori rekam jejak" },
  { name: "Hourglass",      Icon: Hourglass,      category: "Waktu & Proses", keywords: "jam pasir tunggu proses" },
  { name: "Infinity",       Icon: Infinity,       category: "Waktu & Proses", keywords: "tak terbatas unlimited selamanya" },

  // Dokumen & Info
  { name: "FileText",       Icon: FileText,       category: "Dokumen & Info", keywords: "dokumen file berkas" },
  { name: "FileCheck",      Icon: FileCheck,      category: "Dokumen & Info", keywords: "dokumen terverifikasi disetujui" },
  { name: "ClipboardCheck", Icon: ClipboardCheck, category: "Dokumen & Info", keywords: "checklist tugas selesai" },
  { name: "BookOpen",       Icon: BookOpen,       category: "Dokumen & Info", keywords: "buku panduan edukasi" },
  { name: "Info",           Icon: Info,           category: "Dokumen & Info", keywords: "informasi keterangan" },
  { name: "Search",         Icon: Search,         category: "Dokumen & Info", keywords: "cari pencarian" },
  { name: "ListFilter",     Icon: ListFilter,     category: "Dokumen & Info", keywords: "filter saring daftar" },

  // Logistik & Belanja
  { name: "MapPin",       Icon: MapPin,       category: "Logistik & Belanja", keywords: "lokasi alamat peta" },
  { name: "Navigation",   Icon: Navigation,   category: "Logistik & Belanja", keywords: "navigasi arah rute" },
  { name: "Truck",        Icon: Truck,        category: "Logistik & Belanja", keywords: "pengiriman kirim truk" },
  { name: "Package",      Icon: Package,      category: "Logistik & Belanja", keywords: "paket kiriman produk" },
  { name: "Box",          Icon: Box,          category: "Logistik & Belanja", keywords: "kotak paket produk" },
  { name: "ShoppingBag",  Icon: ShoppingBag,  category: "Logistik & Belanja", keywords: "belanja tas toko" },
  { name: "ShoppingCart", Icon: ShoppingCart, category: "Logistik & Belanja", keywords: "keranjang belanja toko" },
  { name: "Store",        Icon: Store,        category: "Logistik & Belanja", keywords: "toko kios usaha" },

  // Lainnya
  { name: "Layers",     Icon: Layers,     category: "Lainnya", keywords: "lapisan tumpukan fitur" },
  { name: "Grid3x3",    Icon: Grid3x3,    category: "Lainnya", keywords: "grid kotak susunan" },
  { name: "Puzzle",     Icon: Puzzle,     category: "Lainnya", keywords: "puzzle integrasi fleksibel" },
  { name: "Gift",       Icon: Gift,       category: "Lainnya", keywords: "hadiah bonus promo" },
  { name: "Flag",       Icon: Flag,       category: "Lainnya", keywords: "bendera target milestone" },
  { name: "Bookmark",   Icon: Bookmark,   category: "Lainnya", keywords: "simpan tandai favorit" },
  { name: "Compass",    Icon: Compass,    category: "Lainnya", keywords: "kompas arah panduan" },
  { name: "Lightbulb",  Icon: Lightbulb,  category: "Lainnya", keywords: "ide inovasi lampu" },
  { name: "Flame",      Icon: Flame,      category: "Lainnya", keywords: "api populer trending semangat" },
  { name: "Leaf",       Icon: Leaf,       category: "Lainnya", keywords: "daun ramah lingkungan alami" },
  { name: "Sun",        Icon: Sun,        category: "Lainnya", keywords: "matahari cerah terang" },
  { name: "Umbrella",   Icon: Umbrella,   category: "Lainnya", keywords: "payung perlindungan asuransi" },
  { name: "Anchor",     Icon: Anchor,     category: "Lainnya", keywords: "jangkar stabil kokoh" },
  { name: "Palette",    Icon: Palette,    category: "Lainnya", keywords: "warna kreatif desain" },
];

export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_CATALOG.map((e) => [e.name, e.Icon]),
);

export const DEFAULT_ICON_NAME = "CircleCheck";

export function resolveIcon(name: string | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || ICON_MAP[DEFAULT_ICON_NAME];
}
