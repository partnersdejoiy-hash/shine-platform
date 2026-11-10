import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ShineLogo } from "@/components/ShineLogo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Accessibility,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Component,
  Layers,
  Loader2,
  MessageSquare,
  MousePointer2,
  Palette,
  PenLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "foundations", label: "Foundations & tokens", icon: Layers },
  { id: "components", label: "Components", icon: Component },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "content", label: "Content & tone", icon: PenLine },
  { id: "antipatterns", label: "Anti-patterns", icon: AlertTriangle },
  { id: "qa", label: "QA checklist", icon: CheckCircle2 },
] as const;

export function AppDesignSystem() {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const onScroll = () => {
      let current = "overview";
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top <= 180) current = s.id;
      }
      setActive(current);
    };
    const el = scrollRef.current;
    onScroll();
    el?.addEventListener("scroll", onScroll, { passive: true });
    return () => el?.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" data-design-scroll>
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* ---- Hero ---- */}
        <div className="pt-8 sm:pt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-medium text-primary">
            <Palette className="size-3.5" /> SHINE Design System · Powered by DEJOIY
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Build once. <span className="gold-text">Stay consistent everywhere.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Implementation-ready, token-driven UI guidance for SHINE — optimized for consistency,
            accessibility (WCAG 2.2 AA) and fast delivery across every surface: desktop, laptop,
            tablet and phone.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge className="bg-primary/12 text-primary hover:bg-primary/15">v1.0</Badge>
            <Badge className="bg-accent text-muted-foreground">Token-first</Badge>
            <Badge className="bg-accent text-muted-foreground">WCAG 2.2 AA</Badge>
            <Badge className="bg-accent text-muted-foreground">Responsive 4 breakpoints</Badge>
          </div>
        </div>

        {/* ---- Layout: sidebar + content ---- */}
        <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row">
          {/* Sidebar (desktop) */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-6 space-y-1">
              <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                On this page
              </div>
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => go(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                    active === s.id
                      ? "bg-primary/12 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <s.icon className="size-3.5 shrink-0" />
                  {s.label}
                </button>
              ))}
              <div className="mt-6 rounded-xl border border-dashed border-border p-3">
                <ShineLogo size={20} showWordmark={false} />
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  Component density: buttons 22 · links 6 · inputs 4 · navigation 2 · lists 2
                </p>
              </div>
            </div>
          </aside>

          {/* Mobile tab bar */}
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:hidden">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active === s.id
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-14">
            <Section id="overview" refs={sectionRefs} title="Context & goals">
              <p className="text-sm leading-6 text-muted-foreground">
                SHINE is a realtime enterprise communication platform — messaging, calls, meetings,
                files, tasks and AI — all served by one design language. This system defines the
                <span className="font-medium text-foreground"> semantic tokens</span>, component
                states and accessibility gates every screen must pass. Rules use{" "}
                <code className="rounded bg-accent px-1 py-0.5 font-mono text-[11px]">must</code>{" "}
                (non-negotiable) and{" "}
                <code className="rounded bg-accent px-1 py-0.5 font-mono text-[11px]">should</code>{" "}
                (recommended) language.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { t: "Consistency", d: "One token source of truth; teams prefer system consistency over local visual exceptions." },
                  { t: "Speed", d: "Ship with tokens and pre-built states — no re-inventing hover, focus or empty states." },
                  { t: "Accessibility", d: "Every rule testable: contrast, focus, targets and keyboard paths verified in implementation." },
                  { t: "Responsive", d: "One layout system across desktop, tablet, Android and small phones — never a separate design." },
                ].map((c) => (
                  <div key={c.t} className="glass hairline rounded-2xl p-4">
                    <div className="text-sm font-semibold">{c.t}</div>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{c.d}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="foundations" refs={sectionRefs} title="Design tokens & foundations">
              <Foundations />
            </Section>

            <Section id="components" refs={sectionRefs} title="Component rules">
              <div className="space-y-10">
                <ButtonSpec />
                <LinkSpec />
                <InputSpec />
                <NavigationSpec />
                <ListSpec />
              </div>
            </Section>

            <Section id="accessibility" refs={sectionRefs} title="Accessibility requirements">
              <AccessibilitySpec />
            </Section>

            <Section id="content" refs={sectionRefs} title="Content & tone standards">
              <ContentSpec />
            </Section>

            <Section id="antipatterns" refs={sectionRefs} title="Anti-patterns & prohibited implementations">
              <AntiPatterns />
            </Section>

            <Section id="qa" refs={sectionRefs} title="QA checklist">
              <QaChecklist />
            </Section>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
              <ShineLogo size={26} showWordmark={false} />
              <p className="mt-2 text-xs text-muted-foreground">
                SHINE Design System · Powered by DEJOIY · Tokens live in{" "}
                <code className="rounded bg-accent px-1 py-0.5 font-mono text-[10px]">src/index.css</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== helpers =================================== */

function Section({
  id,
  refs,
  title,
  children,
}: {
  id: string;
  refs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      ref={(el) => {
        refs.current[id] = el;
      }}
      id={id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.35 }}
      className="scroll-mt-4"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-6 place-items-center rounded-lg bg-primary/12 text-primary">
          <ChevronRight className="size-3.5" />
        </span>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function SpecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-2 text-[13px] leading-5 text-muted-foreground">{children}</li>;
}

function RuleBullet() {
  return (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] text-primary">
      <Check className="size-2.5" />
    </span>
  );
}

function StateChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone === "good" && "bg-emerald-500/12 text-emerald-400",
        tone === "bad" && "bg-rose-500/12 text-rose-400",
        tone === "neutral" && "bg-accent text-muted-foreground",
      )}
    >
      {tone === "good" && <Check className="size-2.5" />}
      {tone === "bad" && <XCircle className="size-2.5" />}
      {label}
    </span>
  );
}

