/**
 * Shine's mail look (the app's Gen-Z style): cream page, white card with an ink outline and a
 * hard pink offset shadow, a yellow sticker tag, a heavy headline with a pink marker word, and a
 * pink ink-outlined button. Tables and inline styles only, so Gmail, Outlook and phones show it.
 */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const FONT = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif";
const INK = "#121212";
const PINK = "#ff4fa3";

export type ShineEmail = {
  /** Shown by the inbox next to the subject. */
  preheader: string;
  /** Small sticker above the headline, e.g. "Meeting invite". */
  tag: string;
  /** Headline; `highlight` is added after it with the pink marker. */
  title: string;
  highlight?: string;
  /** Trusted HTML: callers escape anything that came from people. */
  body: string;
  /** A one-time code shown big. */
  code?: string;
  cta?: { label: string; url: string };
  /** Small grey line under the button. Trusted HTML. */
  note?: string;
};

export function shineEmail(m: ShineEmail): string {
  const button = m.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr>
        <td style="background:${PINK};border:2px solid ${INK};border-radius:12px">
          <a href="${esc(m.cta.url)}" style="display:inline-block;padding:14px 26px;font:800 16px ${FONT};color:${INK};text-decoration:none">${esc(m.cta.label)} &rarr;</a>
        </td></tr></table>`
    : "";
  const code = m.code
    ? `<div style="margin:18px 0 6px;padding:16px;border:2px dashed ${INK};border-radius:14px;background:#ffe3f1;text-align:center;font:800 32px Menlo,Consolas,monospace;letter-spacing:8px;color:${INK}">${esc(m.code)}</div>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(m.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f0ec">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(m.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ec"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 16px;font:800 22px ${FONT};color:${INK};letter-spacing:-0.5px">
      SHINE <span style="background:${PINK};border-radius:6px;padding:0 6px">by DEJOIY</span>
    </td></tr>
    <tr><td style="background:${PINK};border-radius:24px;padding:0 6px 6px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid ${INK};border-radius:22px">
        <tr><td style="padding:28px 28px 30px;font:16px/1.6 ${FONT};color:${INK}">
          <span style="display:inline-block;background:#ffd23f;border:2px solid ${INK};border-radius:999px;padding:3px 12px;font:800 11px ${FONT};letter-spacing:1px;text-transform:uppercase;color:${INK}">${esc(m.tag)}</span>
          <div style="margin:16px 0 14px;font:800 30px/1.08 ${FONT};letter-spacing:-1px;color:${INK}">${esc(m.title)}${m.highlight ? ` <span style="background:#ffb3d6;padding:0 4px">${esc(m.highlight)}</span>` : ""}</div>
          ${m.body}${code}${button}
          ${m.note ? `<div style="margin-top:14px;font:13px/1.5 ${FONT};color:#514b56">${m.note}</div>` : ""}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:18px 6px 0;font:12px/1.6 ${FONT};color:#514b56">
      Sent by <b style="color:${INK}">SHINE</b>, chat, calls and meetings by DEJOIY INDIA PRIVATE LIMITED.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** A label and value row, for meeting and ticket details. Values are escaped here. */
export function detailRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 2px;border:2px solid ${INK};border-radius:14px;background:#fffbf7">${rows
    .map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? "border-top:1px solid #e1dadf;" : ""}font:700 12px ${FONT};text-transform:uppercase;letter-spacing:0.6px;color:#514b56;width:34%">${esc(k)}</td><td style="padding:10px 14px;${i ? "border-top:1px solid #e1dadf;" : ""}font:600 15px ${FONT};color:${INK}">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}
