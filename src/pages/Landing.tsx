import { ShineMark } from "@/components/ShineLogo";
import { useAuth } from "@/hooks/use-auth";
import { DEJOIY_MAIL_URL, dejoiyMailSignInUrl } from "@/lib/embed";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import "./landing.css";

/*
 * Shine's landing page. Direction "Loud and flat": every chapter is one flat
 * field in one of Shine's chat colours, because every chat in Shine has its own.
 * The live thing is the board of chats: open one, type a reply, watch it land.
 * The chats on the board are a demo, not real people's messages.
 */

type Chat = { name: string; short: string; kind: string; state: string; tone: string; thread: [string, string][] };

const CHATS: Chat[] = [
  { name: "Launch squad", short: "LS", kind: "Group · 4 people", state: "3 new", tone: "#ff4fa3", thread: [["Priya", "Final poster is up. Pink or yellow?"], ["Kabir", "Pink. Obviously."]] },
  { name: "Rahul Mehta", short: "RM", kind: "Direct", state: "1 new", tone: "#ffd23f", thread: [["Rahul", "Can we move the call to 4?"]] },
  { name: "#announcements", short: "#", kind: "Channel · everyone", state: "Seen", tone: "#4da3ff", thread: [["Meera", "Office is closed on Friday for Diwali."]] },
  { name: "Design crit", short: "DC", kind: "Group · 5 people", state: "2 new", tone: "#3ddc84", thread: [["Ananya", "Dropped the new home screen in Files."], ["Arjun", "The colour cards are so good."]] },
  { name: "Priya Nair", short: "PN", kind: "Direct", state: "Seen", tone: "#b892ff", thread: [["Priya", "Sending the deck tonight."]] },
  { name: "Finance", short: "FI", kind: "Group · 3 people", state: "Seen", tone: "#ff8a3d", thread: [["Meera", "October invoices are done."]] },
  { name: "Kabir Singh", short: "KS", kind: "Direct", state: "1 new", tone: "#ff4fa3", thread: [["Kabir", "Printer says 2 hours for 500 copies."]] },
  { name: "Sales, North", short: "SN", kind: "Channel · 12 people", state: "Seen", tone: "#ffd23f", thread: [["Ishaan", "Two demos booked for Monday."]] },
];

const STAGES = [
  { name: "Open Dejoiy Mail", text: "Sign in to mail.dejoiy.com, like every morning.", c: "#7a1047", fg: "#fffbf7" },
  { name: "Tap Chat", text: "The pink Chat button opens Shine right beside your inbox. On a phone it's the Chat tab.", c: "#b3185f", fg: "#fffbf7" },
  { name: "You're in", text: "No second password. Shine knows it's you because Dejoiy Mail does.", c: "#e0337f", fg: "#121212" },
  { name: "Everyone's here", text: "Everyone with a mailbox at your company is already in Shine, with their mailbox photo. Admins stay admins.", c: "#ff7bb9", fg: "#121212" },
  { name: "Meet", text: "Schedule a call and it lands on your Mail calendar, with the invites sent for you.", c: "#ffc2de", fg: "#121212" },
];

