import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Razorpay payment webhooks are handled by the self-hosted NestJS backend
// (server/src/billing) in production; the web app verifies payments inline
// via the signature-checked billing.verifyPayment action.

export default http;
