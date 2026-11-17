import { initials } from "@/lib/format";
import { useState } from "react";

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

/** First and last name's initials: "Asha Verma" → "AV"; one word or an email falls back to its parts. */
function cardInitials(name?: string | null, email?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 || (words.length === 1 && !words[0].includes("@"))) return initials(name);
  const local = (email ?? "?").split("@")[0].split(/[._-]+/).filter(Boolean);
  return ((local[0]?.[0] ?? "?") + (local.length > 1 ? local[local.length - 1][0] : "")).toUpperCase();
}

/**
 * A person's ID card in DEJOIY's colours (the same card as in Dejoiy Mail): company band, photo or
 * initials, name, position, role sticker, employee ID, department, email. The company's admins set
 * the details; the photo is the one the person uploads.
 */
export function IdCard({ person }: { person: IdCardPerson }) {
  const [broken, setBroken] = useState(false);
  const domain = person.email?.split("@")[1] ?? "";
  const company = person.company || domain || "DEJOIY";
  const rows: [string, string | null | undefined][] = [
    ["Employee ID", person.employeeId],
    ["Department", person.department],
    ["Email", person.email],
  ];
  return (
    <article
      aria-label={`ID card of ${person.name ?? person.email ?? ""}`}
      className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[22px] border-2 border-[#121212] bg-[#fffbf7] text-[#121212] shadow-[6px_6px_0_#ff4fa3]"
    >
      <header className="flex items-center gap-2.5 border-b-2 border-[#121212] bg-[#ff4fa3] px-4 py-3.5">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-[10px] border-2 border-[#121212] bg-white text-[15px] font-black" aria-hidden="true">
          {cardInitials(company)}
        </span>
        <span className="grid min-w-0 leading-tight">
          <b className="truncate text-base font-black">{company}</b>
          {domain && <small className="text-xs font-semibold opacity-80">{domain}</small>}
        </span>
      </header>
      <div className="grid justify-items-center px-[18px] pb-2 pt-[18px] text-center">
        <div className="relative grid size-[104px] place-items-center overflow-hidden rounded-full border-[3px] border-[#121212] bg-[#ffe3f1] shadow-[4px_4px_0_#121212]">
          <span className="text-[38px] font-black tracking-tight">{cardInitials(person.name, person.email)}</span>
          {person.image && !broken && (
            <img src={person.image} alt="" className="absolute inset-0 size-full object-cover" onError={() => setBroken(true)} />
          )}
        </div>
        <h3 className="mt-4 text-[22px] font-black leading-tight tracking-tight">{person.name || person.email}</h3>
        {person.designation && <p className="text-sm font-semibold text-[#514b56]">{person.designation}</p>}
        {person.jobRole && (
          <span className="mt-2.5 inline-block -rotate-2 rounded-full border-2 border-[#121212] bg-[#ffd23f] px-3 py-0.5 text-xs font-extrabold">
            {person.jobRole}
          </span>
        )}
        <dl className="mb-1.5 mt-3.5 w-full overflow-hidden rounded-[14px] border-2 border-[#121212] bg-white text-left">
          {rows
            .filter(([, v]) => v)
            .map(([k, v], i) => (
              <div key={k} className={"flex justify-between gap-2.5 px-3 py-2 " + (i ? "border-t border-[#e1dadf]" : "")}>
                <dt className="text-[11px] font-extrabold uppercase tracking-wider text-[#514b56]">{k}</dt>
                <dd className="truncate text-[13px] font-bold">{v}</dd>
              </div>
            ))}
        </dl>
      </div>
      <footer className="flex justify-between bg-[#121212] px-4 py-2.5 text-xs font-extrabold tracking-widest text-[#fbf3f8]">
        <span>DEJOIY</span>
        <span className="font-mono tracking-normal">{person.employeeId || "ID card"}</span>
      </footer>
    </article>
  );
}
