import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShineLogo } from "@/components/ShineLogo";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Building2,
  FileStack,
  Gauge,
  Globe2,
  Headset,
  KeyRound,
  LayoutGrid,
  Lock,
  MessagesSquare,
  Mic,
  MonitorPlay,
  Play,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { useRef } from "react";
import { Link, useNavigate } from "react-router";

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "Enterprise messaging",
    desc: "Realtime 1:1, group, team and broadcast channels with threads, reactions, read receipts and typing presence — built for millions.",
  },
  {
    icon: Video,
    title: "HD calls & meetings",
    desc: "Crystal-clear audio and video with screen sharing, backgrounds, live captions, recording and breakout-ready rooms.",
  },
  {
    icon: Bot,
    title: "Shine AI assistant",
    desc: "Summarize chats and meetings, draft replies, translate in-line and extract action items — natively embedded in your flow.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise security",
    desc: "End-to-end encryption options, SSO, SCIM provisioning, device trust, audit logs and full compliance tooling.",
  },
  {
    icon: Building2,
    title: "Organizations",
    desc: "Orgs, departments, teams and projects with granular roles, permissions and a live company directory.",
  },
  {
    icon: FileStack,
    title: "Unified file system",
    desc: "Drag-and-drop uploads, folders, versioning and previews for images, PDFs, office docs, video and audio.",
  },
  {
    icon: Gauge,
    title: "Realtime engine",
    desc: "WebSocket-grade presence, optimistic updates, virtualized lists and infinite scroll. Everything updates instantly.",
  },
  {
    icon: KeyRound,
    title: "Admin & analytics",
    desc: "A full admin panel with DAU/MAU, message and call analytics, audit logs and system health monitoring.",
  },
];

