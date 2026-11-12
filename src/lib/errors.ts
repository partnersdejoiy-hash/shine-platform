/**
 * Friendly error mapping — converts backend / raw errors into safe,
 * user-friendly messages. Never expose stack traces, function names,
 * request IDs, or framework internals to end users.
 */

const ERROR_MAP: Record<string, string> = {
  // Auth
  "Not authenticated": "Your session has expired. Please sign in again.",
  "Invalid credentials": "Email or password is incorrect. Please try again.",
  "Account locked": "Your account has been temporarily locked due to too many failed attempts. Please try again later.",
  "Account deactivated": "Your account has been deactivated. Please contact your administrator.",
  "Email not verified": "Please verify your email address before signing in.",
  "Invalid verification code": "The code you entered is invalid or has expired. Please request a new one.",
  "Password too weak": "Your password must be at least 8 characters and include a mix of letters, numbers, and symbols.",
  "Password mismatch": "The passwords you entered do not match.",
  "Temporary password expired": "Your temporary password has expired. Please request a new one.",
  "MFA required": "Two-factor authentication is required. Please enter your code.",
  "Invalid MFA code": "The two-factor code is incorrect. Please try again.",

  // Permissions
  "Admin only": "You don't have permission to perform this action.",
  "Admin only.": "You don't have permission to perform this action.",
  "You don't have permission": "You don't have permission to perform this action.",
  "Hierarchy rule": "You don't have the authority to perform this action.",
  "Super Admin only": "This action requires Super Admin privileges.",
  "Cannot modify super admin": "The Super Admin account cannot be modified.",

  // Tickets
  "Ticket not found": "The ticket you're looking for could not be found.",
  "Ticket already decided": "This ticket has already been decided.",
  "Ticket cancelled": "This ticket has been cancelled.",

  // Conversations
  "Conversation not found": "This conversation could not be found.",
  "Not a member": "You are not a member of this conversation.",
  "Cannot send messages": "You don't have permission to send messages in this conversation.",

  // Meetings
  "Meeting not found": "This meeting could not be found.",
  "Meeting has ended": "This meeting has ended.",
  "Cannot join meeting": "You don't have permission to join this meeting.",

  // Files
  "File too large": "The file is too large. Please choose a smaller file.",
  "Invalid file type": "This file type is not supported.",
  "Upload failed": "The file upload failed. Please try again.",

  // General
  "Something went wrong": "Something went wrong. Please try again.",
  "Network error": "Connection problem. Please check your internet and try again.",
  "Request timeout": "The request took too long. Please try again.",
  "Server error": "A server error occurred. Please try again later.",
  "Validation failed": "Please check your input and try again.",
  "Rate limited": "Too many requests. Please wait a moment and try again.",
};

/**
 * Convert any error into a safe, user-friendly message.
 * Never returns raw error details to the UI.
 */
export function getFriendlyError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  // the server's own words (thrown as ConvexError), without Convex's wrapper
  const data = (error as { data?: unknown })?.data;
  const raw = typeof data === "string" && data ? data : error instanceof Error ? error.message : String(error);

  // Direct match
  if (ERROR_MAP[raw]) return ERROR_MAP[raw];

  // Partial match (for dynamic errors like "Hierarchy rule: ... cannot assign ...")
  for (const [key, msg] of Object.entries(ERROR_MAP)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return msg;
  }

  // Convex-specific: strip framework noise
  if (raw.includes("[CONVEX]")) {
    return "Something went wrong. Please try again.";
  }
  if (raw.includes("Server Error")) {
    return "A server error occurred. Please try again later.";
  }
  if (raw.includes("Request ID")) {
    return "Something went wrong. Please try again.";
  }

  // If the message is short and doesn't contain technical terms, pass it through
  if (raw.length < 80 && !raw.includes("Error") && !raw.includes("at ") && !raw.includes("handler")) {
    return raw;
  }

  // Fallback: safe generic message
  return "Something went wrong. Please try again.";
}

/**
 * Show a friendly error in a toast.
 * Usage: toast.error(friendlyError(err))
 */
export function toastFriendlyError(error: unknown, fallback?: string): string {
  return getFriendlyError(error) ?? fallback ?? "Something went wrong. Please try again.";
}

/** A short, human error for toasts: the server's own words (ConvexError), never Convex's "[CONVEX M(x)] [Request ID …] Server Error" wrapper. */
export function errorMessage(e: unknown): string {
  const data = (e as { data?: unknown })?.data;
  if (typeof data === "string" && data) return data;
  const msg = String((e as Error)?.message ?? e ?? "");
  const clean = msg
    .split("\n")[0]
    .replace(/^\[CONVEX [^\]]*\]\s*/, "")
    .replace(/^\[Request ID: [^\]]*\]\s*/, "")
    .replace(/^Server Error\s*/, "")
    .replace(/^Uncaught (Convex)?Error:\s*/, "")
    .trim();
  return clean && clean !== "Server Error" ? clean.slice(0, 200) : "Shine hit a problem on the server. Try again in a moment.";
}
