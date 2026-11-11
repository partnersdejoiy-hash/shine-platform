/**
 * Joi, DEJOIY's AI buddy, as Shine's assistant (in place of the old Shine AI).
 * Her chat panel is Joi's own one-line embed (joi.js) for the "shine" app; it opens
 * over Shine. Her answers come from the Joi server, so she works as soon as that is
 * set up (VITE_JOI_API_URL, or Joi's own joi-config.js).
 */
const JOI_URL = ((import.meta.env.VITE_JOI_URL as string | undefined) || "https://joi-ai.dejoiy.com").replace(/\/+$/, "");
const JOI_API = ((import.meta.env.VITE_JOI_API_URL as string | undefined) || JOI_URL).replace(/\/+$/, "");
export const JOI_AVATAR = `${JOI_URL}/joi-avatar.webp`;

type JoiApi = { open: () => void; setUser: (u: { name?: string; email?: string }) => void; setAppToken: (t: string) => void };
declare global {
  interface Window {
    Joi?: JoiApi & { __loaded?: boolean };
  }
}

let ready: Promise<boolean> | null = null;

/** Loads joi.js once; resolves when her panel can open (false when Joi can't be reached). */
function load(user?: { name?: string | null; email?: string | null }): Promise<boolean> {
  if (ready) return ready;
  ready = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = `${JOI_URL}/joi.js`;
    s.async = true;
    s.dataset.app = "shine";
    s.dataset.api = JOI_API;
    s.dataset.launcher = "none";
    if (user?.name) s.dataset.userName = user.name;
    if (user?.email) s.dataset.userEmail = user.email;
    s.onerror = () => {
      ready = null;
      resolve(false);
    };
    s.onload = () => {
      // joi.js builds its panel after reading the app's settings; wait for it (at most 6s)
      const started = Date.now();
      const tick = () => (document.querySelector(".joi-w") ? resolve(true) : Date.now() - started > 6000 ? resolve(false) : setTimeout(tick, 100));
      tick();
    };
    document.body.appendChild(s);
  });
  return ready;
}

/** Opens Joi's chat. `token` (from the server) lets her use DEJOIY's internal memory here. */
export async function openJoi(user?: { name?: string | null; email?: string | null }, token?: Promise<string | null>): Promise<boolean> {
  const ok = await load(user);
  if (!ok || !window.Joi) return false;
  window.Joi.open();
  token?.then((t) => t && window.Joi?.setAppToken(t)).catch(() => {});
  return true;
}
