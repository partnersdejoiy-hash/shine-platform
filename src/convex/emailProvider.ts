// SHINE email provider — self-hosted via Resend (no FreeBuff email dependency).
//
// All emails leave through YOUR Resend account (RESEND_API_KEY set in the
// Keys tab) from the configured @dejoiy.com identities (the verified sending
// domain — @shine.dejoiy.com is NOT verified in Resend and would be rejected).
// Organizations with their own verified Resend domain can override `from`.

const RESEND_API = "https://api.resend.com/emails";

export interface ResendEmail {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/** Default sender identities (spec: SHINE email identities on the verified
 *  DEJOIY sending domain). */
export const SHINE_EMAIL_FROM = {
  auth: "auth@dejoiy.com",
  meetings: "meetings@dejoiy.com",
  welcome: "welcome@dejoiy.com",
  security: "security@dejoiy.com",
  notifications: "notifications@dejoiy.com",
  support: "support@dejoiy.com",
  compliance: "compliance@dejoiy.com",
  governance: "governance@dejoiy.com",
  hr: "hr@dejoiy.com",
  it: "it@dejoiy.com",
  ticketing: "ticketing@dejoiy.com",
  system: "system@dejoiy.com",
} as const;

/** Send a single email through Resend. Never throws — returns { ok, id | error }. */
export async function sendResend(
  mail: ResendEmail,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY is not configured (add it in the Keys tab)" };
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from || SHINE_EMAIL_FROM.notifications,
        to: mail.to,
        subject: mail.subject,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.text ? { text: mail.text } : {}),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Send multiple emails concurrently. Returns a single success/error summary. */
export async function sendResendBatch(
  emails: ResendEmail[],
): Promise<{ success: boolean; error?: string }> {
  const results = await Promise.all(emails.map((e) => sendResend(e)));
  const failed = results.find((r) => !r.ok);
  if (failed) return { success: false, error: failed.error };
  return { success: true };
}
