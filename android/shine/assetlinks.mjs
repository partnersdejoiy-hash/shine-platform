// Digital Asset Links for the SHINE Android app: proves the app and app.shine.dejoiy.com belong together,
// so the app opens the site full screen without an address bar. The fingerprints come from
// android/shine/fingerprints.json; Vite writes /.well-known/assetlinks.json from it on every build.
import { readFileSync } from "node:fs";

export const PACKAGE = "com.dejoiy.shine";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** The assetlinks.json content for the fingerprint file's text: [] while it has none. A wrong entry stops the build. */
export function assetlinks(text) {
  const prints = (JSON.parse(text).sha256 || []).map((p) => String(p).trim().toUpperCase());
  const bad = prints.filter((p) => !FINGERPRINT.test(p));
  if (bad.length) throw new Error(`android/shine/fingerprints.json: not a SHA-256 fingerprint: ${bad.join(", ")}`);
  if (!prints.length) return [];
  return [{ relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: PACKAGE, sha256_cert_fingerprints: prints } }];
}

/** Vite plugin: the file in every build, and the same answer from the dev server. */
export function assetlinksPlugin(file) {
  const body = () => JSON.stringify(assetlinks(readFileSync(file, "utf8")), null, 2) + "\n";
  return {
    name: "shine-assetlinks",
    generateBundle() { this.emitFile({ type: "asset", fileName: ".well-known/assetlinks.json", source: body() }); },
    configureServer(server) {
      server.middlewares.use("/.well-known/assetlinks.json", (_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(body()); });
    },
  };
}