const COMMANDS: { name: string; say: string; keys?: string[] }[] = [
  { name: "Search everything", say: "Chats, people, files and messages, from one box.", keys: ["⌘", "K"] },
  { name: "Message a person", say: "Direct chats with anyone in your company, with read receipts and replies." },
  { name: "Start a group", say: "Bring a few people together, give it a name, choose who can post." },
  { name: "Post in a channel", say: "Team-wide channels, one-way broadcasts and announcements only admins post in." },
  { name: "Call or meet", say: "Voice and video calls, screen sharing, and meetings with their own room code." },
  { name: "Share a file", say: "Drop files into a chat; they stay in that chat's Files." },
  { name: "Track a task", say: "Turn a conversation into tasks with an owner and a due date." },
  { name: "Ask Shine AI", say: "A summary of a long chat, or help writing the reply.", keys: ["⌘", "J"] },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const start = isAuthenticated ? "/app/chats" : "/auth";

  // entrances + the corner bar taking the ink of the chapter under it
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.classList.add("js");
    requestAnimationFrame(() => el.classList.add("ready"));
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), reveal.unobserve(e.target))),
      { rootMargin: "0px 0px -10% 0px" },
    );
    el.querySelectorAll("[data-in]").forEach((n) => reveal.observe(n));
    const chapters = [...el.querySelectorAll<HTMLElement>("[data-ink]")];
    const paint = () => {
      const under = chapters.find((c) => {
        const r = c.getBoundingClientRect();
        return r.top <= 36 && r.bottom > 36;
      });
      if (under) {
        el.style.setProperty("--bar-ink", under.dataset.ink!);
        el.style.setProperty("--bar-ground", under.dataset.ground!);
      }
    };
    paint();
    addEventListener("scroll", paint, { passive: true });
    return () => {
      reveal.disconnect();
      removeEventListener("scroll", paint);
    };
  }, []);

  return (
    <div className="sl" ref={root}>
      <header className="sl-bar">
        <Link to="/" className="sl-word" aria-label="Shine home">
          <ShineMark size={34} /> Shine
        </Link>
        <Link to={start} className="sl-btn">
          {isAuthenticated ? "Open Shine" : "Sign in"}
        </Link>
      </header>

      <main>
        <section className="sl-hero" data-ink="#121212" data-ground="#ff4fa3" aria-label="Shine">
          <h1>
            <span className="pale">hey</span>
            <span className="dark">team!</span>
          </h1>
          <div className="sl-hero-mark" aria-hidden="true">
            <ShineMark size={132} />
          </div>
          {/* Shine as it opens inside Dejoiy Mail's chat panel */}
          <div className="sl-peek" data-ui aria-hidden="true">
            <div className="sl-peek-head">
              <ShineMark size={26} /> Shine
            </div>
            {CHATS.slice(0, 4).map((c) => (
              <div key={c.name} className="sl-peek-row" style={{ "--t": c.tone } as CSSProperties}>
                <b>{c.name}</b>
                <span>{c.thread[c.thread.length - 1][1]}</span>
              </div>
            ))}
          </div>
          <div className="sl-hero-side">
            <p data-in>
              Shine is Dejoiy's chat, calls and meetings app. It runs on your Dejoiy Mail account, so your whole company is already here.
            </p>
            <Link to={start} className="sl-btn" data-in style={{ "--d": 1 } as CSSProperties}>
              Start chatting
            </Link>
          </div>
        </section>

        <Board />

        <section className="sl-how" data-ink="#121212" data-ground="#fffbf7">
          <div className="sl-how-intro">
            <h2 data-in>Same login as mail.</h2>
            <p data-in style={{ "--d": 1 } as CSSProperties}>
              Shine uses your Dejoiy Mail mailbox: the same email, the same password, the same company. Nothing new to set up, nobody to invite.
            </p>
          </div>
          <Stages />
        </section>

        <Commands />

        <FirstStep start={start} isAuthenticated={isAuthenticated} onGo={(to) => navigate(to)} />
      </main>

      <footer className="sl-foot" data-ink="#fffbf7" data-ground="#121212">
        <div className="sl-foot-top">
          <div>
            <h2 data-in>Bring the whole team.</h2>
            <Link to={start} className="sl-btn on-dark" data-in style={{ "--d": 1 } as CSSProperties}>
              Open Shine
            </Link>
          </div>
          <nav className="sl-foot-links" aria-label="More from Dejoiy" data-in style={{ "--d": 2 } as CSSProperties}>
            <a href={DEJOIY_MAIL_URL}>Dejoiy Mail</a>
            <a href="https://dejoiy.com">dejoiy.com</a>
            <a href={`${DEJOIY_MAIL_URL}/terms`}>Terms</a>
            <a href={`${DEJOIY_MAIL_URL}/privacy`}>Privacy</a>
          </nav>
        </div>
        <div className="sl-legal">
          <span>© 2026 Dejoiy India Private Limited, New Delhi</span>
          <span>Shine comes with every Dejoiy Mail mailbox</span>
        </div>
        <div className="sl-giant" aria-hidden="true">
          shine
        </div>
      </footer>
    </div>
  );
}

