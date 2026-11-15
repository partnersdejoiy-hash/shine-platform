/** Shine on its own: price per person (rupees, before 18% GST) and how paid time adds up. */
export const SHINE_PRICE = { month: 29, year: 240 } as const;
export const GST_PERCENT = 18;
export const TRIAL_DAYS = 11;
export const DAY = 86_400_000;
const PERIOD_DAYS = { month: 30, year: 365 } as const;

/** What the company pays for this many people, GST included, in paise. */
export function shinePrice(seats: number, period: "month" | "year") {
  const base = seats * SHINE_PRICE[period] * 100;
  return base + Math.round((base * GST_PERCENT) / 100);
}

/** The new paid-until time: added after what's already paid, or after the trial's days left. */
export function linkPaidSince(now: number, paidUntil: number, trialEnds: number, period: "month" | "year") {
  const start = Math.max(now, paidUntil, paidUntil ? 0 : trialEnds);
  return start + PERIOD_DAYS[period] * DAY;
}
