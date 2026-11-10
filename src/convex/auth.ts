// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

// Wire the auth.js / Better Auth secret. The deployment manages the secret via
// the project's Keys tab (BETTER_AUTH_SECRET or AUTH_SECRET). Convex Auth reads
// AUTH_SECRET from the environment; forwarding BETTER_AUTH_SECRET here keeps
// both spellings working so OTP + OAuth session signing is stable.
if (process.env.BETTER_AUTH_SECRET && !process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
}

import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { emailOtp } from "./auth/emailOtp";
import { internal } from "./_generated/api";
import { verifyDejoiyMailToken } from "./lib/dejoiyMailToken";

// NOTE: guest / anonymous login has been REMOVED (enterprise policy). Everyone
// who uses SHINE must have a real account — employees are provisioned by an
// admin (or import) with a temporary password, or sign in with email OTP.

// ---- OAuth / SSO providers ------------------------------------------------
// These are the standard Auth.js provider configs (Google, GitHub, Microsoft
// Entra ID, Apple), vendored as plain objects. They were copied from
// @auth/core/providers/* so the project has zero runtime imports from
// @auth/core (that package ships pure ESM, which breaks the platform's
// Babel-based build analysis and fails with "Cannot read properties of
// undefined (reading 'visitors')").
//
// Credentials are read from process.env (set via the project's Keys tab):
//   Google .............. AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
//   GitHub .............. AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
//   Microsoft Entra ID .. AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET
//   Apple ................ AUTH_APPLE_ID / AUTH_APPLE_SECRET
// Callback paths (add to each provider's app console):
//   {SITE_URL}/api/auth/callback/google · /github · /microsoft-entra-id · /apple

const google = {
  id: "google",
  name: "Google",
  type: "oidc" as const,
  issuer: "https://accounts.google.com",
  style: { brandColor: "#1a73e8" },
  options: {
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  },
};

const github = {
  id: "github",
  name: "GitHub",
  type: "oauth" as const,
  authorization: {
    url: "https://github.com/login/oauth/authorize",
    params: { scope: "read:user user:email" },
  },
  token: "https://github.com/login/oauth/access_token",
  userinfo: {
    url: "https://api.github.com/user",
    async request({ tokens, provider }: any) {
      const profile = await fetch(provider.userinfo?.url, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "User-Agent": "authjs",
        },
      }).then(async (res) => await res.json());
      if (!profile.email) {
        // Fall back to the emails API when the user has no public email.
        const res = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "User-Agent": "authjs",
          },
        });
        if (res.ok) {
          const emails = await res.json();
          profile.email = (emails.find((e: any) => e.primary) ?? emails[0]).email;
        }
      }
      return profile;
    },
  },
  profile(profile: any) {
    return {
      id: profile.id.toString(),
      name: profile.name ?? profile.login,
      email: profile.email,
      image: profile.avatar_url,
    };
  },
  style: { bg: "#24292f", text: "#fff" },
  options: {
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
  },
};

const microsoftEntraId = {
  id: "microsoft-entra-id",
  name: "Microsoft Entra ID",
  type: "oidc" as const,
  issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "https://login.microsoftonline.com/common/v2.0",
  authorization: { params: { scope: "openid profile email User.Read" } },
  profile(profile: any) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: null,
    };
  },
  style: { text: "#fff", bg: "#0072c6" },
  options: {
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  },
};

const apple = {
  id: "apple",
  name: "Apple",
  type: "oidc" as const,
  issuer: "https://appleid.apple.com",
  authorization: {
    params: {
      scope: "name email",
      response_mode: "form_post",
    },
  },
  profile(profile: any) {
    const name = profile.user
      ? `${profile.user.name.firstName} ${profile.user.name.lastName}`
      : profile.email;
    return {
      id: profile.sub,
      name,
      email: profile.email,
      image: null,
    };
  },
  client: { token_endpoint_auth_method: "client_secret_post" },
  style: { text: "#fff", bg: "#000" },
  checks: ["nonce", "state"] as ("nonce" | "state")[],
  options: {
    clientId: process.env.AUTH_APPLE_ID,
    clientSecret: process.env.AUTH_APPLE_SECRET,
  },
};

// ---- Email + password login ------------------------------------------------
// Every employee can sign in with their email and password (in addition to
// email OTP). Passwords are bcrypt-hashed in the separate `passwords` table
// (never on the user doc) and managed via:
//   - Settings → Security  (users create / change their own password)
//   - Admin console → Users → Password  (admins & IT reset for employees)
//   - Excel import optional "Password" column (bulk provisioning)
//
// IMPORTANT: `authorize` runs inside a Convex ACTION, which has NO direct
// ctx.db access — that used to crash with "Cannot read properties of
// undefined (reading 'query')". All verification happens in the
// `passwords.loginWithPassword` mutation, invoked via ctx.runMutation.
const adminPassword = ConvexCredentials({
  id: "password",
  authorize: async (credentials, ctx) => {
    const email =
      typeof credentials.email === "string"
        ? credentials.email.trim().toLowerCase()
        : "";
    const password =
      typeof credentials.password === "string" ? credentials.password : "";
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }
    const userId = await ctx.runMutation(internal.passwords.loginWithPassword, {
      email,
      password,
    });
    return { userId };
  },
});

// ---- Dejoiy Mail sign-in -----------------------------------------------------
// Accounts live in Dejoiy Mail (Zimbra). mail.dejoiy.com hands its signed-in
// user a short-lived signed token (see lib/dejoiyMailToken.ts); this provider
// checks it and signs the same person into Shine. Secret: DEJOIY_MAIL_SSO_SECRET.
const dejoiyMail = ConvexCredentials({
  id: "dejoiy-mail",
  authorize: async (credentials, ctx) => {
    const claims = await verifyDejoiyMailToken(
      typeof credentials.token === "string" ? credentials.token : "",
      process.env.DEJOIY_MAIL_SSO_SECRET,
    );
    const userId = await ctx.runMutation(internal.dejoiyMail.upsertUser, claims);
    return { userId };
  },
});

// ---- Dejoiy Mail email + password ------------------------------------------
// The sign-in form on app.shine.dejoiy.com: the mailbox email and password are
// checked by Dejoiy Mail against Zimbra (server to server, shared secret).
// Shine never stores the password.
const dejoiyMailPassword = ConvexCredentials({
  id: "dejoiy-mail-password",
  authorize: async (credentials, ctx) => {
    const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
    const password = typeof credentials.password === "string" ? credentials.password : "";
    if (!email || !password) throw new Error("Enter your Dejoiy Mail email and password.");
    const base = process.env.DEJOIY_MAIL_URL;
    const secret = process.env.DEJOIY_MAIL_SSO_SECRET;
    if (!base || !secret) throw new Error("Dejoiy Mail sign-in is not set up on this server yet.");
    const res = await fetch(`${base}/api/shine/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email, password }),
    });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(out.error ?? "Could not sign you in. Try again."));
    const userId = await ctx.runMutation(internal.dejoiyMail.upsertUser, {
      email: String(out.email ?? email),
      name: String(out.name ?? ""),
      admin: out.admin === "platform" || out.admin === "company" ? String(out.admin) : "",
      photo: typeof out.photo === "string" && out.photo.startsWith("https://") ? out.photo : "",
    });
    return { userId };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, google, github, microsoftEntraId, apple, adminPassword, dejoiyMail, dejoiyMailPassword],
});
