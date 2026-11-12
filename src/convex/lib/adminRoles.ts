import { ConvexError } from "convex/values";
// Admin rights in Shine come only from Dejoiy Mail (Zimbra): the super admin's
// email, Zimbra global admins and company (delegated) admins. Shine's own
// screens can't hand these roles out; everyone else gets the ordinary roles.

export const MAIL_MANAGED_ROLES = new Set(["super_admin", "dejoiy_admin", "admin", "super_it", "it", "client_admin"]);

export const MAIL_MANAGED_MESSAGE =
  "Admin roles come from Dejoiy Mail. Make this person an admin in the Dejoiy Mail admin console (admin-mail.dejoiy.com).";

export function assertNotMailManaged(role: string) {
  if (MAIL_MANAGED_ROLES.has(role)) throw new ConvexError(MAIL_MANAGED_MESSAGE);
}

/** The Shine role for someone signing in from Dejoiy Mail. */
export function roleFromMail(
  isSuperAdmin: boolean,
  mailAdmin: string,
  current: string | undefined,
): string {
  if (isSuperAdmin) return "super_admin";
  if (mailAdmin === "platform") return "dejoiy_admin";
  if (mailAdmin === "company") return "client_admin";
  // not an admin in Dejoiy Mail: keep hierarchy roles (director, TL...), drop admin ones
  return current && !MAIL_MANAGED_ROLES.has(current) ? current : "user";
}
