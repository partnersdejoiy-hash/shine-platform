import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/**
 * SHINE startup: a quick sticker pop (~1.6s), same family as Dejoiy Mail.
 * The bubble stamps in, its shadow slides under it, three dots pop, the
 * wordmark slides up. Once per session; skipped for reduced motion.
 * Colours follow the user's accent through --gold.
 */

const BUBBLE = "M14 8h38a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H32l-12 10v-10h-6a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z";
const DOTS = [22, 33, 44];
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
            <svg viewBox="-4 -4 72 72" width={132} height={132} fill="none" className="overflow-visible">
              <motion.path
                d={BUBBLE}
                fill="var(--sticker-shadow)"
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: 4, y: 4, opacity: 1 }}
                transition={{ delay: 0.32, duration: 0.25, ease: "easeOut" }}
              />
              <motion.g
                style={{ originX: "50%", originY: "50%" }}
                initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: -6, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
              >
                <path d={BUBBLE} fill="var(--gold)" stroke="#121212" strokeWidth="3.5" strokeLinejoin="round" />
                {DOTS.map((cx, i) => (
                  <motion.circle
                    key={cx}
                    cx={cx}
                    cy={28}
                    r={3.8}
                    fill="#121212"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.5, 1] }}
                    transition={{ delay: 0.45 + i * 0.14, duration: 0.35 }}
                    style={{ originX: `${cx}px`, originY: "28px" }}
                  />
                ))}
                <path d="M14.5 15.5h9" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" />
              </motion.g>
            </svg>
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
