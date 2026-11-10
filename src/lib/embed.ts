// Shine inside Dejoiy Mail: mail.dejoiy.com opens Shine's chats in a docked panel
// (an iframe), like Gmail's chat. In that mode the app hides its own navigation.

export const DEJOIY_MAIL_URL = (import.meta.env.VITE_DEJOIY_MAIL_URL as string | undefined) || "https://mail.dejoiy.com";

const KEY = "shine-embed";

export function isEmbedded(): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  try {
    if (new URLSearchParams(window.location.search).get("embed") === "1") sessionStorage.setItem(KEY, "1");
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("embed") === "1";
  }
}

/** Tell the Dejoiy Mail page something (unread count, a request to open Shine full size). */
export function tellMail(message: { type: string; [key: string]: unknown }) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(message, DEJOIY_MAIL_URL);
}

/** Link that sends someone to Dejoiy Mail to sign in, then back to `returnTo` here. */
export function dejoiyMailSignInUrl(returnTo: string): string {
  return `${DEJOIY_MAIL_URL}/shine/sso?return=${encodeURIComponent(returnTo)}`;
}