/** The live thing: your chats as a board, each in its own colour. Open one and reply. */
function Board() {
  const [open, setOpen] = useState(3);
  const [threads, setThreads] = useState(() => CHATS.map((c) => c.thread.map(([from, text]) => ({ from, text, mine: false }))));
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 140);
    if (!text) return;
    const at = open;
    setThreads((t) => t.map((th, i) => (i === at ? [...th, { from: "You", text, mine: true }] : th)));
    setDraft("");
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      setThreads((t) => t.map((th, i) => (i === at ? [...th, { from: CHATS[at].thread[0][0], text: "Seen. On it!", mine: false }] : th)));
    }, 1400);
  };

  return (
    <section className="sl-board sl-dark" data-ink="#fffbf7" data-ground="#121212" aria-label="Your chats in Shine (a demo)">
      <div className="sl-board-in" data-ui>
        <div className="sl-row-cut" aria-hidden="true" />
        {CHATS.map((c, i) => {
          const isOpen = i === open;
          return (
            <div
              key={c.name}
              role="button"
              tabIndex={isOpen ? -1 : 0}
              aria-expanded={isOpen}
              className={`sl-row${isOpen ? " open" : ""}`}
              style={{ "--t": c.tone } as CSSProperties}
              onClick={() => !isOpen && (setOpen(i), setTyping(false))}
              onKeyDown={(e) => !isOpen && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(i), setTyping(false))}
            >
              <span className="sl-dot" aria-hidden="true">{c.short}</span>
              <span className="sl-row-name">{c.name}</span>
              <span className="sl-row-kind">{c.kind}</span>
              <span className={`sl-row-state${c.state === "Seen" && !isOpen ? " seen" : ""}`}>{isOpen ? "Open" : c.state}</span>
              {isOpen && (
                <div className="sl-thread" onClick={(e) => e.stopPropagation()}>
                  {threads[i].map((m, k) => (
                    <p key={k} className={`sl-msg${m.mine ? " mine" : ""}`}>
                      {!m.mine && <b>{m.from}</b>}
                      {m.text}
                    </p>
                  ))}
                  {typing && (
                    <span className="sl-typing" aria-label="typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  <form className="sl-reply" onSubmit={send}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`Reply to ${c.name}`}
                      aria-label={`Reply to ${c.name} (demo)`}
                      maxLength={140}
                    />
                    <button type="submit" className="sl-btn">Send</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
        <div className="sl-row-cut" aria-hidden="true" />
      </div>
      <p className="sl-board-note" data-in>
        Every chat keeps its own colour, <span>like your mail labels.</span> Open one and reply.
      </p>
    </section>
  );
}

function Stages() {
  const [open, setOpen] = useState(0);
  return (
    <div className="sl-acc" data-in style={{ "--d": 2 } as CSSProperties}>
      {STAGES.map((s, i) => (
        <button
          key={s.name}
          type="button"
          className={`sl-stage${i === open ? " open" : ""}`}
          style={{ "--c": s.c, "--fg": s.fg } as CSSProperties}
          aria-expanded={i === open}
          onClick={() => setOpen(i)}
        >
          <span className="sl-stage-name">{s.name}</span>
          <span className="sl-stage-body">
            <h3>{s.name}</h3>
            <p>{s.text}</p>
          </span>
        </button>
      ))}
    </div>
  );
}

function Commands() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? COMMANDS.filter((c) => (c.name + " " + c.say).toLowerCase().includes(s)) : COMMANDS;
  }, [q]);
  const current = Math.min(sel, Math.max(shown.length - 1, 0));
  return (
    <section className="sl-cmd" data-ink="#121212" data-ground="#d4f53c" aria-label="What Shine does">
      <div data-ui>
        <input
          className="sl-cmd-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((v) => Math.min(v + 1, shown.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((v) => Math.max(v - 1, 0));
            }
          }}
          placeholder="What can Shine do?"
          aria-label="Search what Shine does"
          data-in
        />
        <ul className="sl-cmd-list">
          {shown.map((c, i) => (
            <li key={c.name} data-in style={{ "--d": Math.min(i, 6) } as CSSProperties}>
              <button
                type="button"
                className={`sl-cmd-item${i === current ? " sel" : ""}`}
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                onClick={() => setSel(i)}
                aria-pressed={i === current}
              >
                <span className="row">
                  <span className="name">{c.name}</span>
                  {c.keys && (
                    <span className="keys" aria-label={`Shortcut ${c.keys.join(" ")}`}>
                      {c.keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </span>
                  )}
                </span>
                <span className="say">{c.say}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="sl-cmd-empty">Nothing by that name yet. Try "call" or "file".</li>}
        </ul>
      </div>
    </section>
  );
}

function FirstStep({ start, isAuthenticated, onGo }: { start: string; isAuthenticated: boolean; onGo: (to: string) => void }) {
  const [email, setEmail] = useState("");
  const [via, setVia] = useState<"here" | "mail">("here");
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (isAuthenticated) return onGo(start);
    if (via === "mail") return void (window.location.href = dejoiyMailSignInUrl("/app/chats"));
    onGo(`/auth${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`);
  };
  return (
    <section className="sl-cta" data-ink="#121212" data-ground="#4da3ff" aria-label="Sign in">
      <div className="sl-cta-copy">
        <h2 data-in>Your team is waiting.</h2>
        <p data-in style={{ "--d": 1 } as CSSProperties}>
          Sign in with your Dejoiy Mail account and every colleague with a mailbox is already in your chats.
        </p>
      </div>
      <form className="sl-dialog" onSubmit={go} data-ui data-in style={{ "--d": 2 } as CSSProperties}>
        <h3>Sign in to Shine</h3>
        <label>
          Your Dejoiy Mail address
          <input type="email" inputMode="email" autoComplete="username" placeholder="priya@yourcompany.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="sl-seg" role="group" aria-label="Where to sign in">
          <button type="button" aria-pressed={via === "here"} onClick={() => setVia("here")}>
            With password
          </button>
          <button type="button" aria-pressed={via === "mail"} onClick={() => setVia("mail")}>
            From Dejoiy Mail
          </button>
        </div>
        <button type="submit" className="sl-btn">
          {isAuthenticated ? "Open your chats" : "Continue"}
        </button>
        <small>Your password is checked by Dejoiy Mail and never stored in Shine.</small>
      </form>
    </section>
  );
}
