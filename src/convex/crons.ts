import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * SHINE cron jobs.
 *
 * - sweepIdleMeetings: every 5 minutes, end any live meeting that has had
 *   nobody present for 30 minutes (the app updates `lastActiveAt` on the
 *   meeting whenever anyone joins, leaves, toggles media or chats).
 */
const crons = cronJobs();

// Everyone in Dejoiy Mail shows up in Shine (see dejoiyMail.syncDirectory).
crons.interval("dejoiy-mail-directory", { minutes: 15 }, internal.dejoiyMail.syncDirectory);

// Joi: her user, her #joi channel and its members; and her good-morning post (9:17 IST, Mon-Sat)
crons.interval("joi-setup", { minutes: 30 }, internal.joi.ensureJoi);
// Joi says hi to new people (a direct chat, and her welcome email for Dejoiy Mail mailboxes)
crons.interval("joi-welcome", { minutes: 10 }, internal.joi.welcomeNew);
crons.daily("joi-morning", { hourUTC: 3, minuteUTC: 47 }, internal.joi.morning);

crons.interval(
  "sweep-idle-meetings",
  { minutes: 5 },
  internal.meetings.sweepIdleMeetings,
);

export default crons;
