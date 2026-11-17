import { initials } from "@/lib/format";
import { useId, useState } from "react";

export type IdCardPerson = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  designation?: string | null;
  jobRole?: string | null;
  employeeId?: string | null;
  department?: string | null;
  company?: string | null;
};

/** The D of DEJOIY's logo (as on dejoiy.com): flat rounded left side, round right side. */
const D = "M18 -20H80A70 70 0 0 1 80 120H18A18 18 0 0 1 0 102V-2A18 18 0 0 1 18 -20Z";
const INK = "#121212";

/** First and last name's initials: "Asha Verma" → "AV"; one word or an email falls back to its parts. */
function cardInitials(name?: string | null, email?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 || (words.length === 1 && !words[0].includes("@"))) return initials(name);
  const local = (email ?? "?").split("@")[0].split(/[._-]+/).filter(Boolean);
  return ((local[0]?.[0] ?? "?") + (local.length > 1 ? local[local.length - 1][0] : "")).toUpperCase();
}

/** The photo (or the initials, when there is none or it fails to load) inside the logo's D. */
function DFrame({ photo, letters }: { photo?: string | null; letters: string }) {
  const clip = "idc-d" + useId().replace(/:/g, "");
  const [broken, setBroken] = useState(false);
  return (
    <svg viewBox="-46 -32 214 172" aria-hidden="true" className="w-[182px] -rotate-3 overflow-visible">
      <defs>
        <clipPath id={clip}>
          <path d={D} />
        </clipPath>
      </defs>
      <path d={D} transform="translate(12 10)" fill="#d4ff3a" stroke={INK} strokeWidth={5} />
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={-20} width={150} height={140} fill="#ff9bcb" />
        <text x={75} y={52} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize={54} fontWeight={900} letterSpacing={-2}>
          {letters}
        </text>
        {photo && !broken && (
          <image href={photo} x={0} y={-20} width={150} height={140} preserveAspectRatio="xMidYMid slice" onError={() => setBroken(true)} />
        )}
      </g>
      <path d={D} fill="none" stroke={INK} strokeWidth={5} />
      <circle cx={-24} cy={20} r={13} fill="#ff4fa3" stroke={INK} strokeWidth={4} />
      <circle cx={-24} cy={80} r={13} fill={INK} />
    </svg>
  );
}

/**
 * A person's ID card in DEJOIY's Gen-Z look (the same card as in Dejoiy Mail): lime company band,
 * the photo inside the logo's D, name, position, role sticker, employee ID and department chips,
 * email, ink footer. The company's admins set the details; the photo is the one the person uploads.
 */
export function IdCard({ person }: { person: IdCardPerson }) {
  const domain = person.email?.split("@")[1] ?? "";
  const company = person.company || domain || "DEJOIY";
  const chips = (
    [
      ["ID", person.employeeId, "bg-[#9fd8ff] font-mono"],
      ["Dept", person.department, "bg-[#7debb5]"],
    ] as const
  ).filter(([, v]) => v);
  return (
    <article
      aria-label={`ID card of ${person.name ?? person.email ?? ""}`}
      className="relative isolate mx-auto w-full max-w-[340px] overflow-hidden rounded-[26px] border-[2.5px] border-[#121212] bg-[#fffdf7] text-[#121212] shadow-[7px_7px_0_#ff4fa3]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(circle at 1px 1px,rgba(18,18,18,.09) 1px,transparent 1.5px) 0 0/14px 14px" }}
      />
      <header className="flex items-center gap-2.5 border-b-[2.5px] border-[#121212] bg-[#d4ff3a] py-[13px] pl-4 pr-3.5">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] border-2 border-[#121212] bg-white text-[15px] font-black" aria-hidden="true">
          {cardInitials(company)}
        </span>
        <span className="grid min-w-0 flex-1 leading-tight">
          <b className="truncate text-base font-black tracking-tight">{company}</b>
          {domain && <small className="text-xs font-bold opacity-70">{domain}</small>}
        </span>
        <span className="shrink-0 rounded-lg bg-[#121212] px-2 py-1 text-xs font-black tracking-widest text-[#d4ff3a]">ID</span>
      </header>
      <div className="grid justify-items-center px-5 pb-4 pt-5 text-center">
        <DFrame photo={person.image} letters={cardInitials(person.name, person.email)} />
        <h3 className="mt-2.5 text-2xl font-black leading-tight tracking-tight">{person.name || person.email}</h3>
        {person.designation && <p className="mt-0.5 text-sm font-semibold text-[#4a4550]">{person.designation}</p>}
        {person.jobRole && (
          <span className="mt-2.5 inline-block -rotate-[2.5deg] rounded-full border-2 border-[#121212] bg-[#ffd43b] px-[13px] py-1 text-xs font-black shadow-[2px_2px_0_#121212]">
            {person.jobRole}
          </span>
        )}
        {chips.length > 0 && (
          <div className="mt-3.5 flex flex-wrap justify-center gap-2">
            {chips.map(([k, v, tone]) => (
              <span key={k} className={`inline-flex max-w-full items-center gap-1.5 rounded-xl border-2 border-[#121212] px-2.5 py-1 text-[13px] font-extrabold ${tone}`}>
                <small className="text-[10px] font-black uppercase tracking-wider opacity-65">{k}</small>
                {v}
              </span>
            ))}
          </div>
        )}
        {person.email && <p className="mt-3 max-w-full truncate text-[13px] font-bold text-[#4a4550]">{person.email}</p>}
      </div>
      <footer className="flex items-center gap-2.5 bg-[#121212] px-4 py-[11px] text-xs font-black tracking-widest text-[#fbf3f8]">
        <span className="inline-flex items-center gap-[3px]">
          <i className="size-1.5 rounded-full bg-[#ff4fa3]" />
          <i className="mr-1 size-1.5 rounded-full bg-[#d4ff3a]" />
          DEJOIY
        </span>
        <span
          aria-hidden="true"
          className="h-4 flex-1 opacity-85"
          style={{
            background:
              "repeating-linear-gradient(90deg,#fbf3f8 0 2px,transparent 2px 4px,#fbf3f8 4px 5px,transparent 5px 8px,#fbf3f8 8px 11px,transparent 11px 13px)",
          }}
        />
        <span className="font-mono tracking-normal text-[#d4ff3a]">{person.employeeId || "ID CARD"}</span>
      </footer>
    </article>
  );
}
