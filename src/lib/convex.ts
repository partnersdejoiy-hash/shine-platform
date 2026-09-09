import { ConvexReactClient } from "convex/react";

// The Convex deployment URL. Set VITE_CONVEX_URL at build/deploy time, e.g.:
//   VITE_CONVEX_URL=https://<slug>-<team>.convex.cloud
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!CONVEX_URL) {
  throw new Error(
    "VITE_CONVEX_URL is not set. Add your Convex deployment URL (e.g. " +
      "https://my-project-my-team.convex.cloud) to the build environment.",
  );
}

/** Single shared Convex client for the whole app. */
export const convex = new ConvexReactClient(CONVEX_URL);