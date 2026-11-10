import { AnimatePresence, motion } from "framer-motion";
import { SHINE_D, SHINE_LIME, SHINE_PINK } from "@/components/ShineLogo";
import { useEffect, useMemo, useState } from "react";

/**
 * SHINE startup (~1.6s): the logo builds itself (tile, D, bubble tail, dots,
 * a wink), then the wordmark slides up. Once per session; skipped for reduced motion.
 * Colours follow the user's accent through --gold.
 */

const SHOW_MS = 1600;

export function StartupAnimation() {
  const skip = useMemo(() => {
    try {
      if (sessionStorage.getItem("shine-splash-seen") === "1") return true;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
    } catch {
      /* ignore */
    }
    return false;
  }, []);
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(skip);

  useEffect(() => {
    try {
      sessionStorage.setItem("shine-splash-seen", "1");
    } catch {
      /* ignore */
    }
    if (skip) return;
    const t1 = setTimeout(() => setHidden(true), SHOW_MS);
    const t2 = setTimeout(() => setDone(true), SHOW_MS + 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [skip]);

  if (done) return null;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="shine-splash"
          className="fixed inset-0 z-[9999] grid place-items-center bg-background"
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          aria-hidden="true"
        >
          <div className="flex flex-col items-center">
            {/* tile stamps in, the D slides on, the bubble tail pops, the dots hop in, then a wink */}
            <motion.svg
              viewBox="0 0 100 100"
              width={136}
              height={136}
              initial={{ scale: 0.3, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 14 }}
              style={{ filter: "drop-shadow(5px 5px 0 #121212)" }}
            >
              <rect width="100" height="100" rx="25" fill={SHINE_PINK} />
              <motion.path
                d={SHINE_D}
                fill="#fff"
                fillRule="evenodd"
                initial={{ x: -18, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.circle
                cx="22.8" cy="37.9" r="6.7" fill={SHINE_LIME}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={{ scale: 0, y: -10 }}
                animate={{ scale: [0, 1.35, 1], y: [-10, 2, 0] }}
                transition={{ delay: 0.5, duration: 0.45 }}
              />
              <motion.circle
                cx="22.8" cy="59" r="6.7" fill="#fff"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={{ scale: 0, y: -10 }}
                animate={{ scale: [0, 1.35, 1, 1, 0.15, 1], y: [-10, 2, 0, 0, 0, 0] }}
                transition={{ delay: 0.62, duration: 0.95, times: [0, 0.3, 0.45, 0.75, 0.85, 1] }}
              />
            </motion.svg>
            <motion.div
              className="mt-6 text-center leading-none"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-4xl font-extrabold tracking-[-0.05em] text-foreground">Shine</div>
              <div className="mt-2 text-sm font-semibold text-muted-foreground">chat, calls and teamwork · by Dejoiy</div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
