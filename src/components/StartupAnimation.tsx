import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/**
 * SHINE cinematic startup animation (9 steps):
 *   1. A single dot appears — connection.
 *   2. Two more dots join — people coming together.
 *   3. A line begins to draw around them.
 *   4. The shape completes — a chat bubble.
 *   5. The shape locks in with depth and clarity.
 *   6. A soft glow spreads — the logo comes to life.
 *   7. A pulse radiates — energy and connection.
 *   8. The glow gently settles — premium finish.
 *   9. Ready — seamless into the app.
 *
 * Renders once per page load (session-scoped) and follows the user's chosen
 * accent color via CSS variables.
 */

const HEX_PATH =
  "M32 3.2 L52.6 14.2 Q56 16 56 19.9 L56 37 Q56 42.4 51.4 44.9 L39.2 51.9 Q37.6 52.7 37.6 54.5 L37.6 58.4 Q37.6 60.8 35.2 60.8 L32 60.8 L28.8 60.8 Q26.4 60.8 26.4 58.4 L26.4 54.5 Q26.4 52.7 24.8 51.9 L12.6 44.9 Q8 42.4 8 37 L8 19.9 Q8 16 11.4 14.2 Z";

const DOTS = [
  { cx: 20.5, cy: 28.5 },
  { cx: 32, cy: 28.5 },
  { cx: 43.5, cy: 28.5 },
];

const CAPTIONS = [
  "A single dot appears — connection.",
  "Two more dots join in — people coming together.",
  "A line begins to draw around them.",
  "The shape completes — forming a chat bubble.",
  "The shape locks in with depth and clarity.",
  "A soft glow spreads — bringing the logo to life.",
  "A pulse radiates — energy and connection.",
  "The glow gently settles — a premium finish.",
  "Ready.",
];

/** Duration in ms of each step (index 0..8). */
const STEP_MS = [900, 700, 1100, 900, 800, 800, 900, 800, 700];
const TOTAL_MS = STEP_MS.reduce((a, b) => a + b, 0);

