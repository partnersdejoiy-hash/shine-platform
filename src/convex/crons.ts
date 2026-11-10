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

crons.interval(
  "sweep-idle-meetings",
  { minutes: 5 },
  internal.meetings.sweepIdleMeetings,
);

export default crons;
