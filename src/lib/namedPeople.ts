/** "@Riya Sen @Aman" → the people it names, longest name first so "Riya Sen" wins over "Riya". */
export function namedPeople<T extends { _id: string; name?: string | null; email?: string | null }>(text: string, people: T[]) {
  const found: T[] = [];
  let rest = " " + text + " ";
  const byLength = [...people].filter((p) => p.name || p.email).sort((a, b) => (b.name ?? "").length - (a.name ?? "").length);
  for (const p of byLength) {
    for (const label of [p.name, p.email].filter(Boolean) as string[]) {
      const at = rest.toLowerCase().indexOf("@" + label.toLowerCase());
      const after = rest[at + label.length + 1];
      if (at >= 0 && (after === undefined || /[\s,;.!?]/.test(after))) {
        found.push(p);
        rest = rest.slice(0, at) + rest.slice(at + label.length + 1);
        break;
      }
    }
  }
  return { people: found, rest: rest.replace(/\s+/g, " ").trim() };
}