export function StartupAnimation() {
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);

  const skip = useMemo(() => {
    try {
      if (sessionStorage.getItem("shine-splash-seen") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }, []);

  useEffect(() => {
    if (skip) {
      setHidden(true);
      setDone(true);
      return;
    }
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEP_MS.forEach((ms, i) => {
      elapsed += ms;
      timers.push(
        setTimeout(() => {
          setStep(i + 1);
          if (i === STEP_MS.length - 1) {
            // hold "Ready" briefly, then fade the overlay out
            timers.push(
              setTimeout(() => {
                setHidden(true);
                setTimeout(() => setDone(true), 600);
              }, 500),
            );
          }
        }, elapsed),
      );
    });
    try {
      sessionStorage.setItem("shine-splash-seen", "1");
    } catch {
      /* ignore */
    }
    return () => timers.forEach(clearTimeout);
  }, [skip]);

  if (done) return null;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="shine-splash"
          className="fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#070B12]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
          aria-hidden
        >
          {/* ambient background glow that grows with the animation */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={{
              background:
                step >= 6
                  ? "radial-gradient(ellipse 60% 45% at 50% 50%, var(--gold-soft), transparent 70%)"
                  : "radial-gradient(ellipse 40% 30% at 50% 50%, transparent, transparent 70%)",
            }}
            transition={{ duration: 0.9 }}
          />

          {/* radiating pulse rings (step 7) */}
          {step >= 7 && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={`ring-${i}`}
                  className="pointer-events-none absolute rounded-full border"
                  style={{ borderColor: "var(--gold)", width: 88, height: 88 }}
                  initial={{ opacity: 0.5, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 2.6 }}
                  transition={{
                    duration: 1.8,
                    delay: i * 0.35,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
              {/* scattered particles */}
              {[
                { x: -140, y: -60, d: 1.4 },
                { x: 150, y: -90, d: 1.1 },
                { x: -170, y: 70, d: 1.0 },
                { x: 120, y: 110, d: 1.5 },
                { x: -60, y: -130, d: 0.9 },
                { x: 180, y: 20, d: 1.2 },
              ].map((p, i) => (
                <motion.span
                  key={`p-${i}`}
                  className="pointer-events-none absolute rounded-full"
                  style={{ backgroundColor: "var(--gold)", width: p.d * 4, height: p.d * 4 }}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: p.x * 1.15,
                    y: p.y * 1.15,
                    scale: [0.4, 1.4, 0.6],
                  }}
                  transition={{
                    duration: 1.6,
                    delay: 0.2 + i * 0.18,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
            </>
          )}

          <div className="relative flex flex-col items-center">
            {/* soft glow halo behind the logo (step 6+) */}
            <motion.div
              className="pointer-events-none absolute inset-0 -z-10 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, var(--gold-soft), transparent 62%)",
                filter: "blur(18px)",
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: step >= 6 ? (step >= 8 ? 0.55 : 1) : 0,
                scale: step >= 7 ? 1.25 : 0.85,
              }}
              transition={{ duration: 1 }}
            />

            <svg viewBox="0 0 64 64" width={132} height={132} fill="none">
              {/* step 1–2: dots appear one by one (connection → people) */}
              {DOTS.map((d, i) => (
                <motion.circle
                  key={`early-${i}`}
                  cx={d.cx}
                  cy={d.cy}
                  r={3.4}
                  fill="var(--gold)"
                  initial={{ opacity: 0, scale: 0, y: 8 }}
                  animate={
                    step >= 1 + i
                      ? { opacity: 1, scale: 1, y: 0 }
                      : { opacity: 0, scale: 0, y: 8 }
                  }
                  transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.05 * i }}
                />
              ))}

              {/* step 3–4: hexagon outline draws itself, then fills */}
              <motion.path
                d={HEX_PATH}
                fill="none"
                stroke="var(--gold)"
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={
                  step >= 3
                    ? { pathLength: step >= 4 ? 1 : 1, opacity: step >= 4 ? 0 : 1 }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{ duration: 1.1, ease: "easeInOut" }}
              />
              <motion.path
                d={HEX_PATH}
                fill="var(--gold)"
                fillOpacity={0.16}
                stroke="none"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: step >= 4 ? 1 : 0, scale: step >= 4 ? 1 : 0.92 }}
                transition={{ duration: 0.6 }}
              />
              <motion.path
                d="M32 11 L47.6 19.3 Q49.6 20.4 49.6 22.7 L49.6 35.6 Q49.6 39.2 46.6 40.8 L37.6 46 Q35.4 47.2 35.4 49.4 L35.4 53.2 L32 53.2 L28.6 53.2 L28.6 49.4 Q28.6 47.2 26.4 46 L17.4 40.8 Q14.4 39.2 14.4 35.6 L14.4 22.7 Q14.4 20.4 16.4 19.3 Z"
                fill="#0B0B0B"
                stroke="var(--gold)"
                strokeOpacity={0.45}
                strokeWidth={0.8}
                initial={{ opacity: 0 }}
                animate={{ opacity: step >= 4 ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              />

            </svg>

            {/* wordmark + ready caption */}
            <motion.div
              className="mt-8 flex flex-col items-center"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: step >= 9 ? 1 : 0, y: step >= 9 ? 0 : 14 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="text-2xl font-bold tracking-[0.34em] text-white"
                style={{ textShadow: "0 0 24px var(--gold-soft)" }}
              >
                SHINE
              </div>
              <div className="mt-1.5 text-[10px] font-medium tracking-[0.3em] text-white/45 uppercase">
                Powered by Dejoiy
              </div>
            </motion.div>

            {/* step caption */}
            <motion.div
              key={step}
              className="mt-5 h-5 text-[11px] font-medium tracking-wide text-white/50"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {CAPTIONS[Math.min(step, CAPTIONS.length - 1)]}
            </motion.div>

            {/* progress dots */}
            <div className="mt-6 flex items-center gap-1.5">
              {CAPTIONS.map((_, i) => (
                <motion.span
                  key={i}
                  className="h-1 rounded-full"
                  style={{ backgroundColor: "var(--gold)" }}
                  animate={{
                    width: step >= i + 1 ? 18 : 5,
                    opacity: step >= i + 1 ? 0.9 : 0.25,
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