function MockChat() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* glow */}
      <div className="absolute -inset-x-10 -top-10 h-64 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.16),transparent_65%)] blur-2xl" />
      <div className="glass-strong hairline relative overflow-hidden rounded-3xl shadow-2xl">
        <div className="flex">
          {/* rail */}
          <div className="hidden w-14 flex-col items-center gap-1.5 border-r border-border/70 py-4 sm:flex">
            {[LayoutGrid, MessagesSquare, Video, FileStack, Bot, Users].map((I, i) => (
              <div
                key={i}
                className={`grid size-9 place-items-center rounded-xl transition-colors ${
                  i === 1 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <I className="size-4" />
              </div>
            ))}
          </div>
          {/* conversation list */}
          <div className="hidden w-60 flex-col border-r border-border/70 p-3 md:flex">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-foreground">Messages</span>
              <Badge className="bg-primary/15 text-primary hover:bg-primary/20">12</Badge>
            </div>
            {[
              { n: "Amara Chen", m: "Ship the announcement 🚀", on: true },
              { n: "Growth Team", m: "Daniel: KPI deck is in files", on: true },
              { n: "Deploy Watch", m: "v2.4.1 is live in production", on: true },
              { n: "Omar Haddad", m: "Can you review the PR?", on: false },
            ].map((c, i) => (
              <div
                key={i}
                className={`mb-1 rounded-xl p-2.5 transition-colors ${
                  i === 0 ? "bg-primary/10" : "hover:bg-accent/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg,#d4af37,${i % 2 ? "#5a4a12" : "#35353d"})` }}
                  >
                    {c.n.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-semibold">{c.n}</span>
                      {c.on && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{c.m}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* chat */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#f2d469] to-[#9a7b1e] text-xs font-bold text-black">
                  AC
                </div>
                <div>
                  <div className="text-sm font-semibold">Amara Chen</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> Online
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <div className="grid size-8 place-items-center rounded-lg hover:bg-accent">
                  <Video className="size-4" />
                </div>
                <div className="grid size-8 place-items-center rounded-lg hover:bg-accent">
                  <Search className="size-4" />
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 px-4 py-4">
              <div className="mx-auto rounded-full bg-accent/70 px-3 py-1 text-[10px] text-muted-foreground">
                Today
              </div>
              <div className="max-w-[75%] self-start rounded-2xl rounded-bl-sm bubble-in p-3">
                <p className="text-[13px] leading-5">Morning! Did the numbers for Q3 land yet?</p>
                <div className="mt-1 text-right text-[10px] text-muted-foreground">9:41</div>
              </div>
              <div className="max-w-[75%] self-end rounded-2xl rounded-br-sm bubble-out p-3">
                <p className="text-[13px] leading-5 text-foreground">
                  Yes — revenue is up 38% and the board deck is ready. Sending it over 🎉
                </p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-primary/70">
                  9:43 <span className="text-primary">✓✓</span>
                </div>
              </div>
              <div className="flex items-center gap-1 self-end text-[10px] text-muted-foreground">
                <span className="rounded-md bg-accent/70 px-1 py-0.5">👍</span>
                <span className="rounded-md bg-accent/70 px-1 py-0.5">🎉</span>
                <span className="text-[11px]">Amara is typing…</span>
              </div>
              <div className="mt-auto rounded-xl border border-border/80 bg-background/60 px-3 py-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-sm">＋</span>
                  <span className="flex-1 text-xs text-muted-foreground/70">
                    Message Amara…
                  </span>
                  <Mic className="size-4" />
                  <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* floating call chip */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="glass-strong hairline absolute -right-4 top-16 hidden w-52 rounded-2xl p-3 shadow-2xl lg:block"
      >
        <div className="flex items-center gap-2">
          <div className="relative grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#f2d469] to-[#9a7b1e]">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <Video className="size-4 text-black" />
          </div>
          <div>
            <div className="text-xs font-semibold">Standup — live</div>
            <div className="text-[10px] text-muted-foreground">6 participants · 23:41</div>
          </div>
        </div>
      </motion.div>
      {/* floating AI chip */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        className="glass-strong hairline absolute -left-6 bottom-14 hidden w-56 rounded-2xl p-3 shadow-2xl lg:block"
      >
        <div className="flex items-start gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-xs font-semibold">Shine AI</div>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              3 action items extracted from the chat — create tasks?
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                Create tasks
              </span>
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[9px] text-muted-foreground">
                Dismiss
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const pricingRef = useRef<HTMLDivElement>(null);
  const pricingInView = useInView(pricingRef, { once: true });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[540px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.09),transparent_65%)] blur-3xl" />
        <div className="absolute right-[-200px] top-1/3 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.05),transparent_70%)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
          }}
        />
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-50">
        <div className="glass border-b border-border/60">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="transition-opacity hover:opacity-85">
              <ShineLogo />
            </Link>
            <nav className="hidden items-center gap-1 text-sm text-muted-foreground lg:flex">
              {[
                { label: "Product", href: "#product" },
                { label: "Features", href: "#features" },
                { label: "Security", href: "#security" },
                { label: "Enterprise", href: "#enterprise" },
              ].map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-foreground"
                onClick={() => navigate("/auth")}
              >
                Sign in
              </Button>
              <Button
                onClick={() => navigate("/auth")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-8px_rgba(212,175,55,0.6)]"
              >
                Get started <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-medium text-primary"
          >
            <Sparkles className="size-3.5" />
            The all-in-one enterprise communication platform
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Powered by DEJOIY</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mx-auto max-w-4xl text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Every conversation.
            <br />
            <span className="gold-text">Every meeting. Every team.</span>
            <br />
            One place.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
          >
            SHINE unifies messaging, HD voice & video calls, meetings, files, tasks and AI —
            engineered at enterprise scale with bank-grade security. Built to replace every
            tool in your stack.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button
              size="lg"
              className="h-12 px-7 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_12px_40px_-10px_rgba(212,175,55,0.65)]"
              onClick={() => navigate("/auth")}
            >
              <Rocket className="size-4" /> Start for free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-7 text-base"
              onClick={() => navigate("/auth")}
            >
              <Play className="size-4" /> Explore the product
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-primary" /> SOC 2 · ISO 27001 ready</span>
            <span className="flex items-center gap-1.5"><Zap className="size-3.5 text-primary" /> Realtime by default</span>
            <span className="flex items-center gap-1.5"><Globe2 className="size-3.5 text-primary" /> 99.99% uptime</span>
            <span className="flex items-center gap-1.5"><Star className="size-3.5 text-primary" /> Loved by 12,000+ teams</span>
          </motion.div>
        </div>

        {/* product mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"
        >
          <MockChat />
        </motion.div>
      </section>

      {/* logos */}
      <section className="border-y border-border/60 bg-card/40 py-10">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Trusted by engineering teams at
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 text-muted-foreground opacity-70">
            {["NORTHWIND", "HELIOS LABS", "VERTEX", "OAKLINE", "NEBULA", "STRATUM", "QUANTA"].map((n) => (
              <span key={n} className="text-sm font-bold tracking-[0.2em]">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15">Platform</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              One platform. <span className="gold-text">Every capability.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Slack-style channels, WhatsApp-grade direct messaging, Zoom-quality meetings,
              Discord-grade voice rooms and a full enterprise suite — without the sprawl.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 0.07}>
                <div className="group card-hover glass hairline relative h-full overflow-hidden rounded-2xl p-6">
                  <div className="absolute -right-8 -top-8 size-24 rounded-full bg-primary/8 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
                  <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-110">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT DEEP DIVE */}
      <section id="product" className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15">Meetings</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Meetings that feel <span className="gold-text">like they're in the room.</span>
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                HD video, adaptive bitrate, noise suppression and echo cancellation keep every
                call crisp. Raise hands, live captions, breakout rooms, recording, meeting
                lobby and waiting rooms — all built in.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  ["Video & screen share", "Share windows, apps or your full desktop in one click."],
                  ["Live captions & AI notes", "Automatic transcripts and Shine AI summaries."],
                  ["Lobby & waiting room", "Host-controlled entry with meeting passwords."],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <CheckIcon />
                    </span>
                    <span>
                      <span className="font-medium">{t}</span> — <span className="text-muted-foreground">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="glass-strong hairline relative overflow-hidden rounded-3xl shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-400/80" />
                    <span className="size-2 rounded-full bg-amber-400/80" />
                    <span className="size-2 rounded-full bg-emerald-400/80" />
                    <span className="ml-2 text-xs text-muted-foreground">Weekly All-hands · 28:14</span>
                  </div>
                  <Badge className="bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/20">LIVE</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {[
                    { name: "Amara Chen", grad: "from-[#f2d469] to-[#9a7b1e]", self: false },
                    { name: "You", grad: "from-[#3a3a42] to-[#141418]", self: true },
                    { name: "Omar Haddad", grad: "from-[#55555f] to-[#1c1c22]", self: false },
                    { name: "Priya N.", grad: "from-[#6b5415] to-[#2a210a]", self: false },
                  ].map((p, i) => (
                    <div key={i} className="relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-black/40">
                      <div className={`absolute inset-0 bg-gradient-to-br ${p.grad} opacity-40`} />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
                        <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
                          {p.name}
                        </span>
                        <span className="flex items-center gap-1">
                          {i === 1 ? <Mic className="size-3 text-rose-400" /> : <Mic className="size-3 text-emerald-400" />}
                          {p.self && <Video className="size-3 text-emerald-400" />}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 border-t border-border/70 p-3">
                  {[Mic, Video, MonitorPlay, Headset, Sparkles].map((I, i) => (
                    <div key={i} className={`grid size-10 place-items-center rounded-xl ${i === 2 ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                      <I className="size-4" />
                    </div>
                  ))}
                  <div className="ml-auto grid size-10 place-items-center rounded-xl bg-rose-500/90 text-white">
                    <Play className="size-4 rotate-180" />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="glass hairline relative overflow-hidden rounded-3xl p-8 sm:p-14">
            <div className="absolute -right-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Reveal>
                  <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15">Security</Badge>
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Enterprise-grade <span className="gold-text">by default.</span>
                  </h2>
                  <p className="mt-4 leading-7 text-muted-foreground">
                    SHINE is built for regulated industries. Role-based access control, SSO,
                    SCIM provisioning, device trust, audit logs and granular data retention —
                    everything an IT team expects, baked into the core.
                  </p>
                </Reveal>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {[
                    ["E2E encryption", "Private chats with optional end-to-end mode"],
                    ["SSO & SCIM", "SAML, OIDC and automated provisioning"],
                    ["Audit logs", "Every action, searchable & exportable"],
                    ["Device trust", "Sessions, biometrics & remote revoke"],
                  ].map(([t, d], i) => (
                    <Reveal key={t} delay={i * 0.06}>
                      <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                        <ShieldCheck className="mb-2 size-5 text-primary" />
                        <div className="text-sm font-semibold">{t}</div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">{d}</div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
              <Reveal delay={0.1}>
                <div className="relative mx-auto max-w-md">
                  <div className="absolute inset-0 rounded-3xl bg-primary/15 blur-2xl" />
                  <div className="glass-strong hairline relative rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Security center</div>
                      <Badge className="bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/20">All systems pass</Badge>
                    </div>
                    <div className="mt-5 space-y-4">
                      {[
                        ["Transport encryption", "TLS 1.3 · everywhere", 100],
                        ["At-rest encryption", "AES-256 · S3 + local", 100],
                        ["WebRTC media", "SRTP · DTLS-SRTP", 100],
                        ["Rate limiting", "Active", 100],
                      ].map(([t, d, v], i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{t}</span>
                            <span className="text-muted-foreground">{d}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${v}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                              className="h-full rounded-full bg-gradient-to-r from-[#9a7b1e] to-[#f2d469]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center justify-between rounded-xl bg-background/60 p-3 text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <KeyRound className="size-4 text-primary" /> Last security audit
                      </span>
                      <span className="font-medium">7 days ago · passed</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ENTERPRISE */}
      <section id="enterprise" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15">Enterprise</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the <span className="gold-text">fleet.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Admin panels, analytics, compliance and self-hosted deployment — SHINE scales
              from a 5-person startup to a 100,000-seat enterprise.
            </p>
          </Reveal>
          <div ref={pricingRef} className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              {
                name: "Team",
                price: "$0",
                period: "forever",
                desc: "For small teams getting started.",
                items: ["Unlimited messaging & calls", "Up to 25 participants/meeting", "10 GB file storage", "Core AI assistant"],
                featured: false,
              },
              {
                name: "Business",
                price: "$8",
                period: "per seat / month",
                desc: "For growing companies that need control.",
                items: ["Everything in Team", "Unlimited meeting participants", "1 TB file storage + S3", "SSO, SCIM & audit logs", "Priority support"],
                featured: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "tailored",
                desc: "For regulated, large-scale deployments.",
                items: ["Everything in Business", "Self-hosted / VPC deployment", "Dedicated TURN & media edge", "SLA, DPA & compliance", "Dedicated success team"],
                featured: false,
              },
            ].map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08} className={p.featured ? "md:-mt-4" : ""}>
                <div
                  className={`relative h-full rounded-2xl p-7 ${
                    p.featured
                      ? "glass-strong hairline ring-glow bg-card"
                      : "glass hairline"
                  }`}
                >
                  {p.featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Most popular
                    </Badge>
                  )}
                  <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{p.name}</div>
                  <div className="mt-3 flex items-end gap-1.5">
                    <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                    <span className="pb-1 text-xs text-muted-foreground">{p.period}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{p.desc}</p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                          <CheckIcon />
                        </span>
                        {it}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`mt-8 w-full ${p.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                    variant={p.featured ? "default" : "outline"}
                    onClick={() => navigate("/auth")}
                  >
                    {p.name === "Enterprise" ? "Talk to sales" : "Start free"} <ArrowRight className="size-4" />
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
          {pricingInView && <div className="sr-only">pricing loaded</div>}
        </div>
      </section>

      {/* CTA */}
      <section className="relative pb-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal>
            <div className="glass-strong hairline ring-glow relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_60%)]" />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
                  Your team deserves <span className="gold-text">one platform.</span>
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                  Join thousands of teams running messaging, calls, meetings and AI on SHINE.
                  Set up in under two minutes.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_12px_40px_-10px_rgba(212,175,55,0.65)]"
                    onClick={() => navigate("/auth")}
                  >
                    <Rocket className="size-4" /> Get started free
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 text-base"
                    onClick={() => navigate("/auth")}
                  >
                    Book an enterprise demo
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <ShineLogo />
              <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
                The enterprise communication ecosystem. Messaging, meetings, files, tasks and AI —
                powered by the DEJOIY platform.
              </p>
            </div>
            {[
              { h: "Product", links: ["Messaging", "Voice & Video", "Meetings", "Files", "Shine AI", "Integrations"] },
              { h: "Enterprise", links: ["Security", "Admin console", "SSO & SCIM", "Audit logs", "Compliance", "Self-hosting"] },
              { h: "Company", links: ["About", "Careers", "Press", "Blog", "Status", "Contact"] },
            ].map((col) => (
              <div key={col.h}>
                <div className="text-sm font-semibold">{col.h}</div>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" onClick={(e) => e.preventDefault()} className="transition-colors hover:text-foreground">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} DEJOIY · SHINE. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-foreground">Privacy</a>
              <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-foreground">Terms</a>
              <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-foreground">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none">
      <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
