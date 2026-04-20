// CSS wireframe sketches untuk setiap section type + variant
// Dipakai di section picker popup dan row thumbnail di landing builder
// Murni Tailwind — tidak ada gambar external

import type { SectionType } from "@/lib/page-templates";

// ── Base skeleton shapes ──────────────────────────────────────────────────────

function Bar({ w = "full", h = 3, className = "" }: { w?: string; h?: number; className?: string }) {
  return <div className={`w-${w} h-${h} bg-gray-300 rounded ${className}`} />;
}

function Block({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded ${className}`} />;
}

function Dot() {
  return <div className="w-5 h-5 bg-gray-300 rounded-full shrink-0" />;
}

// ── Wireframes per section ────────────────────────────────────────────────────

function HeroWireframe() {
  return (
    <div className="w-full h-full bg-gray-300 rounded flex flex-col items-center justify-center gap-2 p-3">
      <div className="w-3/4 h-4 bg-gray-500 rounded" />
      <div className="w-1/2 h-2.5 bg-gray-400 rounded" />
      <div className="flex gap-2 mt-1">
        <div className="w-14 h-5 bg-gray-500 rounded" />
        <div className="w-14 h-5 bg-gray-400 rounded border border-gray-400 bg-transparent" />
      </div>
    </div>
  );
}

function PostsWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex flex-col gap-1.5 p-2">
      <div className="w-1/2 h-2.5 bg-gray-400 rounded mb-1" />
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {[0,1,2].map((i) => (
          <div key={i} className="bg-gray-200 rounded flex flex-col gap-1 p-1">
            <div className="flex-1 bg-gray-300 rounded" />
            <div className="w-full h-1.5 bg-gray-300 rounded" />
            <div className="w-3/4 h-1.5 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex flex-col gap-1.5 p-2">
      <div className="w-1/2 h-2.5 bg-gray-400 rounded mb-1" />
      {[0,1,2].map((i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-200 rounded p-1">
          <div className="w-6 h-6 bg-gray-300 rounded shrink-0" />
          <div className="flex-1 flex flex-col gap-1">
            <div className="w-3/4 h-1.5 bg-gray-400 rounded" />
            <div className="w-1/2 h-1.5 bg-gray-300 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex flex-col gap-1.5 p-2">
      <div className="w-1/3 h-2.5 bg-gray-400 rounded mb-1" />
      <div className="grid grid-cols-3 gap-1 flex-1">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className="bg-gray-300 rounded" />
        ))}
      </div>
    </div>
  );
}

function AboutTextWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex gap-2 p-2 items-center">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="w-2/3 h-2.5 bg-gray-400 rounded" />
        <div className="w-full h-1.5 bg-gray-300 rounded" />
        <div className="w-full h-1.5 bg-gray-300 rounded" />
        <div className="w-3/4 h-1.5 bg-gray-300 rounded" />
        <div className="w-1/3 h-4 bg-gray-400 rounded mt-1" />
      </div>
      <div className="w-2/5 h-full bg-gray-300 rounded" />
    </div>
  );
}

function FeaturesWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex flex-col gap-1.5 p-2">
      <div className="w-1/2 h-2.5 bg-gray-400 rounded mx-auto mb-1" />
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {[0,1,2].map((i) => (
          <div key={i} className="bg-gray-200 rounded flex flex-col items-center gap-1 p-1.5">
            <div className="w-6 h-6 bg-gray-400 rounded-full" />
            <div className="w-full h-1.5 bg-gray-400 rounded" />
            <div className="w-3/4 h-1.5 bg-gray-300 rounded" />
            <div className="w-full h-1 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaWireframe() {
  return (
    <div className="w-full h-full bg-gray-400 rounded flex flex-col items-center justify-center gap-2 p-3">
      <div className="w-2/3 h-3.5 bg-gray-600 rounded" />
      <div className="w-1/2 h-2 bg-gray-500 rounded" />
      <div className="w-20 h-5 bg-gray-600 rounded mt-1" />
    </div>
  );
}

function ContactInfoWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex flex-col gap-1.5 p-2">
      <div className="w-1/2 h-2.5 bg-gray-400 rounded mb-1 mx-auto" />
      <div className="grid grid-cols-3 gap-1.5">
        {[0,1,2].map((i) => (
          <div key={i} className="bg-gray-200 rounded flex flex-col items-center gap-1 p-1.5">
            <div className="w-5 h-5 bg-gray-400 rounded-full" />
            <div className="w-full h-1.5 bg-gray-300 rounded" />
            <div className="w-3/4 h-1.5 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex flex-col gap-1.5 p-2">
      <div className="w-1/3 h-2.5 bg-gray-400 rounded mx-auto mb-1" />
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {[0,1,2,3].map((i) => (
          <div key={i} className="bg-gray-200 rounded flex flex-col items-center justify-center gap-1 p-1">
            <div className="w-8 h-4 bg-gray-400 rounded" />
            <div className="w-full h-1.5 bg-gray-300 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DividerWireframe() {
  return (
    <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
      <div className="w-full h-2 bg-gray-200 rounded mx-4" />
    </div>
  );
}

// ── Map type → component ──────────────────────────────────────────────────────

const WIREFRAME_MAP: Record<SectionType, React.FC> = {
  hero:         HeroWireframe,
  posts:        PostsWireframe,
  events:       EventsWireframe,
  gallery:      GalleryWireframe,
  about_text:   AboutTextWireframe,
  features:     FeaturesWireframe,
  cta:          CtaWireframe,
  contact_info: ContactInfoWireframe,
  stats:        StatsWireframe,
  divider:      DividerWireframe,
};

// ── Public exports ────────────────────────────────────────────────────────────

/** Wireframe besar untuk picker popup */
export function SectionWireframe({ type }: { type: SectionType }) {
  const Component = WIREFRAME_MAP[type];
  return (
    <div className="w-full aspect-[16/7] overflow-hidden">
      <Component />
    </div>
  );
}

/** Wireframe mini untuk row thumbnail di LandingBuilder */
export function SectionWireframeMini({ type }: { type: SectionType }) {
  const Component = WIREFRAME_MAP[type];
  return (
    <div className="w-16 h-10 overflow-hidden rounded shrink-0">
      <div className="w-full h-full scale-[0.4] origin-top-left" style={{ width: "250%", height: "250%" }}>
        <Component />
      </div>
    </div>
  );
}
