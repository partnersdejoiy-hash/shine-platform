import type { AuthConfig } from "convex/server";

// Self-hosted on the Dejoiy Mail server: only this deployment's own Convex Auth
// tokens are trusted. The old Freebuff federated-token provider is gone (see
// SELF_HOSTING.md, item 7), so no outside service can sign people in.
export default {
  providers: [
    // The deployment self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header)
    // validated via OIDC discovery at `${domain}/.well-known/openid-configuration`,
    // served by auth.addHttpRoutes() in convex/http.ts. Do NOT convert this
    // entry to `type: "customJwt"` — that path rejects tokens without a
    // `kid` header, so sign-in would silently never confirm.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
