import { AnimatePresence, motion } from "framer-motion";
import { DejoiyMark } from "@/components/ShineLogo";
import { useEffect, useMemo, useState } from "react";

/**
 * SHINE startup: the Dejoiy :D mark pops in (~1.6s), same family as Dejoiy Mail,
 * then the wordmark slides up. Once per session; skipped for reduced motion.
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
            <motion.div
              initial={{ scale: 0.2, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 15 }}
            >
              <DejoiyMark size={128} />
            </motion.div>
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