function TokenRow({ token, varName, value, usage }: { token: string; varName: string; value: string; usage: string }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-3 gap-y-0.5 border-b border-border/50 py-2.5 last:border-0 sm:grid-cols-[150px_120px_90px_1fr]">
      <div className="text-[13px] font-medium">{token}</div>
      <code className="font-mono text-[11px] text-muted-foreground">{varName}</code>
      <code className="font-mono text-[11px] text-foreground/70">{value}</code>
      <div className="text-right text-[11px] text-muted-foreground">{usage}</div>
    </div>
  );
}

/* ============================== foundations =============================== */

const BRAND_COLORS = [
  { name: "Paper", hex: "#FFFBF7", usage: "Light canvas", text: "#121212" },
  { name: "Ink", hex: "#121212", usage: "Text · sticker outlines · hard shadows", text: "#FF4FA3" },
  { name: "Dejoiy Pink", hex: "#FF4FA3", usage: "Primary action · accent (user can change it)", text: "#121212" },
  { name: "Soft Pink", hex: "#FFE3F1", usage: "Active rows · selected chips", text: "#121212" },
  { name: "Night", hex: "#141216", usage: "Dark canvas", text: "#FF5CAB" },
];

function Foundations() {
  return (
    <div className="space-y-8">
      {/* Color tokens */}
      <div>
        <SpecLabel>Brand palette (display reference — components must use semantic tokens)</SpecLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BRAND_COLORS.map((c) => (
            <div key={c.name} className="glass hairline overflow-hidden rounded-2xl">
              <div className="flex h-20 items-end p-3" style={{ background: c.hex }}>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ color: c.text, background: "rgba(0,0,0,0.35)" }}>
                  {c.hex}
                </span>
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold">{c.name}</div>
                <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{c.usage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Semantic tokens */}
      <div>
        <SpecLabel>Semantic tokens (component guidance must reference these, never raw hex)</SpecLabel>
        <div className="glass hairline rounded-2xl p-4">
          <TokenRow token="background" varName="--background" value="#FFFBF7 / #141216" usage="App canvas" />
          <TokenRow token="surface" varName="--card" value="#FFFFFF / #1D1A20" usage="Cards, panels" />
          <TokenRow token="primary" varName="--primary" value="#FF4FA3" usage="Buttons, active, focus" />
          <TokenRow token="on-primary" varName="--primary-foreground" value="#121212" usage="Text on the accent" />
          <TokenRow token="text" varName="--foreground" value="#121212 / #F4F1F5" usage="Primary text" />
          <TokenRow token="text-muted" varName="--muted-foreground" value="#6B6570 / #A39CAB" usage="Secondary text" />
          <TokenRow token="border" varName="--border" value="#EAE3E7 / #2F2A33" usage="Hairlines, dividers" />
          <TokenRow token="destructive" varName="--destructive" value="rose" usage="Errors, removal" />
          <TokenRow token="gold-soft" varName="--gold-soft" value="gold 13%" usage="Tints, glows" />
        </div>
      </div>

      {/* Typography */}
      <div>
        <SpecLabel>Typography scale</SpecLabel>
        <div className="glass hairline overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-[90px_140px_1fr]">
            <span className="text-xs font-semibold">Display</span>
            <code className="font-mono text-[10px] text-muted-foreground">32px · 700 · 1.15</code>
            <span className="text-3xl font-bold tracking-tight">Mission control for your team</span>
          </div>
          <div className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-[90px_140px_1fr]">
            <span className="text-xs font-semibold">Heading</span>
            <code className="font-mono text-[10px] text-muted-foreground">24px · 600 · 1.2</code>
            <span className="text-2xl font-semibold tracking-tight">Recent conversations</span>
          </div>
          <div className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-[90px_140px_1fr]">
            <span className="text-xs font-semibold">Title</span>
            <code className="font-mono text-[10px] text-muted-foreground">20px · 600 · 1.25</code>
            <span className="text-xl font-semibold">Weekly sync — Q3 planning</span>
          </div>
          <div className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-[90px_140px_1fr]">
            <span className="text-xs font-semibold">Body</span>
            <code className="font-mono text-[10px] text-muted-foreground">14px · 400 · 1.6</code>
            <span className="text-sm">Realtime messages, files and tasks in one workspace.</span>
          </div>
          <div className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-[90px_140px_1fr]">
            <span className="text-xs font-semibold">Meta</span>
            <code className="font-mono text-[10px] text-muted-foreground">11px · 500 · 1.4</code>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">12 unread · 2 min ago</span>
          </div>
          <div className="grid grid-cols-[90px_1fr] items-center gap-3 px-4 py-3 sm:grid-cols-[90px_140px_1fr]">
            <span className="text-xs font-semibold">Code</span>
            <code className="font-mono text-[10px] text-muted-foreground">12px · 400 · mono</code>
            <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs">AUTH_GOOGLE_ID</code>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Rules: body text must never fall below 11px; line-height must stay ≥1.4 for readability; type scale must not be
          extended with one-off sizes — reuse the six steps above.
        </p>
      </div>

      {/* Spacing */}
      <div>
        <SpecLabel>Spacing scale (space.1 → space.6)</SpecLabel>
        <div className="glass hairline space-y-2 rounded-2xl p-4">
          {[
            { name: "space.1", px: 2 },
            { name: "space.2", px: 4 },
            { name: "space.3", px: 8 },
            { name: "space.4", px: 12 },
            { name: "space.5", px: 16 },
            { name: "space.6", px: 24 },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              <code className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">{s.name}</code>
              <div className="flex h-4 flex-1 items-center">
                <div className="h-full rounded-sm bg-primary/70" style={{ width: s.px * 3 }} />
              </div>
              <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground">{s.px}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* Radius / shadow / motion */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass hairline rounded-2xl p-4">
          <SpecLabel>Radius</SpecLabel>
          <div className="flex items-end gap-3">
            {[
              { n: "xs", r: 4, cls: "h-10 w-14 bg-primary/20" },
              { n: "sm", r: 10, cls: "h-12 w-16 bg-primary/25" },
              { n: "md", r: 16, cls: "h-14 w-20 bg-primary/30" },
              { n: "pill", r: 999, cls: "h-12 w-16 bg-primary/30" },
            ].map((x) => (
              <div key={x.n} className="text-center">
                <div className={cn("mb-1.5", x.cls)} style={{ borderRadius: x.r }} />
                <span className="text-[10px] text-muted-foreground">{x.n} · {x.r}px</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass hairline rounded-2xl p-4">
          <SpecLabel>Shadow & elevation</SpecLabel>
          <div className="flex items-end gap-3">
            <div className="text-center">
              <div className="mb-1.5 grid h-12 w-16 place-items-center rounded-lg bg-card text-[9px] text-muted-foreground shadow-sm">shadow-sm</div>
              <span className="text-[10px] text-muted-foreground">resting</span>
            </div>
            <div className="text-center">
              <div className="mb-1.5 grid h-12 w-16 place-items-center rounded-lg bg-card text-[9px] text-muted-foreground shadow-[0_16px_40px_-18px_rgb(0_0_0/0.45)]">elevated</div>
              <span className="text-[10px] text-muted-foreground">hover</span>
            </div>
            <div className="text-center">
              <div className="ring-glow mb-1.5 grid h-12 w-16 place-items-center rounded-lg bg-card text-[9px] text-primary">ring-glow</div>
              <span className="text-[10px] text-muted-foreground">active / focus</span>
            </div>
          </div>
        </div>
        <div className="glass hairline rounded-2xl p-4">
          <SpecLabel>Motion</SpecLabel>
          <div className="space-y-2">
            {[
              { n: "instant", ms: 50, usage: "state flips" },
              { n: "fast", ms: 100, usage: "hover, focus" },
              { n: "base", ms: 200, usage: "panels, toasts" },
              { n: "slow", ms: 300, usage: "page entrances" },
            ].map((m) => (
              <div key={m.n} className="flex items-center justify-between text-[11px]">
                <code className="font-mono text-muted-foreground">{m.n} · {m.ms}ms</code>
                <span className="text-muted-foreground">{m.usage}</span>
              </div>
            ))}
            <p className="border-t border-border/50 pt-2 text-[10px] leading-4 text-muted-foreground">
              When <code className="font-mono">prefers-reduced-motion</code> is set, all non-essential
              animation must collapse to instant (50ms).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== components ================================ */

function SpecCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-4">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

/* ---- Button ---- */
function ButtonSpec() {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const variants: { name: string; node: React.ReactNode }[] = [
    { name: "Primary · gold", node: <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Start meeting</Button> },
    { name: "Secondary", node: <Button variant="secondary">Archive</Button> },
    { name: "Outline", node: <Button variant="outline">Copy link</Button> },
    { name: "Ghost", node: <Button variant="ghost">Details</Button> },
    { name: "Destructive", node: <Button variant="destructive">Delete</Button> },
    { name: "Icon only", node: <Button variant="ghost" size="icon" aria-label="Search"><Search className="size-4" /></Button> },
  ];
  return (
    <div className="space-y-4">
      <ComponentHeader
        icon={MousePointer2}
        name="Button"
        intent="Buttons convert intent into action with a single, unmistakable tap — gold primary, quiet secondary, always keyboard-reachable."
        anatomy={["Container 36–40px", "Label 14px medium", "Icon 16px (optional)", "Spinner (loading)", "Focus ring 3px gold"]}
        density={22}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <SpecCard title="Variants">
          <div className="flex flex-wrap items-center gap-2.5">
            {variants.map((v) => (
              <div key={v.name} className="flex flex-col items-start gap-1">
                {v.node}
                <span className="text-[10px] text-muted-foreground">{v.name}</span>
              </div>
            ))}
          </div>
        </SpecCard>
        <SpecCard title="States — interactive">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex flex-col items-start gap-1">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={disabled}
                onClick={() => setTimeout(() => setLoading(true), 0)}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {loading ? "Creating…" : disabled ? "Disabled" : "Create meeting"}
              </Button>
              <span className="text-[10px] text-muted-foreground">primary + loading</span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <Button variant="destructive" disabled={disabled}>Delete workspace</Button>
              <span className="text-[10px] text-muted-foreground">destructive + disabled</span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <Button variant="outline" aria-invalid={!disabled} className={cn(!disabled && "border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive")}>Retry upload</Button>
              <span className="text-[10px] text-muted-foreground">error-adjacent · destructive outline</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={disabled} onCheckedChange={setDisabled} /> Disabled
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={loading} onCheckedChange={setLoading} /> Loading
            </label>
            <button
              onClick={() => document.querySelector<HTMLButtonElement>('[data-btn-focus]')?.focus()}
              className="text-xs text-primary underline underline-offset-2"
            >
              Focus the gold button (Tab shows the ring)
            </button>
          </div>
          <div className="mt-4">
            <Button data-btn-focus className="bg-primary text-primary-foreground hover:bg-primary/90">
              Focus target
            </Button>
          </div>
        </SpecCard>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SpecCard title="State matrix (must)">
          <div className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[11px]">
            <span className="text-muted-foreground">default</span><span>Gold fill · white label · radius 10px · h-9/h-10</span>
            <span className="text-muted-foreground">hover</span><span>opacity 90% · 100ms · cursor pointer</span>
            <span className="text-muted-foreground">focus-visible</span><span>3px gold ring at 50% · never removed</span>
            <span className="text-muted-foreground">active</span><span>pressed · transform scale 0.98 (fast)</span>
            <span className="text-muted-foreground">disabled</span><span>opacity 50% · pointer-events none · no tooltip</span>
            <span className="text-muted-foreground">loading</span><span>spinner 16px replaces icon · label persists · width stable</span>
            <span className="text-muted-foreground">error</span><span>destructive variant + inline message · never silent fail</span>
          </div>
        </SpecCard>
        <SpecCard title="Interaction & edge cases">
          <ul className="space-y-1.5">
            <Rule><RuleBullet />Keyboard: Enter or Space activates; Tab reaches; focus must never be lost mid-interaction.</Rule>
            <Rule><RuleBullet />Touch: tap targets must be ≥44px on coarse pointers; icon-only buttons must expand padding to 44px.</Rule>
            <Rule><RuleBullet />Long content: labels must truncate or shorten — must not wrap to two lines; use ellipsis via shorter copy.</Rule>
            <Rule><RuleBullet />Double-submit: while loading, the button must stay disabled and keep its width.</Rule>
            <Rule><RuleBullet />Icon-only buttons must carry a descriptive <code className="font-mono text-[10px]">aria-label</code>.</Rule>
          </ul>
        </SpecCard>
      </div>
    </div>
  );
}

/* ---- Link ---- */
function LinkSpec() {
  return (
    <div className="space-y-4">
      <ComponentHeader
        icon={ArrowUpRight}
        name="Link"
        intent="Inline navigation affordance — gold, underlined, discoverable without color alone."
        anatomy={["Label 14px", "Underline offset 2px", "External icon 14px (optional)", "Focus ring 3px"]}
        density={6}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <SpecCard title="Live demo">
          <p className="text-sm leading-6 text-muted-foreground">
            Jump to your{" "}
            <a href="#foundations" className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary">design tokens</a>,{" "}
            review the{" "}
            <a href="#accessibility" className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary">accessibility gates</a>, or{" "}
            <a href="#qa" className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary">
              run the QA pass <ArrowUpRight className="inline size-3.5" />
            </a>
            .
          </p>
          <div className="mt-4 rounded-xl border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Focus test:</span> press <kbd className="rounded border border-border bg-accent px-1 py-0.5 font-mono text-[10px]">Tab</kbd> — every link must show a visible gold ring.
          </div>
        </SpecCard>
        <div className="grid gap-3">
          <SpecCard title="State matrix (must)">
            <div className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[11px]">
              <span className="text-muted-foreground">default</span><span>Gold · underline 40% opacity</span>
              <span className="text-muted-foreground">hover</span><span>underline 100% · 50ms</span>
              <span className="text-muted-foreground">focus-visible</span><span>3px ring · offset 2px</span>
              <span className="text-muted-foreground">active</span><span>gold darkened 10%</span>
              <span className="text-muted-foreground">visited</span><span>kept identical — consistency over convention</span>
            </div>
          </SpecCard>
          <SpecCard title="Rules">
            <ul className="space-y-1.5">
              <Rule><RuleBullet />Links must use descriptive labels ("View usage report"), never raw URLs or "click here".</Rule>
              <Rule><RuleBullet />External links must open in a new tab with <code className="font-mono text-[10px]">rel="noopener noreferrer"</code> and an external icon.</Rule>
              <Rule><RuleBullet />Color alone must never carry meaning — the underline must be present in all states.</Rule>
            </ul>
          </SpecCard>
        </div>
      </div>
    </div>
  );
}

/* ---- Input ---- */
function InputSpec() {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);
  return (
    <div className="space-y-4">
      <ComponentHeader
        icon={PenLine}
        name="Input"
        intent="Capture structured data with a visible label and explicit state feedback — never placeholder-as-label."
        anatomy={["Label 11px semibold", "Field h-9/10 · px-3", "Helper 12px", "Error message 12px destructive", "Counter (optional)"]}
        density={4}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <SpecCard title="Live demo">
          <div className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="ds-email" className="text-xs font-medium">Work email</label>
              <Input
                id="ds-email"
                type="email"
                value={value}
                disabled={disabled}
                aria-invalid={error}
                placeholder="you@company.com"
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(false);
                }}
              />
              {error ? (
                <p className="text-xs text-destructive">That address isn't valid — check for typos.</p>
              ) : (
                <p className="text-xs text-muted-foreground">We'll send a one-time sign-in code.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-4 border-t border-border/50 pt-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={error} onCheckedChange={setError} /> Error
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={disabled} onCheckedChange={setDisabled} /> Disabled
              </label>
            </div>
          </div>
        </SpecCard>
        <div className="grid gap-3">
          <SpecCard title="State matrix (must)">
            <div className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[11px]">
              <span className="text-muted-foreground">default</span><span>border 8% white · transparent bg</span>
              <span className="text-muted-foreground">hover</span><span>border brightens 12%</span>
              <span className="text-muted-foreground">focus-visible</span><span>3px gold ring · border gold</span>
              <span className="text-muted-foreground">active</span><span>caret gold · selection gold/white</span>
              <span className="text-muted-foreground">disabled</span><span>opacity 50% · cursor not-allowed · label remains</span>
              <span className="text-muted-foreground">error</span><span>destructive border + message · clears on input</span>
            </div>
          </SpecCard>
          <SpecCard title="Rules & edge cases">
            <ul className="space-y-1.5">
              <Rule><RuleBullet />Label must be programmatically associated (<code className="font-mono text-[10px]">htmlFor</code>/<code className="font-mono text-[10px]">aria-labelledby</code>).</Rule>
              <Rule><RuleBullet />Mobile: input font-size must stay ≥16px to prevent iOS auto-zoom.</Rule>
              <Rule><RuleBullet />Long content: fields must scroll horizontally, not grow the layout.</Rule>
              <Rule><RuleBullet />Empty state: helper text must explain what to enter, e.g. "We'll send a one-time code".</Rule>
              <Rule><RuleBullet />Errors must include guidance ("check for typos"), never just "Invalid".</Rule>
            </ul>
          </SpecCard>
        </div>
      </div>
    </div>
  );
}

/* ---- Navigation ---- */
function NavigationSpec() {
  const [activeItem, setActiveItem] = useState(1);
  const items = [
    { icon: MessageSquare, label: "Messages" },
    { icon: Video, label: "Meetings" },
    { icon: Search, label: "Search" },
    { icon: Settings, label: "Settings" },
  ];
  return (
    <div className="space-y-4">
      <ComponentHeader
        icon={Component}
        name="Navigation"
        intent="Persistent orientation through an icon rail — active section always visible, every target reachable by keyboard."
        anatomy={["Rail 68px", "Targets 44px", "Active gold indicator", "Tooltip labels", "Unread badges"]}
        density={2}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <SpecCard title="Live demo">
          <div className="flex gap-3">
            <div className="flex w-14 flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 py-2.5">
              <div className="mb-1 grid size-8 place-items-center rounded-lg bg-primary/15">
                <ShineLogo size={16} showWordmark={false} />
              </div>
              {items.map((it, i) => (
                <button
                  key={it.label}
                  onClick={() => setActiveItem(i)}
                  aria-label={it.label}
                  className={cn(
                    "grid size-11 place-items-center rounded-xl transition-all",
                    activeItem === i
                      ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1.5px_var(--gold)]"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <it.icon className="size-5" />
                </button>
              ))}
            </div>
            <div className="flex-1 rounded-xl border border-border/70 bg-background/50 p-4">
              <div className="text-sm font-semibold">{items[activeItem].label}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeItem === 0 && "Active section: unread badge must sit inside a 44px target without overflow."}
                {activeItem === 1 && "Active section: meetings list, live badge and join buttons."}
                {activeItem === 2 && "Active section: ⌘K command palette — keyboard-first by design."}
                {activeItem === 3 && "Active section: profile, theme, notifications and devices."}
              </p>
            </div>
          </div>
        </SpecCard>
        <div className="grid gap-3">
          <SpecCard title="State matrix (must)">
            <div className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[11px]">
              <span className="text-muted-foreground">default</span><span>muted grey icon · tooltip on hover</span>
              <span className="text-muted-foreground">hover</span><span>accent surface · 100ms</span>
              <span className="text-muted-foreground">focus-visible</span><span>3px gold ring on the 44px target</span>
              <span className="text-muted-foreground">active</span><span>gold icon · gold tint 15% · inset ring 25%</span>
              <span className="text-muted-foreground">unread</span><span>gold badge · min 16px · caps at "99+"</span>
            </div>
          </SpecCard>
          <SpecCard title="Rules & edge cases">
            <ul className="space-y-1.5">
              <Rule><RuleBullet />Keyboard: Tab moves between targets; no focus trap; skip-link must jump past the rail on every page.</Rule>
              <Rule><RuleBullet />Touch: every target must be ≥44px — the rail must never shrink targets below that on phones.</Rule>
              <Rule><RuleBullet />Overflow: more than 8 items must scroll vertically inside the rail, never reflow the app.</Rule>
              <Rule><RuleBullet />Labels must exist for every icon (tooltip on desktop, <code className="font-mono text-[10px]">aria-label</code> always).</Rule>
            </ul>
          </SpecCard>
        </div>
      </div>
    </div>
  );
}

/* ---- List ---- */
function ListSpec() {
  const [selected, setSelected] = useState(0);
  const [empty, setEmpty] = useState(false);
  const rows = [
    { name: "Ava Chen", preview: "Ship the Q3 report by Friday?", time: "2m", unread: 3, online: true },
    { name: "Platform Team", preview: "Rhea: I'll draft the migration plan", time: "1h", unread: 0, online: false },
    { name: "Marco Silva", preview: "📎 brand-assets.zip", time: "3h", unread: 0, online: false },
  ];
  return (
    <div className="space-y-4">
      <ComponentHeader
        icon={MessageSquare}
        name="List"
        intent="Scannable rows of related items with identity, preview, presence and unread state."
        anatomy={["Avatar 40px", "Title 14px medium", "Preview 12px muted", "Meta 10px", "Unread badge"]}
        density={2}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <SpecCard title="Live demo">
          <div className="rounded-xl border border-border/70 bg-background/50 p-2">
            {empty ? (
              <div className="px-4 py-12 text-center">
                <MessageSquare className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="mt-1 text-xs text-muted-foreground/80">Start one to see it here.</p>
              </div>
            ) : (
              rows.map((r, i) => (
                <button
                  key={r.name}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all",
                    selected === i
                      ? "bg-primary/12 shadow-[inset_0_0_0_1.5px_var(--gold)]"
                      : "hover:bg-accent/60",
                  )}
                >
                  <div className="relative size-10 shrink-0 rounded-full bg-gradient-to-br from-primary/60 to-primary/25">
                    <span className="grid h-full w-full place-items-center text-sm font-semibold text-primary-foreground">
                      {r.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    {r.online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{r.time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{r.preview}</span>
                      {r.unread > 0 && (
                        <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {r.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={empty} onCheckedChange={setEmpty} /> Empty state
          </label>
        </SpecCard>
        <div className="grid gap-3">
          <SpecCard title="State matrix (must)">
            <div className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[11px]">
              <span className="text-muted-foreground">default</span><span>avatar + title + preview · row min 56px</span>
              <span className="text-muted-foreground">hover</span><span>accent surface · 100ms</span>
              <span className="text-muted-foreground">selected</span><span>gold tint 12% · inset ring 25%</span>
              <span className="text-muted-foreground">focus-visible</span><span>3px gold ring on the whole row</span>
              <span className="text-muted-foreground">loading</span><span>skeleton shimmer (2–4 rows) · no flash of empty</span>
              <span className="text-muted-foreground">empty</span><span>icon + copy + primary CTA</span>
            </div>
          </SpecCard>
          <SpecCard title="Rules & edge cases">
            <ul className="space-y-1.5">
              <Rule><RuleBullet />Keyboard: rows must be focusable; Enter/Space opens; Home/End and Arrow keys move when in a listbox pattern.</Rule>
              <Rule><RuleBullet />Touch: row height must stay ≥48px on mobile for reliable taps.</Rule>
              <Rule><RuleBullet />Long titles/previews must truncate with ellipsis — never wrap into multi-line rows.</Rule>
              <Rule><RuleBullet />Unread counts must cap ("99+") so badges never overflow their target.</Rule>
            </ul>
          </SpecCard>
        </div>
      </div>
    </div>
  );
}

function ComponentHeader({
  icon: Icon,
  name,
  intent,
  anatomy,
  density,
}: {
  icon: React.ElementType;
  name: string;
  intent: string;
  anatomy: string[];
  density: number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary">
            <Icon className="size-4" />
          </span>
          <h3 className="text-base font-bold">{name}</h3>
          <Badge className="bg-accent text-muted-foreground">{density} per page</Badge>
        </div>
      </div>
      <p className="mt-2.5 text-[13px] leading-5 text-muted-foreground">{intent}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {anatomy.map((a) => (
          <span key={a} className="rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground">
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================== accessibility ============================== */

function AccessibilitySpec() {
  const rows = [
    { rule: "Text contrast", check: "Body text ≥ 4.5:1 · large text ≥ 3:1 against every adjacent surface (ink #121212 on pink #FF4FA3 passes 6.2:1, and so does pink on ink).", pass: "axe-core color-contrast reports zero violations.", fail: "Any muted text at 11px dropping below 4.5:1, or placeholder-only labels." },
    { rule: "Focus visibility", check: "Every interactive element shows a 3px gold ring at 50% opacity when keyboard-focused.", pass: "Tab through the full page; ring visible on every stop, never clipped.", fail: "outline:none without a visible replacement; ring hidden by overflow." },
    { rule: "Target size (WCAG 2.2)", check: "Pointer targets ≥ 24×24px minimum; touch targets ≥ 44×44px on coarse pointers.", pass: "DevTools touch emulation — every control ≥ 44px.", fail: "Icon-only buttons smaller than 44px without padded hit area." },
    { rule: "Keyboard operability", check: "Every action reachable and operable by keyboard; no focus traps.", pass: "Full journey with Tab / Shift+Tab / Enter / Space / Esc; focus order matches visual order.", fail: "Trapped modals, unreachable controls, dead Enter on buttons." },
    { rule: "Programmatic labels", check: "Inputs, icons and landmarks carry names: label, aria-label, aria-labelledby.", pass: "axe-core label + name assertions pass; screen reader announces each control.", fail: "Placeholder-as-label; icon-only buttons without aria-label." },
    { rule: "Reduced motion", check: "prefers-reduced-motion collapses animations to instant (50ms) flips.", pass: "OS 'reduce motion' on — no looped or large motion persists.", fail: "Infinite shimmer/spinners, 300ms slides still running under reduced motion." },
    { rule: "Status messages", check: "Loading and errors are announced — aria-live regions for async states.", pass: "Screen reader hears 'Uploading…' and 'That code is invalid.'", fail: "Errors rendered without live regions; silent failures." },
    { rule: "Landmarks & navigation", check: "One main, one header, one nav per view; skip-link jumps past the rail.", pass: "Keyboard: first Tab activates the skip link; landmarks unique.", fail: "Duplicate mains; no way to bypass repeated navigation." },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card/40 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          SHINE targets <span className="font-medium text-foreground">WCAG 2.2 AA</span>. Every rule below is
          testable in implementation with a concrete pass/fail check — accessibility acceptance criteria
          must be part of the definition of done for every component.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.rule} className="glass hairline rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" /> {r.rule}
              </span>
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">AA</span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{r.check}</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="size-3" /> Pass
                </div>
                <p className="leading-5 text-muted-foreground">{r.pass}</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                  <XCircle className="size-3" /> Fail
                </div>
                <p className="leading-5 text-muted-foreground">{r.fail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== content =================================== */

function ContentSpec() {
  const pairs = [
    { good: "Create meeting", bad: "Go ahead and make a new meeting now" },
    { good: "Save", bad: "Submit this form to save your changes" },
    { good: "That code is invalid — request a new one.", bad: "Error 400: invalid input" },
    { good: "Download usage report", bad: "Click here" },
    { good: "Mute", bad: "Toggle audio output state" },
    { good: "No conversations yet — start one.", bad: "Empty" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card/40 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Tone: <span className="font-medium text-foreground">concise, confident, implementation-focused</span>.
          Interface copy must state the action or outcome — never describe the mechanics. Use verbs for
          actions, nouns for destinations.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="border-b border-border/70 bg-emerald-500/5 p-4 sm:border-r">
            <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              <Check className="size-3" /> Do
            </div>
            <div className="space-y-2.5">
              {pairs.map((p) => (
                <div key={p.good} className="rounded-xl border border-emerald-500/20 bg-background/50 p-2.5 text-[13px]">
                  {p.good}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-rose-500/5 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-rose-400">
              <XCircle className="size-3" /> Don't
            </div>
            <div className="space-y-2.5">
              {pairs.map((p) => (
                <div key={p.bad} className="rounded-xl border border-rose-500/20 bg-background/50 p-2.5 text-[13px] text-muted-foreground line-through decoration-rose-400/50">
                  {p.bad}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { t: "Buttons", d: "Verb + object. 2 words where possible: 'Start meeting', 'Copy link', 'Save'." },
          { t: "Links", d: "Destination nouns: 'Usage report', not 'click here' or raw URLs." },
          { t: "Errors", d: "What went wrong + what to do next. Never just a status code." },
        ].map((c) => (
          <div key={c.t} className="glass hairline rounded-2xl p-4">
            <div className="text-sm font-semibold">{c.t}</div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== anti-patterns ============================= */

function AntiPatterns() {
  const items = [
    { t: "Raw hex in components", d: "Components must reference semantic tokens (var(--primary)), never hard-coded #FF4FA3. One-off values break theming and light mode.", fix: "Map any new color to a semantic token in src/index.css first." },
    { t: "Hidden focus indicators", d: "outline:none without a visible gold ring must not ship. Keyboard users must never guess where focus is.", fix: "Keep the 3px ring; remove outline only by replacing it." },
    { t: "One-off spacing & type", d: "Arbitrary padding (17px) or font sizes (15px) must not appear. The spacing scale and type scale are closed sets.", fix: "Round to the nearest space.* token and type step." },
    { t: "Ambiguous labels", d: "'Click here', 'More…' without context, or icon-only buttons without aria-labels are prohibited.", fix: "Describe the action or destination explicitly." },
    { t: "States shipped incomplete", d: "A component without explicit disabled, loading, error and empty behavior must not enter the codebase.", fix: "Fill the full state matrix before building." },
    { t: "Low-contrast text", d: "Muted text below 4.5:1 on its surface, or disabled states that readers can't parse, are prohibited.", fix: "Verify contrast in both themes at every state." },
    { t: "Placeholder-as-label", d: "Placeholders disappear on input — they must not carry the only field description.", fix: "Always render a visible, associated label." },
    { t: "Unrestrained motion", d: "Loops, 500ms slides and parallax without a prefers-reduced-motion guard must not ship.", fix: "Gate non-essential animation behind the media query." },
  ];
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.t} className="glass hairline rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-rose-500/12 text-rose-400">
              <AlertTriangle className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Must not — {a.t}</div>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{a.d}</p>
              <p className="mt-1.5 text-xs text-primary">
                <span className="font-medium">Fix:</span> {a.fix}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================== QA ======================================== */

const QA_GROUPS = [
  {
    label: "Foundations",
    items: [
      "All colors reference semantic tokens — zero raw hex in components",
      "Type, spacing and radius come from the closed token scales",
      "Motion durations use instant/fast/base/slow and honor reduced motion",
    ],
  },
  {
    label: "Components",
    items: [
      "Every interactive component defines default, hover, focus-visible, active, disabled, loading and error states",
      "Icon-only controls carry descriptive aria-labels and ≥44px touch targets",
      "Empty, overflow and long-content cases are handled (truncation, caps, CTAs)",
      "Keyboard path verified: Tab, Enter/Space, Escape, arrows — no traps",
    ],
  },
  {
    label: "Accessibility",
    items: [
      "axe-core scan reports zero violations (contrast, labels, landmarks)",
      "Focus ring visible on every stop; skip-link present on app shell",
      "Touch emulation: all targets ≥44px on mobile breakpoints",
      "Status changes announced via aria-live regions",
    ],
  },
  {
    label: "Responsive",
    items: [
      "Verified on desktop, laptop, tablet, Android and small phones (320px+)",
      "No horizontal scroll at 320px; navigation collapses without losing targets",
      "Text sizes stay ≥11px and inputs ≥16px on touch",
    ],
  },
];

function QaChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const all = QA_GROUPS.flatMap((g) => g.items);
  const done = all.filter((i) => checked[i]).length;
  const pct = Math.round((done / all.length) * 100);
  return (
    <div className="space-y-4">
      <div className="glass hairline rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Release gate</div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {done}/{all.length} · {pct}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent">
          <motion.div
            className="h-full rounded-full bg-primary transition-all duration-300"
            animate={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          A component must not ship until its checklist passes. {pct === 100 ? "All gates green — ship it. ✨" : "Keep going."}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {QA_GROUPS.map((g) => (
          <div key={g.label} className="glass hairline rounded-2xl p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</div>
            <div className="space-y-2">
              {g.items.map((item) => (
                <label key={item} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 text-[13px] leading-5 transition-colors hover:bg-accent/50">
                  <Checkbox
                    checked={!!checked[item]}
                    onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [item]: !!v }))}
                    className="mt-0.5"
                  />
                  <span className={cn(checked[item] && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
