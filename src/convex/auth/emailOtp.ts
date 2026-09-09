import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { sendResend, SHINE_EMAIL_FROM } from "../emailProvider";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array<ArrayBuffer>) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0B0B0B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0B;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid rgba(212,175,55,0.35);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-size:22px;font-weight:700;color:#D4AF37;letter-spacing:0.5px;">SHINE</div>
              <div style="font-size:11px;color:#8A8F98;margin-top:2px;">Powered by DEJOIY</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <div style="font-size:24px;font-weight:600;color:#FFFFFF;">Your SHINE verification code</div>
              <div style="margin-top:10px;font-size:15px;color:#E8E8E8;">Use the code below to sign in. It expires in 15 minutes.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;">
              <div style="background:#0F0F0F;border:1px solid rgba(212,175,55,0.3);border-radius:14px;padding:22px;text-align:center;font-size:36px;font-weight:700;letter-spacing:10px;color:#D4AF37;font-family:Menlo,Consolas,monospace;">${token}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px;background:#0F0F0F;border-top:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;color:#8A8F98;">If you didn't request this code, you can safely ignore this email.</div>
              <div style="font-size:11px;color:#8A8F98;margin-top:4px;">Powered by SHINE · An Enterprise Collaboration Platform · Developed by DEJOIY India Private Limited</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await sendResend({
      from: SHINE_EMAIL_FROM.auth,
      to: email,
      subject: "Your SHINE verification code",
      html,
      text: `Your SHINE verification code is ${token}. It expires in 15 minutes.`,
    });
    if (!res.ok) {
      throw new Error(res.error || "Failed to send verification email");
    }
  },
});
