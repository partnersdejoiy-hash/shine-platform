import { applyAccent, applyStoredAccent } from "@/lib/accent";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

/**
 * Applies the signed-in user's accent color to the whole app (CSS variables
 * drive buttons, glows, logo tint and charts). Also re-applies on theme
 * change so dark/light variants of the accent stay correct.
 *
 * Rendered once inside ConvexAuthProvider. Persists per user until they
 * change it themselves (Settings → Appearance).
 */
export function AccentSync() {
  const { user } = useAuth();

  // Apply the stored (boot) accent immediately, then the user's real choice.
  useEffect(() => {
    applyStoredAccent();
  }, []);

  useEffect(() => {
    applyAccent(user?.accentColor ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.accentColor]);

  // Re-apply when the theme class flips (theme switcher in Settings).
  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyAccent(user?.accentColor ?? null);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.accentColor]);

  return null;
}
